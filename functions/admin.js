// Admin Route Handlers

import Database from '../shared/db.js';
import { requireAdmin, requireSuperAdmin, setAuthCookie } from '../shared/auth.js';
import { generateId } from '../shared/utils.js';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parseLimitConfig(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return {
      dailyVoucherLimit: Math.max(0, parseInt(parsed.dailyVoucherLimit || 0, 10) || 0),
      monthlyVoucherLimit: Math.max(0, parseInt(parsed.monthlyVoucherLimit || 0, 10) || 0)
    };
  } catch {
    return { dailyVoucherLimit: 0, monthlyVoucherLimit: 0 };
  }
}

// Get all users (admin only)
export async function handleAdminUsers(request, db, sessionManager) {
  const [session, authError] = await requireAdmin(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = page * limit;

    const result = await db.getAllUsers(limit, offset);
    const users = result.results || result;
    const usersWithLimits = await Promise.all(users.map(async (u) => {
      const rawLimits = await db.getSetting(`user_limits:${u.id}`);
      return {
        ...u,
        ...parseLimitConfig(rawLimits)
      };
    }));

    return new Response(JSON.stringify({ users: usersWithLimits, page, limit }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Admin users error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Create new user (super admin only)
export async function handleAdminCreateUser(request, db, sessionManager) {
  const [session, authError] = await requireSuperAdmin(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const data = await request.json();
    const name = String(data.name || '').trim();
    const email = normalizeEmail(data.email);
    const role = ['user', 'admin', 'super_admin'].includes(data.role) ? data.role : 'user';
    const trialDays = Math.max(1, Math.min(3650, parseInt(data.trialDays || 30, 10) || 30));
    const dailyVoucherLimit = Math.max(0, parseInt(data.dailyVoucherLimit || 0, 10) || 0);
    const monthlyVoucherLimit = Math.max(0, parseInt(data.monthlyVoucherLimit || 0, 10) || 0);

    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'name এবং email প্রয়োজন' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const existingByEmail = await db.getUserByEmail(email);
    if (existingByEmail) {
      return new Response(JSON.stringify({ error: 'এই email দিয়ে user আগে থেকেই আছে' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = generateId('user');
    const googleId = `manual:${email}`;
    await db.createUser(userId, googleId, name, email, trialDays);
    await db.updateUserRole(userId, role);
    await db.setSetting(`user_limits:${userId}`, JSON.stringify({ dailyVoucherLimit, monthlyVoucherLimit }), session.userId);

    await db.logAction(
      session.userId,
      'CREATE_USER',
      'user',
      userId,
      JSON.stringify({ email, role, trialDays, dailyVoucherLimit, monthlyVoucherLimit })
    );

    const createdUser = await db.getUser(userId);
    return new Response(JSON.stringify({
      success: true,
      user: {
        ...createdUser,
        dailyVoucherLimit,
        monthlyVoucherLimit
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Admin create user error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Set user limits (super admin only)
export async function handleAdminSetLimits(request, db, sessionManager) {
  const [session, authError] = await requireSuperAdmin(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const data = await request.json();
    const userId = String(data.userId || '').trim();
    const dailyVoucherLimit = Math.max(0, parseInt(data.dailyVoucherLimit || 0, 10) || 0);
    const monthlyVoucherLimit = Math.max(0, parseInt(data.monthlyVoucherLimit || 0, 10) || 0);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await db.getUser(userId);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await db.setSetting(`user_limits:${userId}`, JSON.stringify({ dailyVoucherLimit, monthlyVoucherLimit }), session.userId);
    await db.logAction(session.userId, 'SET_USER_LIMITS', 'user', userId, JSON.stringify({ dailyVoucherLimit, monthlyVoucherLimit }));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Admin set limits error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Block/unblock user (super admin only)
export async function handleAdminBlock(request, db, sessionManager) {
  const [session, authError] = await requireSuperAdmin(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const data = await request.json();

    if (!data.userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await db.getUser(data.userId);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const blocked = data.blocked === true;
    await db.blockUser(data.userId, blocked);

    // Log action
    await db.logAction(
      session.userId,
      blocked ? 'BLOCK_USER' : 'UNBLOCK_USER',
      'user',
      data.userId
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Admin block error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Extend user trial (super admin only)
export async function handleAdminExtendTrial(request, db, sessionManager) {
  const [session, authError] = await requireSuperAdmin(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const data = await request.json();

    if (!data.userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await db.getUser(data.userId);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const days = data.days || 30;
    await db.extendTrial(data.userId, days);

    // Log action
    await db.logAction(
      session.userId,
      'EXTEND_TRIAL',
      'user',
      data.userId,
      `Extended by ${days} days`
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Admin extend trial error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Login as user (super admin only)
export async function handleAdminLoginAs(request, db, sessionManager) {
  const [session, authError] = await requireSuperAdmin(request, sessionManager);

  if (authError) {
    return authError;
  }

  try {
    const data = await request.json();

    if (!data.userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await db.getUser(data.userId);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create session for target user
    const sessionToken = await sessionManager.createSession(user.id, {
      email: user.email,
      name: user.name,
      role: user.role,
      trialEnd: user.trial_end,
      isBlocked: user.is_blocked
    });

    // Log action
    await db.logAction(
      session.userId,
      'LOGIN_AS_USER',
      'user',
      data.userId
    );

    const response = new Response(JSON.stringify({ success: true, sessionToken }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    return setAuthCookie(response, sessionToken);

  } catch (error) {
    console.error('Admin login as error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
