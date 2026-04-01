// Supabase client configuration
// Replace these with your actual Supabase project values
const SUPABASE_URL = window.SUPABASE_URL || 'https://qwvmbmjanuyinlqzmymt.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'sb_publishable_TL41nSN0-SyAvpd3xgHUlw_N7fRqQIO';

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
  return !SUPABASE_URL.includes('YOUR_PROJECT');
}
