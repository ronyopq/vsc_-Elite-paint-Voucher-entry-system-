// Admin Route Handlers

import Database from '../shared/db.js';
import { requireAdmin, requireSuperAdmin, setAuthCookie } from '../shared/auth.js';
import { generateId } from '../shared/utils.js';

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

    return new Response(JSON.stringify({ users, page, limit }), {
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
