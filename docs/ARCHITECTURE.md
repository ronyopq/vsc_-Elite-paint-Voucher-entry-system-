# প্রযুক্তিগত আর্কিটেকচার এবং ডেটাবেস স্কিমা

## আর্কিটেকচার ওভারভিউ

```
┌─────────────────────────────────────────────┐
│         Cloudflare Pages (Frontend)         │
│  - HTML/CSS/JS                              │
│  - এলিট ভাউচার এন্ট্রি ইউআই               │
│  - Admin Dashboard                          │
│  - Public Voucher Viewer                    │
└────────┬────────────────────────────────────┘
         │ HTTPS
         │
┌────────▼────────────────────────────────────┐
│      Cloudflare Workers (Backend)           │
│  - OAuth Handler                            │
│  - Voucher API                              │
│  - Suggestions API                          │
│  - Admin API                                │
└────────┬────────────────────────────────────┘
         │
    ┌────┴────────────────────┐
    │                         │
┌───▼──────┐      ┌──────────▼──────┐
│ D1 DB    │      │  KV Storage     │
│          │      │                 │
│ Vouchers │      │ - Sessions      │
│ Users    │      │ - Cache         │
│ Logs     │      │ - Settings      │
└──────────┘      └─────────────────┘
```

## ডাটাবেস স্কিমা (D1)

### Users Table

```sql
users (
  id TEXT PRIMARY KEY,           -- Unique user ID
  google_id TEXT UNIQUE,         -- Google OAuth ID
  name TEXT,                     -- User's name
  email TEXT UNIQUE,             -- Email address
  role TEXT,                     -- 'user', 'admin', 'super_admin'
  trial_end DATETIME,            -- Trial expiration date
  is_blocked INTEGER,            -- 0=active, 1=blocked
  created_at DATETIME,           -- Account creation date
  updated_at DATETIME            -- Last update
)
```

### Vouchers Table

```sql
vouchers (
  id TEXT PRIMARY KEY,           -- Unique voucher ID
  user_id TEXT FOREIGN KEY,      -- Owner user ID
  public_id TEXT UNIQUE,         -- Shareable public ID
  date TEXT,                     -- Voucher date (YYYY-MM-DD)
  voucher_no TEXT,               -- Voucher number
  pay_to TEXT,                   -- Payee name
  code_no TEXT,                  -- Code/Reference number
  control_ac TEXT,               -- Control account
  particulars TEXT,              -- Details/Particulars
  amount REAL,                   -- Amount in Taka
  amount_words TEXT,             -- Amount in words (Bangla)
  account_no TEXT,               -- Account number
  payment_method TEXT,           -- Payment method
  prepared_by TEXT,              -- Preparer name (optional)
  verified_by TEXT,              -- Verifier name (optional)
  recommended_by TEXT,           -- Recommender name (optional)
  approved_by TEXT,              -- Approver name (optional)
  status TEXT,                   -- 'draft', 'saved', 'printed'
  print_count INTEGER,           -- Number of prints
  created_at DATETIME,           -- Creation date
  updated_at DATETIME            -- Last update
)
```

### Saved Lists Table

```sql
saved_lists (
  id TEXT PRIMARY KEY,           -- Unique ID
  user_id TEXT FOREIGN KEY,      -- User ID
  type TEXT,                     -- Type: payto, code, ac, particulars
  value TEXT,                    -- Saved value
  usage_count INTEGER,           -- Number of times used
  added_at DATETIME              -- Added date
)
```

### System Settings Table

```sql
system_settings (
  key TEXT PRIMARY KEY,          -- Setting key
  value TEXT,                    -- Setting value (JSON)
  updated_by TEXT,               -- Admin who updated
  updated_at DATETIME            -- Update date
)
```

### Audit Logs Table

```sql
audit_logs (
  id TEXT PRIMARY KEY,           -- Log ID
  user_id TEXT FOREIGN KEY,      -- User who performed action
  action TEXT,                   -- Action type
  entity_type TEXT,              -- Entity type (user, voucher, etc)
  entity_id TEXT,                -- Entity ID
  details TEXT,                  -- Additional details (JSON)
  ip_address TEXT,               -- Client IP
  created_at DATETIME            -- Timestamp
)
```

## KV Storage Structure

### Sessions (KV_SESSIONS)

```
Key: session:{hashed_token}
Value: {
  userId: "user_xxx",
  email: "user@example.com",
  name: "User Name",
  role: "user",
  trialEnd: "2025-03-23",
  isBlocked: false,
  createdAt: "2025-01-01T00:00:00Z",
  expiresAt: "2025-01-08T00:00:00Z"
}
TTL: 7 days
```

### CSRF Tokens (KV_SESSIONS)

```
Key: csrf:{hashed_token}
Value: "1"
TTL: 1 hour
```

### OAuth State (KV_SESSIONS)

```
Key: oauth_state:{state}
Value: "1"
TTL: 10 minutes
```

### Settings (KV_SETTINGS)

```
Key: global:print_offset
Value: { x: 0, y: 0 }

Key: global:font_scale
Value: "100"

Key: user:{user_id}:preferences
Value: { theme: "light", ... }
```

### Public Cache (KV_PUBLIC_CACHE)

```
Key: voucher:{public_id}:html
Value: HTML cached page
TTL: 1 hour

Key: voucher_views:{public_id}
Value: View count
TTL: 24 hours
```

## API Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "status": 400
}
```

## Voucher Field Coordinates (96 DPI)

Canvas: 797px × 542px = 8.3in × 5.65in

| Field | Position | Size | Font |
|-------|----------|------|------|
| Voucher No | (80, 45) | - | 18px |
| Date | (580, 45) | - | 18px |
| Pay To | (120, 110) | 480×30 | 18px |
| Control A/C | (120, 150) | 480×30 | 18px |
| Particulars | (70, 210) | 500×250 | 16px |
| Amount | (610, 210) | - | 20px |
| Account No | (610, 270) | - | 16px |
| Payment Method | (610, 310) | - | 16px |
| Amount Words | (120, 480) | 560×30 | 16px |
| QR Code | (650, 15) | 120×120 | - |
| Signatures | (80-590, 510) | - | 14px |

## সিকিউরিটি প্রোটোকল

1. **Authentication**
   - Google OAuth 2.0
   - Session-based auth with tokens
   - Hashed token storage in KV

2. **Authorization**
   - Role-based access control (RBAC)
   - User ownership verification
   - Admin-only endpoints protected

3. **Data Protection**
   - HTTPS/TLS encryption
   - Parameterized SQL queries
   - CSRF token validation
   - Input validation & sanitization

4. **Audit Trail**
   - All admin actions logged
   - User activity tracking
   - IP address recording

## Performance Optimization

1. **Database**
   - Indexed frequently queried fields
   - Pagination for large result sets
   - Connection pooling

2. **Caching**
   - Public voucher HTML caching (1 hour)
   - Suggestion list caching
   - CDN caching for static assets

3. **API**
   - Response compression
   - Request batching
   - Rate limiting on admin endpoints

## Scalability Considerations

- Cloudflare D1 scales automatically
- KV provides distributed caching
- Workers handle concurrent requests
- Stateless architecture for horizontal scaling
