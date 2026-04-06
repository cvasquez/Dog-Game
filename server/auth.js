import { createRemoteJWKSet, jwtVerify } from 'jose';

const SUPABASE_URL = process.env.SUPABASE_URL;

// Fetch signing keys from Supabase's JWKS endpoint (cached automatically by jose)
const jwks = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;

/**
 * Express middleware that requires a valid Supabase JWT with admin role.
 * Verifies the token against Supabase's JWKS endpoint (no legacy secret needed)
 * and checks app_metadata.role === 'admin'.
 */
export async function requireAdmin(req, res, next) {
  if (!jwks) {
    console.error('SUPABASE_URL not set — admin routes are disabled');
    return res.status(503).json({ error: 'Auth not configured' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${SUPABASE_URL}/auth/v1`,
    });
    if (payload.app_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
