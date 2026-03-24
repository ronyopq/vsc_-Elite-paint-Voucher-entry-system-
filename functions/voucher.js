// Voucher Route Handlers

import Database from '../shared/db.js';
import { requireAuth } from '../shared/auth.js';
import { generateId, generatePublicId, convertNumberToBangla, getLocalDateString } from '../shared/utils.js';

// Create voucher
export async function handleVoucherCreate(request, db, sessionManager) {
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
      paymentMethod: data.paymentMethod || ''
    };

    await db.createVoucher(voucherData);

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

    return new Response(JSON.stringify({
      vouchers: vouchers.results || [],
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
export async function handleVoucherWorkflowUpdate(request, db, sessionManager, voucherId) {
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
    const stage = String(data.stage || '').trim().toLowerCase();
    const actor = data.actor || session.name || session.email || 'System';

    const allowedStages = ['prepared', 'verified', 'recommended', 'approved'];
    if (!allowedStages.includes(stage)) {
      return new Response(JSON.stringify({ error: 'Invalid workflow stage' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const stageFieldMap = {
      prepared: 'preparedBy',
      verified: 'verifiedBy',
      recommended: 'recommendedBy',
      approved: 'approvedBy'
    };

    const updates = {
      [stageFieldMap[stage]]: actor,
      status: 'saved'
    };

    await db.updateVoucher(voucherId, updates);
    const updatedVoucher = await db.getVoucher(voucherId);

    await db.logAction(
      session.userId,
      `voucher_${stage}`,
      'voucher',
      voucherId,
      JSON.stringify({ stage, actor })
    );

    return new Response(JSON.stringify({
      success: true,
      voucher: updatedVoucher
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
