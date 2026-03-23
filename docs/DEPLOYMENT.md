# Elite Paint Voucher Entry System - Deployment Guide

## Overview
এলিট পেইন্ট ভাউচার এন্ট্রি সিস্টেম একটি শক্তিশালী ক্লাউড-ভিত্তিক, মাল্টি-ইউজার ভাউচার প্রিন্ট ম্যানেজমেন্ট সিস্টেম।

## Pre-requisites

1. **Cloudflare Account** - Workers, Pages, D1, KV access
2. **Node.js** 18+ এবং npm
3. **Git** - সংস্করণ নিয়ন্ত্রণের জন্য
4. **Google OAuth** - গুগল ক্লাউড প্রজেক্ট সেটআপ

## Setup Steps

### 1. Google OAuth Setup

Google Cloud Console এ যান এবং:
- নতুন প্রজেক্ট তৈরি করুন
- OAuth 2.0 credentials তৈরি করুন
- Redirect URI যোগ করুন: `https://yourdomain.com/auth/callback`
- Client ID এবং Secret সংরক্ষণ করুন

### 2. Install Dependencies

```bash
cd elite-paint-voucher
npm install
npm install -g wrangler
```

### 3. Create Cloudflare Resources

```bash
# Login to Cloudflare
wrangler login

# Create D1 Database
wrangler d1 create elite-voucher

# Create KV Namespaces
wrangler kv:namespace create "KV_SESSIONS"
wrangler kv:namespace create "KV_SETTINGS"
wrangler kv:namespace create "KV_PUBLIC_CACHE"
```

### 4. Configure Environment

`.env.local` ফাইল তৈরি করুন:

```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback
APP_DOMAIN=https://yourdomain.com
API_DOMAIN=https://api.yourdomain.com
SUPER_ADMIN_EMAILS=admin@example.com
SESSION_SECRET=random_secret_key
```

### 5. Update wrangler.toml

আপনার Cloudflare IDs দিয়ে আপডেট করুন:

```toml
[[d1_databases]]
database_id = "YOUR_D1_DATABASE_ID"

[[kv_namespaces]]
id = "YOUR_KV_ID"
preview_id = "YOUR_PREVIEW_ID"
```

### 6. Deploy to Cloudflare

```bash
# Development
npm run dev

# Deploy to production
npm run deploy
```

## Database Migration

```bash
# Local testing
wrangler d1 execute elite-voucher --local < migrations/001_initial_schema.sql

# Production
wrangler d1 execute elite-voucher --remote < migrations/001_initial_schema.sql
```

## Access Application

- **Main App**: https://yourdomain.com
- **Admin Dashboard**: https://yourdomain.com/admin
- **Public Voucher**: https://yourdomain.com/v/PUBLIC_ID

## Key Features

✅ Google Login Authentication
✅ নলেজ-বেসড ভাউচার এন্ট্রি
✅ সঠিক প্রিন্ট লেআউট (797x542px)
✅ বাংলা ভাষা সম্পূর্ণ সাপোর্ট
✅ অটো-সাজেশন সিস্টেম
✅ QR Code জেনারেশন
✅ পাবলিক শেয়ারিং লিঙ্ক
✅ Admin Dashboard
✅ User Management
✅ Trial Management

## Architecture

```
elite-paint-voucher/
├── src/
│   └── index.js (Main Worker)
├── functions/
│   ├── auth.js
│   ├── voucher.js
│   ├── suggest.js
│   └── admin.js
├── public/
│   ├── index.html (Main App)
│   ├── admin.html
│   ├── app.js
│   ├── admin.js
│   ├── voucher-renderer.js
│   ├── public-viewer.js
│   └── styles.css
├── shared/
│   ├── db.js (D1 Queries)
│   ├── auth.js (Auth Logic)
│   └── utils.js (Utilities)
├── migrations/
│   └── 001_initial_schema.sql
├── package.json
└── wrangler.toml
```

## API Documentation

### Authentication

- `POST /auth/login` - Google OAuth redirect
- `GET /auth/callback` - OAuth callback handler
- `POST /auth/logout` - Logout user
- `GET /auth/user` - Get current user info

### Vouchers

- `POST /api/voucher/create` - Create new voucher
- `GET /api/voucher/:id` - Get voucher details
- `GET /api/voucher/all` - Get all user vouchers
- `GET /api/v/:public_id` - Get public voucher view

### Suggestions

- `GET /api/suggest/:type` - Get suggestions (payto, code, ac, particulars)
- `POST /api/suggest/:type` - Add to suggestion list

### Admin

- `GET /api/admin/users` - List all users
- `POST /api/admin/user/block` - Block/unblock user
- `POST /api/admin/user/extend-trial` - Extend user trial
- `POST /api/admin/user/login-as` - Login as user

## Troubleshooting

### Database Connection Issues

```bash
wrangler d1 info elite-voucher
```

### Session Issues

KV Namespace IDs সঠিক আছে কিনা চেক করুন:

```bash
wrangler kv:namespace list
```

### OAuth Issues

- Redirect URI সঠিক আছে কিনা নিশ্চিত করুন
- Client ID এবং Secret সঠিক আছে কিনা যাচাই করুন

## Performance Tips

1. **Public Voucher Caching**: KV-তে কেশ করুন
2. **Database Indexing**: Frequently queried fields এ ইন্ডেক্স কণ্ঠস্বর
3. **CDN Optimization**: Cloudflare Pages এর CDN ব্যবহার করুন
4. **Font Loading**: Google Fonts async load করুন

## Security Considerations

1. Google OAuth এর মাধ্যমে সকল লগইন
2. Session tokens সাইনড এবং এনক্রিপ্টেড
3. HTTPS সব সময় enforce করুন
4. CSRF protection সব forms এ
5. SQL injection থেকে সুরক্ষিত (parameterized queries)

## Backup & Disaster Recovery

```bash
# Export D1 data
wrangler d1 execute elite-voucher --remote --command "SELECT * FROM vouchers" --json > backup.json

# Restore process (manually import)
```

## Support & Documentation

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare KV Docs](https://developers.cloudflare.com/kv/)
