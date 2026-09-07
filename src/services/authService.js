import { supabase } from '../lib/supabase.js';
import { normalizeEmail } from '../features/auth/validation.js';

export function createAuthService(client = supabase) {
  function requireClient() {
    if (!client) throw Object.assign(new Error('Auth is not configured'), { code: 'not_configured' });
    return client;
  }
  async function unwrap(request) {
    const { data, error } = await request;
    if (error) throw error;
    return data;
  }
  const profileFields = 'id, full_name, phone, avatar_url, role, created_at, updated_at';
  return {
    isConfigured: Boolean(client),
    getSession: () => unwrap(requireClient().auth.getSession()),
    subscribe: callback => requireClient().auth.onAuthStateChange(callback).data.subscription,
    login: ({ email, password }) => unwrap(requireClient().auth.signInWithPassword({ email: normalizeEmail(email), password })),
    register: ({ fullName, email, phone, password }, redirectTo) => unwrap(requireClient().auth.signUp({
      email: normalizeEmail(email), password,
      options: {
        emailRedirectTo: redirectTo,
        data: { full_name: fullName.trim(), phone: phone.replace(/[\s().-]/g, '') },
      },
    })),
    logout: async () => { await unwrap(requireClient().auth.signOut({ scope: 'local' })); },
    requestPasswordReset: (email, redirectTo) => unwrap(requireClient().auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo })),
    updatePassword: password => unwrap(requireClient().auth.updateUser({ password })),
    getProfile: (id, signal) => unwrap(requireClient().from('profiles').select(profileFields).eq('id', id).abortSignal(signal).maybeSingle()),
    updateProfile: (id, { full_name, phone, avatar_url }) => unwrap(requireClient().from('profiles')
      .update({ full_name, phone, avatar_url }).eq('id', id).select(profileFields).single()),
  };
}

export const authService = createAuthService();
