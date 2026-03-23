// Authentication Middleware and Google OAuth Handler

import { hashToken, generateId } from './utils.js';

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export class AuthHandler {
  constructor(clientId, clientSecret, redirectUri) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  // Generate Google OAuth URL
  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state: state,
      prompt: 'select_account consent',
      include_granted_scopes: 'true',
      access_type: 'online',
      hl: 'bn'
    });

    return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
  }

  // Exchange code for token
  async exchangeCode(code) {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    return response.json();
  }

  // Get user info from Google
  async getUserInfo(accessToken) {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return response.json();
  }

  // Complete OAuth flow
  async handleCallback(code) {
    try {
      const tokens = await this.exchangeCode(code);
      const userInfo = await this.getUserInfo(tokens.access_token);

      return {
        googleId: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        accessToken: tokens.access_token,
        idToken: tokens.id_token
      };
    } catch (error) {
      throw new Error(`OAuth callback failed: ${error.message}`);
    }
  }
}

// Session management
export class SessionManager {
  constructor(kvSessions) {
    this.kv = kvSessions;
  }

  // Create session
  async createSession(userId, userData, expiresIn = 7 * 24 * 60 * 60) {
    const sessionToken = generateId('sess');
    const hashedToken = await hashToken(sessionToken);
    
    const sessionData = {
      userId,
      ...userData,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
    };

    await this.kv.put(
      `session:${hashedToken}`,
      JSON.stringify(sessionData),
      { expirationTtl: expiresIn }
    );

    return sessionToken;
  }

  // Get session
  async getSession(token) {
    const hashedToken = await hashToken(token);
    const sessionData = await this.kv.get(`session:${hashedToken}`);
    
    if (!sessionData) {
      return null;
    }

    try {
      return JSON.parse(sessionData);
    } catch (e) {
      return null;
    }
  }

  // Invalidate session
  async invalidateSession(token) {
    const hashedToken = await hashToken(token);
    await this.kv.delete(`session:${hashedToken}`);
  }

  // Generate CSRF token
  async generateCsrfToken() {
    const token = generateId('csrf');
    const hashedToken = await hashToken(token);
    
    await this.kv.put(
      `csrf:${hashedToken}`,
      '1',
      { expirationTtl: 3600 } // 1 hour
    );

    return token;
  }

  // Verify CSRF token
  async verifyCsrfToken(token) {
    const hashedToken = await hashToken(token);
    const exists = await this.kv.get(`csrf:${hashedToken}`);
    
    if (exists) {
      await this.kv.delete(`csrf:${hashedToken}`);
      return true;
    }

    return false;
  }
}

// Extract user from request
export function extractUserFromRequest(request, sessionData) {
  if (!sessionData) {
    return null;
  }

  // Check if user is blocked
  if (sessionData.isBlocked) {
    return null;
  }

  return {
    id: sessionData.userId,
    email: sessionData.email,
    name: sessionData.name,
    role: sessionData.role,
    trialEnd: sessionData.trialEnd
  };
}

// Middleware to check authentication
export async function requireAuth(request, sessionManager, context) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [name, value] = c.split('=').map(s => s.trim());
      return [name, value];
    })
  );

  const sessionToken = cookies.session_token;
  
  if (!sessionToken) {
    return [null, new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })];
  }

  const session = await sessionManager.getSession(sessionToken);
  
  if (!session) {
    return [null, new Response(JSON.stringify({ error: 'Session expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })];
  }

  return [session, null];
}

// Middleware to check admin role
export async function requireAdmin(request, sessionManager) {
  const [session, authError] = await requireAuth(request, sessionManager);
  
  if (authError) return [null, authError];

  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return [null, new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })];
  }

  return [session, null];
}

// Middleware to check super admin role
export async function requireSuperAdmin(request, sessionManager) {
  const [session, authError] = await requireAuth(request, sessionManager);
  
  if (authError) return [null, authError];

  if (session.role !== 'super_admin') {
    return [null, new Response(JSON.stringify({ error: 'Super admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })];
  }

  return [session, null];
}

// Set auth cookie
export function setAuthCookie(response, sessionToken, expiresIn = 7 * 24 * 60 * 60) {
  const expires = new Date(Date.now() + expiresIn * 1000).toUTCString();
  
  response.headers.set(
    'Set-Cookie',
    `session_token=${sessionToken}; Path=/; Expires=${expires}; HttpOnly; Secure; SameSite=Lax`
  );

  return response;
}

// Clear auth cookie
export function clearAuthCookie(response) {
  response.headers.set(
    'Set-Cookie',
    'session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; HttpOnly; Secure; SameSite=Lax'
  );

  return response;
}
