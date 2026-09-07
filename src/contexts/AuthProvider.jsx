import { useCallback, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { authService } from '../services/authService';

export default function AuthProvider({ children, service = authService }) {
  const [auth, setAuth] = useState({ status: 'loading', session: null });
  const [profileState, setProfileState] = useState({ userId: null, status: 'idle', data: null });
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const userId = auth.session?.user?.id ?? null;
  const retryAuth = useCallback(() => { setAuth({ status: 'loading', session: null }); setAttempt(value => value + 1); }, []);
  const retryProfile = useCallback(() => { setProfileState({ userId: null, status: 'idle', data: null }); setProfileAttempt(value => value + 1); }, []);
  const completeRecovery = useCallback(() => setRecoveryRequired(false), []);

  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    let subscription;
    // Keep the listener synchronous: profile queries run in a separate effect.
    function accept(event, session) {
      if (!active) return;
      receivedEvent = true;
      setAuth({ status: 'ready', session });
      if (event === 'PASSWORD_RECOVERY') setRecoveryRequired(true);
      if (event === 'SIGNED_OUT') {
        setRecoveryRequired(false);
        setProfileState({ userId: null, status: 'idle', data: null });
      }
    }
    const timeout = window.setTimeout(() => {
      if (active && !receivedEvent) setAuth({ status: 'error', session: null });
    }, 15000);
    try {
      subscription = service.subscribe(accept);
      service.getSession().then(({ session }) => {
        if (active && !receivedEvent) setAuth({ status: 'ready', session });
      }).catch(() => {
        if (active && !receivedEvent) setAuth({ status: 'error', session: null });
      }).finally(() => window.clearTimeout(timeout));
    } catch {
      window.clearTimeout(timeout);
      setAuth({ status: 'error', session: null });
    }
    return () => { active = false; window.clearTimeout(timeout); subscription?.unsubscribe(); };
  }, [attempt, service]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const controller = new window.AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    service.getProfile(userId, controller.signal).then(data => {
      if (active) setProfileState({ userId, status: data ? 'ready' : 'missing', data });
    }).catch(() => {
      if (active) setProfileState({ userId, status: 'error', data: null });
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [userId, profileAttempt, service]);

  // Never expose the previous account's profile while a new account is loading.
  const currentProfile = userId && profileState.userId === userId ? profileState : null;
  return <AuthContext.Provider value={{
    ...auth, user: auth.session?.user ?? null, profile: currentProfile?.data ?? null,
    profileStatus: userId ? currentProfile?.status ?? 'loading' : 'idle',
    recoveryRequired, completeRecovery, retryAuth, retryProfile,
  }}>{children}</AuthContext.Provider>;
}
