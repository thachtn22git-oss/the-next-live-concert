import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext } from '../src/contexts/AuthContext.js';
import AuthProvider from '../src/contexts/AuthProvider.jsx';
import ProtectedRoute from '../src/components/ProtectedRoute.jsx';
import AuthRecoveryRedirect from '../src/features/auth/AuthRecoveryRedirect.jsx';
import { useAuth } from '../src/hooks/useAuth.js';

const h = React.createElement;
const base = { status: 'ready', user: null, profile: null, profileStatus: 'idle', retryAuth() {}, retryProfile() {} };

function LoginDestination() {
  const location = useLocation();
  return h('p', null, 'Đăng nhập: ' + location.state?.from);
}

async function renderGuard(value, requiredRole) {
  let view;
  await act(async () => {
    view = create(h(AuthContext.Provider, { value: { ...base, ...value } },
      h(MemoryRouter, { initialEntries: ['/profile'], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
        h(Routes, null,
          h(Route, { path: '/profile', element: h(ProtectedRoute, { requiredRole }, h('p', null, 'Hồ sơ riêng tư')) }),
          h(Route, { path: '/login', element: h(LoginDestination) }),
        ),
      ),
    ));
  });
  return view;
}

test('protected route waits for restoration and redirects guests with return path', async () => {
  let view = await renderGuard({ status: 'loading' });
  assert.match(JSON.stringify(view.toJSON()), /Đang tải/);
  assert.doesNotMatch(JSON.stringify(view.toJSON()), /Hồ sơ riêng tư/);
  act(() => view.unmount());
  view = await renderGuard({});
  assert.match(JSON.stringify(view.toJSON()), /Đăng nhập: \/profile/);
  act(() => view.unmount());
});

test('protected route allows signed-in users and denies non-admins', async () => {
  let view = await renderGuard({ user: { id: 'user' } });
  assert.match(JSON.stringify(view.toJSON()), /Hồ sơ riêng tư/);
  act(() => view.unmount());
  view = await renderGuard({ user: { id: 'user' }, profileStatus: 'ready', profile: { role: 'user' } }, 'admin');
  assert.match(JSON.stringify(view.toJSON()), /Không có quyền truy cập/);
  act(() => view.unmount());
  view = await renderGuard({ user: { id: 'admin' }, profileStatus: 'ready', profile: { role: 'admin' } }, 'admin');
  assert.match(JSON.stringify(view.toJSON()), /Hồ sơ riêng tư/);
  act(() => view.unmount());
});

test('role guards fail closed when the private profile cannot be read', async () => {
  const view = await renderGuard({ user: { id: 'user' }, profileStatus: 'error' }, 'admin');
  assert.match(JSON.stringify(view.toJSON()), /Thử lại/);
  assert.doesNotMatch(JSON.stringify(view.toJSON()), /Hồ sơ riêng tư/);
  act(() => view.unmount());
});

test('recovery event routes the user to the password form', async () => {
  let view;
  await act(async () => {
    view = create(h(AuthContext.Provider, { value: { recoveryRequired: true } },
      h(MemoryRouter, { initialEntries: ['/profile'], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
        h(AuthRecoveryRedirect), h(Routes, null,
          h(Route, { path: '/profile', element: h('p', null, 'Hồ sơ') }),
          h(Route, { path: '/reset-password', element: h('p', null, 'Đặt lại mật khẩu') }),
        ),
      ),
    ));
  });
  assert.match(JSON.stringify(view.toJSON()), /Đặt lại mật khẩu/);
  act(() => view.unmount());
});

test('provider restores session, ignores stale initialization, clears profile on account changes and unsubscribes', async () => {
  const oldWindow = globalThis.window;
  globalThis.window = {
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    AbortController: globalThis.AbortController,
  };
  let listener;
  let resolveInitial;
  let resolveOldProfile;
  let unsubscribed = false;
  let current;
  function Observe() { current = useAuth(); return null; }
  const service = {
    subscribe(callback) { listener = callback; return { unsubscribe() { unsubscribed = true; } }; },
    getSession: () => new Promise(resolve => { resolveInitial = resolve; }),
    getProfile: id => id === 'first'
      ? new Promise(resolve => { resolveOldProfile = resolve; })
      : Promise.resolve({ id, full_name: 'Người thứ hai', role: 'user' }),
  };
  let view;
  try {
    await act(async () => { view = create(h(AuthProvider, { service }, h(Observe))); });
    assert.equal(current.status, 'loading');
    await act(async () => { listener('SIGNED_IN', { user: { id: 'first' } }); });
    assert.equal(current.profile, null);
    await act(async () => { listener('SIGNED_IN', { user: { id: 'second' } }); });
    await act(async () => {
      resolveInitial({ session: null });
      resolveOldProfile({ id: 'first', role: 'admin' });
    });
    assert.equal(current.user.id, 'second');
    assert.equal(current.profile.id, 'second');
    assert.equal(current.profile.role, 'user');
    await act(async () => { listener('PASSWORD_RECOVERY', { user: { id: 'second' } }); });
    assert.equal(current.recoveryRequired, true);
    await act(async () => { listener('SIGNED_OUT', null); });
    assert.equal(current.user, null);
    assert.equal(current.profile, null);
    assert.equal(current.recoveryRequired, false);
    act(() => view.unmount());
    assert.equal(unsubscribed, true);
  } finally {
    if (view) act(() => view.unmount());
    globalThis.window = oldWindow;
  }
});
