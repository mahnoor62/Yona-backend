const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

/**
 * Admin client — uses service role key.
 * Has full database access and bypasses RLS.
 * Never expose this key to clients.
 */
const supabaseAdmin = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Anon client — uses public anon key.
 * Used for operations that should respect RLS, such as signInWithPassword,
 * which properly enforces email confirmation checks.
 */
const supabaseAnon = createClient(env.supabase.url, env.supabase.anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabaseAdmin, supabaseAnon };
