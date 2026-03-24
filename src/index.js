// Elite Paint Voucher Entry System
// Cloudflare Workers Main Entry Point

import Database from '../shared/db.js';
import { AuthHandler, SessionManager, requireAuth, requireAdmin, requireSuperAdmin, setAuthCookie, clearAuthCookie } from '../shared/auth.js';
import { generateId, generatePublicId, getLocalDateString } from '../shared/utils.js';

// Import route handlers
import { handleAuthLogin, handleAuthCallback, handleAuthLogout, handleAuthUser, handleLocalLogin } from '../functions/auth.js';
import { handleVoucherCreate, handleVoucherGet, handleVoucherGetAll, handleVoucherWorkflowUpdate, handleVoucherPublic } from '../functions/voucher.js';
import { handleSuggestGet, handleSuggestAdd } from '../functions/suggest.js';
import { handleAdminUsers, handleAdminBlock, handleAdminExtendTrial, handleAdminLoginAs } from '../functions/admin.js';

export default {
  async fetch(request, env, context) {
    // Ensure HTTPS
    const url = new URL(request.url);
    if (url.protocol === 'http:' && env.ENVIRONMENT === 'production') {
      return new Response(null, {
        status: 301,
        headers: { Location: 'https://' + url.host + url.pathname + url.search }
      });
    }

    // Initialize services
    const db = new Database(env.DB);
    const sessionManager = new SessionManager(env.KV_SESSIONS);
    const authHandler = new AuthHandler(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    );

    // Add CORS headers for API routes
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    const path = url.pathname;
    const match = path.match(/^\/([^/]+)(?:\/(.*))?$/);
    const [, route, subpath] = match || [null];

    try {
      // Auth routes
      if (route === 'auth') {
        if (subpath === 'login') {
          return handleAuthLogin(request, sessionManager, authHandler, env);
        } else if (subpath === 'local-login' && request.method === 'POST') {
          return handleLocalLogin(request, sessionManager, db, env);
        } else if (subpath === 'callback') {
          return handleAuthCallback(request, sessionManager, authHandler, db, env);
        } else if (subpath === 'logout') {
          return handleAuthLogout(request, sessionManager);
        } else if (subpath === 'user') {
          return handleAuthUser(request, sessionManager);
        }
      }

      // API routes
      if (route === 'api') {
        const [apiRoute, ...apiSubpath] = subpath?.split('/') || [];

        // Voucher routes
        if (apiRoute === 'voucher') {
          const action = apiSubpath[0];
          
          if (request.method === 'POST' && action === 'create') {
            return handleVoucherCreate(request, db, sessionManager);
          } else if (request.method === 'POST' && action === 'workflow' && apiSubpath[1]) {
            return handleVoucherWorkflowUpdate(request, db, sessionManager, apiSubpath[1]);
          } else if (request.method === 'GET' && action === 'all') {
            return handleVoucherGetAll(request, db, sessionManager);
          } else if (request.method === 'GET' && apiSubpath.length === 1) {
            return handleVoucherGet(request, db, sessionManager, apiSubpath[0]);
          }
        }

        // Public voucher view
        if (apiRoute === 'v') {
          const publicId = apiSubpath[0];
          return handleVoucherPublic(request, db, env);
        }

        // Suggestions routes
        if (apiRoute === 'suggest') {
          const type = apiSubpath[0];
          
          if (request.method === 'GET') {
            return handleSuggestGet(request, db, sessionManager, type);
          } else if (request.method === 'POST') {
            return handleSuggestAdd(request, db, sessionManager, type);
          }
        }

        // Admin routes
        if (apiRoute === 'admin') {
          const action = apiSubpath[0];

          if (action === 'users' && request.method === 'GET') {
            return handleAdminUsers(request, db, sessionManager);
          } else if (action === 'user' && request.method === 'POST') {
            const subaction = apiSubpath[1];
            
            if (subaction === 'block') {
              return handleAdminBlock(request, db, sessionManager);
            } else if (subaction === 'extend-trial') {
              return handleAdminExtendTrial(request, db, sessionManager);
            } else if (subaction === 'login-as') {
              return handleAdminLoginAs(request, db, sessionManager);
            }
          }
        }
      }

      // Serve static files or redirect to public page
      if (route === 'v' && subpath) {
        // Public voucher view - serve static page loader
        const html = getPublicPageHTML(subpath);
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300'
          }
        });
      }

      // Serve index page
      if (path === '/' || path === '') {
        const html = getIndexHTML();
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          }
        });
      }

      // Serve admin page
      if (path === '/admin' || path === '/admin/') {
        const html = getAdminHTML();
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          }
        });
      }

      // 404
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Route handler error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

// HTML serving functions
function getIndexHTML() {
  // This would typically be served from Cloudflare Pages
  // For now, return a redirect or basic HTML
  return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>এলিট পেইন্ট ভাউচার এন্ট্রি সিস্টেম</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Serif Bengali', serif; background: #f5f5f5; }
    .loader { display: flex; align-items: center; justify-content: center; height: 100vh; }
    .loader-text { font-size: 24px; color: #333; }
  </style>
</head>
<body>
  <div class="loader">
    <div class="loader-text">এলিট পেইন্ট ভাউচার লোড হচ্ছে...</div>
  </div>
  <script src="/app.js"></script>
</body>
</html>
  `;
}

function getAdminHTML() {
  return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>অ্যাডমিন ড্যাশবোর্ড</title>
  <link href="https://fonts.google.com/css2?family=Noto+Serif+Bengali:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Serif Bengali', serif; background: #f5f5f5; }
    .loader { display: flex; align-items: center; justify-content: center; height: 100vh; }
    .loader-text { font-size: 24px; color: #333; }
  </style>
</head>
<body>
  <div class="loader">
    <div class="loader-text">অ্যাডমিন ড্যাশবোর্ড লোড হচ্ছে...</div>
  </div>
  <script src="/admin.js"></script>
</body>
</html>
  `;
}

function getPublicPageHTML(publicId) {
  return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ভাউচার ভিউ</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Serif Bengali', serif; background: #f5f5f5; }
    .loader { display: flex; align-items: center; justify-content: center; height: 100vh; }
    .loader-text { font-size: 24px; color: #333; }
  </style>
</head>
<body>
  <div class="loader">
    <div class="loader-text">ভাউচার লোড হচ্ছে...</div>
  </div>
  <script>
    const publicId = '${publicId}';
    fetch(\`/api/v/\${publicId}\`).then(r => r.json()).then(data => {
      if (data.error) {
        document.body.innerHTML = '<h1>ভাউচার পাওয়া যায়নি</h1>';
      } else {
        // Load public page viewer
        const script = document.createElement('script');
        script.src = '/public-viewer.js';
        document.head.appendChild(script);
      }
    });
  </script>
</body>
</html>
  `;
}
