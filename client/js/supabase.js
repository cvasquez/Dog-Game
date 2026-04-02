// Supabase client configuration
// Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY before loading, or configure via environment
const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

let _client = null;

export function getSupabaseClient() {
  if (_client) return _client;
  if (typeof window.supabase === 'undefined') {
    console.warn('Supabase JS SDK not loaded');
    return null;
  }
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _client;
}

export function isSupabaseConfigured() {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}
