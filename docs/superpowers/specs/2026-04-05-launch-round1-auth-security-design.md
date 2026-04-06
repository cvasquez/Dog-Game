# Round 1: Auth, Security & Code Cleanup

**Date:** 2026-04-05
**Status:** Draft
**Scope:** Admin authentication, security hardening, Supabase RLS lockdown, code cleanup
**Out of scope:** Fly.io deployment (Round 2)

## Context

The Dog Game is preparing for public multiplayer launch. Currently:
- Admin interfaces (`/admin/`, `/editor/`) are completely unprotected
- All Supabase RLS policies allow anyone to INSERT/UPDATE/DELETE all data
- Mutation API endpoints (`PUT /api/decoration-sprites/:id`, `POST /api/sync-sprite-file`) have no auth
- No CORS or CSP headers configured
- `escapeHtml` is duplicated in 3 files
- Supabase credentials are hardcoded in client HTML

Players remain anonymous (no accounts). Only admin access needs auth.

## Phase 1: Code Cleanup

### 1.1 Extract shared `escapeHtml`

Create `client/js/utils.js` exporting `escapeHtml`. Update these files to import it:
- `client/js/shop.js` (line 18)
- `client/js/hud.js` (line 3)
- `client/editor/index.html` (line 1259)

### 1.2 Make Supabase config server-driven

Add `GET /api/config` to `server/index.js`:
```js
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  });
});
```

In `client/index.html` and `client/editor/index.html`, fetch config from this endpoint with a fallback to the current hardcoded values (needed for GitHub Pages where there's no server).

## Phase 2: Admin Authentication via Supabase Auth

### 2.1 Supabase dashboard setup (manual)

- Ensure Email/Password auth is enabled
- Create admin user in Authentication > Users
- Set admin role:
  ```sql
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
  WHERE email = 'your@email.com';
  ```

### 2.2 Admin login page

**New file:** `client/admin/login.html`

- Styled to match game aesthetic (earthy tones, Press Start 2P font)
- Email/password form using Supabase JS SDK `signInWithPassword()`
- On success: Supabase SDK stores session in localStorage, redirects to `/admin/index.html`
- Shared login page for both admin panel and editor

### 2.3 Client-side auth gates

Add auth check at the top of `client/admin/index.html` and `client/editor/index.html`:

```js
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data: { session } } = await sb.auth.getSession();
if (!session || session.user.app_metadata?.role !== 'admin') {
  window.location.href = '/admin/login.html';
}
```

This is a UX gate — real security is server-side (2.4).

### 2.4 Server-side auth middleware

**New file:** `server/auth.js`

- Verify Supabase JWT using `jsonwebtoken` package + `SUPABASE_JWT_SECRET` env var
- Check `payload.app_metadata.role === 'admin'`
- Export `requireAdmin(req, res, next)` middleware

**New dependency:** `jsonwebtoken`

### 2.5 Protect mutation endpoints

In `server/index.js`, apply `requireAdmin` middleware:
- `PUT /api/decoration-sprites/:id`
- `POST /api/sync-sprite-file`

### 2.6 Update editor API calls

In `client/editor/index.html`, add `Authorization: Bearer <token>` header to:
- `fetch('/api/sync-sprite-file', ...)`
- `fetch('/api/decoration-sprites/...', { method: 'PUT', ... })`

Get token from `sb.auth.getSession()`.

## Phase 3: Security Hardening

### 3.1 CORS configuration

In `server/index.js`, add CORS middleware:
- Allow origins: `CORS_ORIGIN` env var, `https://cvasquez.github.io`, localhost for dev
- Allow headers: `Content-Type, Authorization`
- Allow methods: `GET, POST, PUT, OPTIONS`
- Handle preflight `OPTIONS` requests

### 3.2 Content-Security-Policy

Add CSP header to existing security headers block:
- `default-src 'self'`
- `script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'` (inline needed for admin/editor)
- `style-src 'self' https://fonts.googleapis.com 'unsafe-inline'`
- `font-src 'self' https://fonts.gstatic.com`
- `connect-src 'self' https://*.supabase.co wss://*`
- `img-src 'self' data: blob:`

### 3.3 HTTP rate limiting

Simple in-memory rate limiter (no dependency) on mutation endpoints:
- `PUT /api/decoration-sprites/:id` — 30 req/min
- `POST /api/sync-sprite-file` — 10 req/min

### 3.4 WebSocket origin validation

Add `verifyClient` to WebSocketServer that checks origin against allowed origins. Allow null origin for non-browser clients.

## Phase 4: Supabase RLS Lockdown

### 4.1 Restrict mutation policies

Drop existing permissive policies and replace with admin-only:

```sql
-- For custom_sprites, decoration_sprites, shop_sprites:
-- Keep SELECT as-is (public read)
-- INSERT/UPDATE/DELETE require authenticated admin:
CREATE POLICY "Admins can mutate" ON <table>
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );
```

### 4.2 Update supabase-schema.sql

Replace all "Anyone can..." policies with admin-restricted versions. This file is the source of truth.

### 4.3 Update seed scripts

Seed scripts (`scripts/seed-*.js`) need to use `SUPABASE_SERVICE_KEY` (service role bypasses RLS) instead of the anon key. Add fallback: `process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY`.

## New Files

| File | Purpose |
|------|---------|
| `server/auth.js` | Admin JWT verification middleware |
| `client/admin/login.html` | Admin login page |
| `client/js/utils.js` | Shared utility functions (escapeHtml) |

## New Dependencies

| Package | Purpose |
|---------|---------|
| `jsonwebtoken` | Server-side JWT verification |

## New Environment Variables

| Variable | Purpose |
|----------|---------|
| `SUPABASE_JWT_SECRET` | Verify admin JWTs server-side |
| `CORS_ORIGIN` | Allowed CORS origin for production domain |
| `SUPABASE_SERVICE_KEY` | For seed scripts (bypasses RLS) |

## Critical Files Modified

| File | Changes |
|------|---------|
| `server/index.js` | CORS, CSP, rate limiting, `/api/config`, auth middleware on routes, WebSocket origin check, health endpoint |
| `client/admin/index.html` | Auth gate script at top |
| `client/editor/index.html` | Auth gate script, Authorization headers on fetch calls |
| `client/index.html` | Fetch Supabase config from server with hardcoded fallback |
| `client/js/shop.js` | Import escapeHtml from utils.js |
| `client/js/hud.js` | Import escapeHtml from utils.js |
| `supabase-schema.sql` | Rewritten RLS policies |
| `scripts/seed-*.js` | Use SUPABASE_SERVICE_KEY |

## Verification

1. **Auth flow:** Create admin user in Supabase, visit `/admin/` → redirected to login → login → access granted
2. **Auth enforcement:** Try `PUT /api/decoration-sprites/1` without token → 401. With non-admin token → 403. With admin token → success
3. **RLS:** Try inserting a sprite row via Supabase client with anon key → denied. With admin session → success
4. **CORS:** Make cross-origin fetch from a different domain → blocked unless in allowlist
5. **CSP:** Check browser console for CSP violations — should be none for normal operation
6. **Game still works:** Single-player on GitHub Pages unaffected. Multiplayer WebSocket connections still work without auth
7. **Editor still works:** After admin login, sprite editor can save to both Supabase and server file
