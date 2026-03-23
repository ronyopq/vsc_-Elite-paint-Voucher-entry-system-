// Authentication Route Handlers

import Database from '../shared/db.js';
import { SessionManager, setAuthCookie, clearAuthCookie, requireAuth } from '../shared/auth.js';
import { generateId } from '../shared/utils.js';

// Handle login - redirect to Google OAuth
export async function handleAuthLogin(request, sessionManager, authHandler, env) {
  const state = generateId('state');
  
  // Store state in KV for verification in callback
  await sessionManager.kv.put(
    `oauth_state:${state}`,
    '1',
    { expirationTtl: 600 } // 10 minutes
  );

  const authUrl = authHandler.getAuthUrl(state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl
    }
  });
}

// Handle OAuth callback
export async function handleAuthCallback(request, sessionManager, authHandler, db, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return new Response(JSON.stringify({ error: 'Missing code or state' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Verify state
  const stateExists = await sessionManager.kv.get(`oauth_state:${state}`);
  if (!stateExists) {
    return new Response(JSON.stringify({ error: 'Invalid state' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get user info from Google
    const userInfo = await authHandler.handleCallback(code);

    // Check if user exists
    let user = await db.getUserByGoogleId(userInfo.googleId);

    // Create user if not exists
    if (!user) {
      const userId = generateId('user');
      await db.createUser(userId, userInfo.googleId, userInfo.name, userInfo.email);
      user = await db.getUser(userId);
    }

    // Promote configured emails to super admin role
    const superAdminEmails = String(env.SUPER_ADMIN_EMAILS || '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean);

    if (superAdminEmails.includes(String(user.email || '').toLowerCase()) && user.role !== 'super_admin') {
      await db.updateUserRole(user.id, 'super_admin');
      user = await db.getUser(user.id);
    }

    // Check if user is blocked
    if (user.is_blocked) {
      return new Response(JSON.stringify({ error: 'User account is blocked' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create session
    const sessionToken = await sessionManager.createSession(user.id, {
      email: user.email,
      name: user.name,
      role: user.role,
      trialEnd: user.trial_end,
      isBlocked: user.is_blocked
    });

    // Delete used state
    await sessionManager.kv.delete(`oauth_state:${state}`);

    const response = new Response(null, {
      status: 302,
      headers: {
        Location: `${env.APP_DOMAIN}/dashboard`
      }
    });

    return setAuthCookie(response, sessionToken);

  } catch (error) {
    console.error('Auth callback error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle logout
export async function handleAuthLogout(request, sessionManager) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [name, value] = c.split('=').map(s => s.trim());
      return [name, value];
    })
  );

  const sessionToken = cookies.session_token;
  
  if (sessionToken) {
    await sessionManager.invalidateSession(sessionToken);
  }

  const response = new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  return clearAuthCookie(response);
}

// Handle get current user
export async function handleAuthUser(request, sessionManager) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  return new Response(JSON.stringify({
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      trialEnd: session.trialEnd
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
