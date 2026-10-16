import { createClient } from '@supabase/supabase-js';

// Read Supabase environment variables if available
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Helper to sign up with Supabase Auth or Backend Fallback
 */
export async function supabaseSignUp({ email, password, username }) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username }
        }
      });
      if (error) throw error;
      return { success: true, data, provider: 'supabase' };
    } catch (err) {
      console.warn('Supabase Auth signup failed, falling back to backend:', err.message);
    }
  }
  return null;
}

/**
 * Helper to sign in with Supabase Auth
 */
export async function supabaseSignIn({ email, password }) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return { success: true, data, provider: 'supabase' };
    } catch (err) {
      console.warn('Supabase Auth signin failed, falling back to backend:', err.message);
    }
  }
  return null;
}
