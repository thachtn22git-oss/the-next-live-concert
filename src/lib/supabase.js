import { createClient } from '@supabase/supabase-js';

const env = import.meta.env ?? {};
const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

// Capture only the failure flag before the SDK consumes the email-link URL.
const callbackUrl = typeof window === 'undefined' ? null : new URL(window.location.href);
export const authCallbackError = Boolean(callbackUrl && (
  callbackUrl.searchParams.has('error') || new globalThis.URLSearchParams(callbackUrl.hash.slice(1)).has('error')
));

function createPublicClient() {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project')
    || supabaseAnonKey === 'your-supabase-anon-key') return null;
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch {
    return null;
  }
}

export const supabase = createPublicClient();
