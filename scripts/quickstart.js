#!/usr/bin/env node

/**
 * Quick Start Guide
 * Run: node scripts/quickstart.js
 */

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║    🚀 ELITE PAINT VOUCHER - QUICK START GUIDE                    ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
`);

console.log(`
STEP 1: Prerequisites
══════════════════════════════════════════════════════════════════════

You need:
  □ Node.js 18+ (https://nodejs.org)
  □ Cloudflare Account (https://dash.cloudflare.com)
  □ Google Cloud Project with OAuth credentials
  □ Git installed

Check your setup:
  $ node --version      # Should be v18 or higher
  $ npm --version       # Should be 8 or higher
  $ git --version       # Any recent version


STEP 2: Google OAuth Setup
══════════════════════════════════════════════════════════════════════

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Create NEW PROJECT
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0"
5. Choose "Web application"
6. Add Authorized JavaScript origins:
   - http://localhost:8787
   - https://yourdomain.com
7. Add Authorized redirect URIs:
   - http://localhost:8787/auth/callback
   - https://yourdomain.com/auth/callback
8. Copy your:
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET


STEP 3: Clone & Setup
══════════════════════════════════════════════════════════════════════

# Clone the repository
cd elite-paint-voucher

# Run setup script
./scripts/setup.sh          # Linux/Mac
# OR
./scripts/setup.bat         # Windows

# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login


STEP 4: Configure Environment
══════════════════════════════════════════════════════════════════════

1. Copy .env.example to .env.local
   cp .env.example .env.local

2. Edit .env.local and add:
   GOOGLE_CLIENT_ID=your_id_from_step_2
   GOOGLE_CLIENT_SECRET=your_secret_from_step_2
   APP_DOMAIN=http://localhost:8787        # For development
   SESSION_SECRET=random-secret-key-here


STEP 5: Create Cloudflare Resources
══════════════════════════════════════════════════════════════════════

# Create D1 Database
wrangler d1 create elite-voucher

# Create KV Namespaces
wrangler kv:namespace create "KV_SESSIONS"
wrangler kv:namespace create "KV_SETTINGS"
wrangler kv:namespace create "KV_PUBLIC_CACHE"

# Copy the IDs and add to wrangler.toml


STEP 6: Database Setup
══════════════════════════════════════════════════════════════════════

# Run migrations to create tables
wrangler d1 execute elite-voucher --local < migrations/001_initial_schema.sql

# Or for production
wrangler d1 execute elite-voucher --remote < migrations/001_initial_schema.sql


STEP 7: Development
══════════════════════════════════════════════════════════════════════

# Start development server
npm run dev

# Open browser to: http://localhost:8787

# Test login with Google
# Create a test voucher
# Test print functionality


STEP 8: Production Deployment
══════════════════════════════════════════════════════════════════════

# Before deploying, update:
# - wrangler.toml with production resource IDs
# - .env settings with production URLs
# - Google OAuth with production redirect URLs

# Deploy to Cloudflare
npm run deploy

# Access your app at: https://yourdomain.com


COMMON COMMANDS
══════════════════════════════════════════════════════════════════════

Development:
  npm run dev              # Start dev server
  npm run build            # Build frontend
  
Database:
  wrangler d1 list         # List databases
  wrangler d1 info         # Get database info
  wrangler kv:namespace list    # List KV namespaces
  
Deployment:
  wrangler deploy          # Deploy workers
  npm run deploy           # Deploy everything
  
Admin Tools:
  npm run admin -- list-users
  npm run admin -- extend-trial <user-id> <days>


TROUBLESHOOTING
══════════════════════════════════════════════════════════════════════

Authentication fails:
  → Check OAuth credentials in .env.local
  → Verify redirect URLs in Google Console
  → Check wrangler is logged in: wrangler login

Database not found:
  → Create with: wrangler d1 create elite-voucher
  → Check wrangler.toml has correct database_id
  → Run migrations

Port 8787 already in use:
  → Kill process: lsof -i :8787 | grep LISTEN | awk '{print $2}' | xargs kill
  → Or use different port: wrangler dev --port 3000


USEFUL LINKS
══════════════════════════════════════════════════════════════════════

Documentation:
  - Deployment Guide: docs/DEPLOYMENT.md
  - Architecture: docs/ARCHITECTURE.md
  - Full README: README.md

External Resources:
  - Cloudflare Workers: https://developers.cloudflare.com/workers/
  - Cloudflare D1: https://developers.cloudflare.com/d1/
  - Cloudflare KV: https://developers.cloudflare.com/kv/
  - Google OAuth: https://developers.google.com/identity/protocols/oauth2


DEMO ACCOUNTS (After Deployment)
══════════════════════════════════════════════════════════════════════

Regular User:
  - Google account (any)
  - Gets 30-day trial automatically
  - Can create unlimited vouchers

Admin User:
  - Set in SUPER_ADMIN_EMAILS in .env
  - Can manage all users
  - Can extend trials
  - Can view all vouchers


SUPPORT
══════════════════════════════════════════════════════════════════════

Issues? Check:
  1. error messages in browser console (F12)
  2. Cloudflare Workers logs: wrangler tail
  3. .wrangler/state/d1.sqlite for local DB
  4. GitHub Issues: https://github.com/ronyopq/...

`);

console.log(`
════════════════════════════════════════════════════════════════════
Ready to build? Start with: npm run dev
════════════════════════════════════════════════════════════════════
`);
