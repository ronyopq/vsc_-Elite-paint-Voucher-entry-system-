// Authentication Route Handlers

import Database from '../shared/db.js';
import { SessionManager, setAuthCookie, clearAuthCookie, requireAuth } from '../shared/auth.js';
import { generateId } from '../shared/utils.js';

function normalizeLoginId(value) {
  return String(value || '').trim().toLowerCase();
}

// Handle local username/password login (temporary fallback when Google auth is unavailable)
export async function handleLocalLogin(request, sessionManager, db, env) {
  try {
    const data = await request.json();
    const loginId = normalizeLoginId(data.loginId);
    const password = String(data.password || '');

    if (!loginId || !password) {
      return new Response(JSON.stringify({ error: 'লগইন আইডি এবং পাসওয়ার্ড দিন।' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const allowedId = normalizeLoginId(env.LOCAL_LOGIN_ID || 'admin');
    const allowedPassword = String(env.LOCAL_LOGIN_PASSWORD || '12345678');

    if (loginId !== allowedId || password !== allowedPassword) {
      return new Response(JSON.stringify({ error: 'ভুল লগইন আইডি অথবা পাসওয়ার্ড।' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const localGoogleId = `local:${loginId}`;
    let user = await db.getUserByGoogleId(localGoogleId);

    if (!user) {
      const userId = generateId('user');
      const localEmail = `${loginId}@local.user`;
      await db.createUser(userId, localGoogleId, loginId, localEmail, 3650);
      user = await db.getUser(userId);

      // Local fallback login gets super admin by default to keep system operable now.
      await db.updateUserRole(userId, env.LOCAL_LOGIN_ROLE || 'super_admin');
      user = await db.getUser(userId);
    }

    if (user.is_blocked) {
      return new Response(JSON.stringify({ error: 'এই অ্যাকাউন্টটি ব্লক করা আছে।' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sessionToken = await sessionManager.createSession(user.id, {
      email: user.email,
      name: user.name,
      role: user.role,
      trialEnd: user.trial_end,
      isBlocked: user.is_blocked
    });

    const response = new Response(JSON.stringify({ success: true, redirectTo: '/dashboard' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    return setAuthCookie(response, sessionToken);
  } catch (error) {
    return new Response(JSON.stringify({ error: 'লোকাল লগইন ব্যর্থ হয়েছে।' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

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
  const oauthError = url.searchParams.get('error');
  const oauthErrorDescription = url.searchParams.get('error_description');

  if (oauthError) {
    const redirectUrl = new URL(env.APP_DOMAIN);
    redirectUrl.searchParams.set('auth_error', oauthError);
    if (oauthErrorDescription) {
      redirectUrl.searchParams.set('auth_error_description', oauthErrorDescription);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl.toString()
      }
    });
  }

  if (!code || !state) {
    const redirectUrl = new URL(env.APP_DOMAIN);
    redirectUrl.searchParams.set('auth_error', 'missing_code_or_state');
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl.toString()
      }
    });
  }

  // Verify state
  const stateExists = await sessionManager.kv.get(`oauth_state:${state}`);
  if (!stateExists) {
    const redirectUrl = new URL(env.APP_DOMAIN);
    redirectUrl.searchParams.set('auth_error', 'invalid_state');
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl.toString()
      }
    });
  }

  try {
    // Get user info from Google
    const userInfo = await authHandler.handleCallback(code);

    // Check if user exists
    let user = await db.getUserByGoogleId(userInfo.googleId);

    // If super admin pre-created user by email, attach google id.
    if (!user) {
      const existingByEmail = await db.getUserByEmail(userInfo.email);
      if (existingByEmail) {
        await db.linkUserGoogleId(existingByEmail.id, userInfo.googleId);
        user = await db.getUser(existingByEmail.id);
      }
    }

    // Create user if not exists
    if (!user) {
      const userId = generateId('user');
      await db.createUser(userId, userInfo.googleId, userInfo.name, userInfo.email);
      user = await db.getUser(userId);
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
    const redirectUrl = new URL(env.APP_DOMAIN);
    redirectUrl.searchParams.set('auth_error', 'oauth_callback_failed');
    redirectUrl.searchParams.set('auth_error_description', error.message || 'Authentication failed');
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl.toString()
      }
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
