// Voucher Route Handlers

import Database from '../shared/db.js';
import { requireAuth } from '../shared/auth.js';
import { generateId, generatePublicId, convertNumberToBangla, getLocalDateString, hashToken } from '../shared/utils.js';

const SOFT_DELETE_SETTING_KEY = 'soft_delete_registry_v1';

async function getSoftDeleteRegistry(db) {
  try {
    const raw = await db.getSetting(SOFT_DELETE_SETTING_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function setSoftDeleteRegistry(db, registry, updatedBy = null) {
  await db.setSetting(SOFT_DELETE_SETTING_KEY, JSON.stringify(registry || {}), updatedBy);
}

function isVoucherSoftDeleted(registry, voucherId) {
  return Boolean(registry && registry[voucherId] && registry[voucherId].deletedAt);
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getPreviousMonthKey(date = new Date()) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - 1);
  return getMonthKey(d);
}

async function buildOrGetMonthlyReport(db, userId, monthKey, { force = false, actorId = null } = {}) {
  const reportSettingKey = `monthly_auto_report:${userId}:${monthKey}`;

  if (!force) {
    const existing = await db.getSetting(reportSettingKey);
    if (existing) {
      return { report: JSON.parse(existing), cached: true };
    }
  }

  const vouchersRaw = await db.getUserVouchers(userId, 10000, 0);
  const allVouchers = vouchersRaw.results || [];
  const softDeleteRegistry = await getSoftDeleteRegistry(db);

  const monthlyRows = allVouchers.filter((v) => {
    if (isVoucherSoftDeleted(softDeleteRegistry, v.id)) return false;
    const d = String(v.date || '');
    return d.startsWith(`${monthKey}-`) || d.startsWith(monthKey);
  });

  const totalAmount = monthlyRows.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
  const byPayee = {};
  monthlyRows.forEach((v) => {
    const key = String(v.pay_to || 'Unknown').trim() || 'Unknown';
    if (!byPayee[key]) byPayee[key] = { name: key, count: 0, total: 0 };
    byPayee[key].count += 1;
    byPayee[key].total += parseFloat(v.amount) || 0;
  });

  const report = {
    month: monthKey,
    generatedAt: new Date().toISOString(),
    totalVouchers: monthlyRows.length,
    totalAmount,
    approvedVouchers: monthlyRows.length,
    topPayees: Object.values(byPayee).sort((a, b) => b.total - a.total).slice(0, 10)
  };

  await db.setSetting(reportSettingKey, JSON.stringify(report), actorId || userId);
  await db.logAction(actorId || userId, 'monthly_report_generated', 'report', `${userId}:${monthKey}`, JSON.stringify(report));

  return { report, cached: false };
}

async function getUserLimitConfig(db, userId) {
  try {
    const raw = await db.getSetting(`user_limits:${userId}`);
    const parsed = JSON.parse(raw || '{}');
    return {
      dailyVoucherLimit: Math.max(0, parseInt(parsed.dailyVoucherLimit || 0, 10) || 0),
      monthlyVoucherLimit: Math.max(0, parseInt(parsed.monthlyVoucherLimit || 0, 10) || 0)
    };
  } catch {
    return { dailyVoucherLimit: 0, monthlyVoucherLimit: 0 };
  }
}

function getTodayDateKey() {
  return getLocalDateString(new Date());
}

function getMonthDateKey() {
  return new Date().toISOString().slice(0, 7);
}

async function queueWorkflowEmailNotification(env, payload) {
  const now = new Date().toISOString();
  const body = {
    event: 'voucher_workflow_notification',
    sentAt: now,
    ...payload
  };

  if (!env || !env.EMAIL_WEBHOOK_URL) {
    return { queued: true, via: 'audit_only' };
  }

  try {
    const response = await fetch(env.EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return { queued: response.ok, via: 'webhook', status: response.status };
  } catch {
    return { queued: false, via: 'webhook' };
  }
}

// Create voucher
export async function handleVoucherCreate(request, db, sessionManager, env) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const data = await request.json();

    // Validate required fields
    const required = ['date', 'voucherNo', 'payTo', 'controlAc', 'particulars', 'amount'];
    for (const field of required) {
      if (!data[field]) {
        return new Response(JSON.stringify({ error: `Missing field: ${field}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const voucherId = generateId('voucher');
    const publicId = generatePublicId();
    const amountWords = convertNumberToBangla(parseFloat(data.amount));

    const limitConfig = await getUserLimitConfig(db, session.userId);
    if (limitConfig.dailyVoucherLimit > 0 || limitConfig.monthlyVoucherLimit > 0) {
      const userVouchersRaw = await db.getUserVouchers(session.userId, 10000, 0);
      const userVouchers = userVouchersRaw.results || [];
      const softDeleteRegistry = await getSoftDeleteRegistry(db);
      const activeVouchers = userVouchers.filter((v) => !isVoucherSoftDeleted(softDeleteRegistry, v.id));

      const todayCount = activeVouchers.filter((v) => String(v.date || '') === getTodayDateKey()).length;
      const monthCount = activeVouchers.filter((v) => String(v.date || '').slice(0, 7) === getMonthDateKey()).length;

      if (limitConfig.dailyVoucherLimit > 0 && todayCount >= limitConfig.dailyVoucherLimit) {
        return new Response(JSON.stringify({ error: `দৈনিক ভাউচার সীমা শেষ (${limitConfig.dailyVoucherLimit})` }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (limitConfig.monthlyVoucherLimit > 0 && monthCount >= limitConfig.monthlyVoucherLimit) {
        return new Response(JSON.stringify({ error: `মাসিক ভাউচার সীমা শেষ (${limitConfig.monthlyVoucherLimit})` }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const voucherData = {
      id: voucherId,
      userId: session.userId,
      publicId: publicId,
      date: data.date,
      voucherNo: data.voucherNo,
      payTo: data.payTo,
      codeNo: data.codeNo || '',
      controlAc: data.controlAc,
      particulars: data.particulars,
      amount: parseFloat(data.amount),
      amountWords: amountWords,
      accountNo: data.accountNo || '',
      paymentMethod: data.paymentMethod || '',
      preparedBy: session.name || session.email || 'System',
      verifiedBy: session.name || session.email || 'System',
      recommendedBy: session.name || session.email || 'System',
      approvedBy: session.name || session.email || 'System',
      status: 'printed'
    };

    await db.createVoucher(voucherData);

    const createNotifyPayload = {
      voucherId,
      voucherNo: data.voucherNo,
      stage: 'created',
      actor: session.name || session.email || 'System',
      nextRole: 'completed'
    };
    const createNotifyResult = await queueWorkflowEmailNotification(env, createNotifyPayload);
    await db.logAction(
      session.userId,
      'email_notification_queued',
      'voucher',
      voucherId,
      JSON.stringify({ ...createNotifyPayload, notifyResult: createNotifyResult })
    );

    await db.logAction(
      session.userId,
      'voucher_auto_approved',
      'voucher',
      voucherId,
      JSON.stringify({ policy: 'auto_approve_on_create' })
    );

    // Add to saved lists
    if (data.payTo) await db.addToSavedList(session.userId, 'payto', data.payTo);
    if (data.codeNo) await db.addToSavedList(session.userId, 'code', data.codeNo);
    if (data.controlAc) await db.addToSavedList(session.userId, 'ac', data.controlAc);
    if (data.particulars) await db.addToSavedList(session.userId, 'particulars', data.particulars);

    return new Response(JSON.stringify({
      success: true,
      voucher: {
        id: voucherId,
        publicId: publicId,
        ...voucherData
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Voucher create error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get single voucher
export async function handleVoucherGet(request, db, sessionManager, voucherId) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const voucher = await db.getVoucher(voucherId);

    if (!voucher) {
      return new Response(JSON.stringify({ error: 'Voucher not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check ownership
    if (voucher.user_id !== session.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const registry = await getSoftDeleteRegistry(db);
    if (isVoucherSoftDeleted(registry, voucherId)) {
      return new Response(JSON.stringify({ error: 'Voucher সফট ডিলিট করা হয়েছে' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ voucher }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Voucher get error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get all vouchers for user
export async function handleVoucherGetAll(request, db, sessionManager) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = page * limit;

    const vouchers = await db.getUserVouchers(session.userId, limit, offset);
    const registry = await getSoftDeleteRegistry(db);
    const visibleVouchers = (vouchers.results || []).filter((v) => !isVoucherSoftDeleted(registry, v.id));

    return new Response(JSON.stringify({
      vouchers: visibleVouchers,
      page,
      limit
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Voucher getAll error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Update workflow stage for a voucher
export async function handleVoucherWorkflowUpdate(request, db, sessionManager, voucherId, env) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const voucher = await db.getVoucher(voucherId);
    if (!voucher) {
      return new Response(JSON.stringify({ error: 'Voucher not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (voucher.user_id !== session.userId && session.role !== 'admin' && session.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const actor = session.name || session.email || 'System';

    const updates = {
      preparedBy: voucher.prepared_by || actor,
      verifiedBy: voucher.verified_by || actor,
      recommendedBy: voucher.recommended_by || actor,
      approvedBy: voucher.approved_by || actor,
      status: 'printed'
    };

    await db.updateVoucher(voucherId, updates);
    const updatedVoucher = await db.getVoucher(voucherId);

    await db.logAction(
      session.userId,
      'voucher_auto_approved_sync',
      'voucher',
      voucherId,
      JSON.stringify({ actor })
    );

    const notificationPayload = {
      voucherId,
      voucherNo: voucher.voucher_no,
      stage: 'auto_approved',
      actor,
      nextRole: 'completed'
    };

    const notifyResult = await queueWorkflowEmailNotification(env, notificationPayload);
    await db.logAction(
      session.userId,
      'email_notification_queued',
      'voucher',
      voucherId,
      JSON.stringify({ ...notificationPayload, notifyResult })
    );

    return new Response(JSON.stringify({
      success: true,
      voucher: updatedVoucher,
      notification: notifyResult
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Voucher workflow update error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleVoucherUpdate(request, db, sessionManager, voucherId) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const voucher = await db.getVoucher(voucherId);
    if (!voucher) {
      return new Response(JSON.stringify({ error: 'Voucher not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (voucher.user_id !== session.userId && session.role !== 'admin' && session.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await request.json();
    const allowedFields = ['date', 'voucherNo', 'payTo', 'codeNo', 'controlAc', 'particulars', 'amount', 'accountNo', 'paymentMethod'];
    const updates = {};

    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        updates[field] = data[field];
      }
    });

    if (Object.prototype.hasOwnProperty.call(updates, 'amount')) {
      updates.amount = parseFloat(updates.amount) || 0;
      updates.amountWords = convertNumberToBangla(updates.amount);
    }

    if (!Object.keys(updates).length) {
      return new Response(JSON.stringify({ error: 'No update fields provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await db.updateVoucher(voucherId, updates);
    const updatedVoucher = await db.getVoucher(voucherId);

    await db.logAction(
      session.userId,
      'voucher_updated',
      'voucher',
      voucherId,
      JSON.stringify({ before: voucher, changes: updates })
    );

    return new Response(JSON.stringify({ success: true, voucher: updatedVoucher }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Voucher update error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleVoucherAuditTrail(request, db, sessionManager, voucherId) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const voucher = await db.getVoucher(voucherId);
    if (!voucher) {
      return new Response(JSON.stringify({ error: 'Voucher not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (voucher.user_id !== session.userId && session.role !== 'admin' && session.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const logs = await db.getAuditLogsByEntity('voucher', voucherId, 200);

    return new Response(JSON.stringify({
      voucherId,
      logs: logs.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Voucher audit trail error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleApprovalQueue(request, db, sessionManager) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const role = session.role || 'user';
    const queue = [];

    return new Response(JSON.stringify({
      role,
      total: 0,
      queue,
      mode: 'auto-approved'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Approval queue error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleEmailNotifications(request, db, sessionManager) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const logsRaw = await db.getAuditLogsByActionPrefix('email_notification_', 200);
    return new Response(JSON.stringify({
      notifications: logsRaw.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Email notification fetch error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleVoucherSoftDelete(request, db, sessionManager, voucherId) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const voucher = await db.getVoucher(voucherId);
    if (!voucher) {
      return new Response(JSON.stringify({ error: 'Voucher not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (voucher.user_id !== session.userId && session.role !== 'admin' && session.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await request.json().catch(() => ({}));
    const reason = String(data.reason || '').trim();

    const registry = await getSoftDeleteRegistry(db);
    registry[voucherId] = {
      deletedAt: new Date().toISOString(),
      deletedBy: session.userId,
      reason,
      voucherNo: voucher.voucher_no
    };
    await setSoftDeleteRegistry(db, registry, session.userId);

    await db.logAction(
      session.userId,
      'voucher_soft_deleted',
      'voucher',
      voucherId,
      JSON.stringify({ reason })
    );

    return new Response(JSON.stringify({ success: true, softDeleted: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Voucher soft delete error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleExportBackup(request, db, sessionManager) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const vouchersRaw = await db.getUserVouchers(session.userId, 10000, 0);
    const savedListsRaw = await db.getUserSavedListsAll(session.userId, 10000);
    const auditRaw = await db.getUserAuditLogs(session.userId, 10000);
    const softDeleteRegistry = await getSoftDeleteRegistry(db);

    const payload = {
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      user: {
        id: session.userId,
        email: session.email || '',
        name: session.name || ''
      },
      vouchers: vouchersRaw.results || [],
      savedLists: savedListsRaw.results || [],
      auditLogs: auditRaw.results || [],
      softDeletedRegistry: softDeleteRegistry
    };

    await db.logAction(session.userId, 'backup_exported', 'backup', session.userId, JSON.stringify({ vouchers: payload.vouchers.length }));

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="backup-${new Date().toISOString().slice(0, 10)}.json"`
      }
    });
  } catch (error) {
    console.error('Export backup error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleMonthlyAutoReport(request, db, sessionManager) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const url = new URL(request.url);
    const monthKey = url.searchParams.get('month') || getMonthKey(new Date());
    const force = (url.searchParams.get('force') || '').toLowerCase() === 'true';
    const result = await buildOrGetMonthlyReport(db, session.userId, monthKey, { force, actorId: session.userId });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Monthly auto report error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleMonthlyAutoReportCron(db) {
  const usersRaw = await db.getAllUsers(10000, 0);
  const users = usersRaw.results || usersRaw || [];
  const monthKey = getPreviousMonthKey(new Date());

  const activeUsers = users.filter((u) => !u.is_blocked);
  let generated = 0;
  let cached = 0;
  let failed = 0;

  for (const user of activeUsers) {
    try {
      const result = await buildOrGetMonthlyReport(db, user.id, monthKey, { force: false, actorId: user.id });
      if (result.cached) cached += 1;
      else generated += 1;
    } catch {
      failed += 1;
    }
  }

  return { monthKey, totalUsers: activeUsers.length, generated, cached, failed };
}

export async function handleVoucherVerify(request, db, publicId) {
  try {
    if (!publicId) {
      return new Response(JSON.stringify({ error: 'Public ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const voucher = await db.getVoucherByPublicId(publicId);
    if (!voucher) {
      return new Response(JSON.stringify({ error: 'Voucher not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const signatureSource = `${voucher.public_id}|${voucher.voucher_no}|${voucher.amount}|${voucher.date}|${voucher.pay_to}`;
    const signatureHash = await hashToken(signatureSource);
    const verificationCode = signatureHash.slice(0, 12).toUpperCase();

    return new Response(JSON.stringify({
      valid: true,
      verificationCode,
      voucher: {
        publicId: voucher.public_id,
        voucherNo: voucher.voucher_no,
        date: voucher.date,
        payTo: voucher.pay_to,
        amount: voucher.amount,
        status: voucher.status,
        approvedBy: voucher.approved_by || null
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Voucher verify error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get public voucher (no auth required)
export async function handleVoucherPublic(request, db, env) {
  try {
    const url = new URL(request.url);
    const publicId = url.pathname.split('/').pop();

    if (!publicId) {
      return new Response(JSON.stringify({ error: 'Public ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const voucher = await db.getVoucherByPublicId(publicId);

    if (!voucher) {
      return new Response(JSON.stringify({ error: 'Voucher not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const softDeleteRegistry = await getSoftDeleteRegistry(db);
    if (isVoucherSoftDeleted(softDeleteRegistry, voucher.id)) {
      return new Response(JSON.stringify({ error: 'Voucher not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Increment view count in KV
    const viewKey = `voucher_views:${publicId}`;
    const current = await env.KV_PUBLIC_CACHE.get(viewKey) || '0';
    await env.KV_PUBLIC_CACHE.put(viewKey, String(parseInt(current) + 1));

    return new Response(JSON.stringify({
      voucher: {
        id: voucher.id,
        publicId: voucher.public_id,
        date: voucher.date,
        voucherNo: voucher.voucher_no,
        payTo: voucher.pay_to,
        codeNo: voucher.code_no,
        controlAc: voucher.control_ac,
        particulars: voucher.particulars,
        amount: voucher.amount,
        amountWords: voucher.amount_words,
        accountNo: voucher.account_no,
        paymentMethod: voucher.payment_method,
        createdAt: voucher.created_at
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (error) {
    console.error('Public voucher error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
