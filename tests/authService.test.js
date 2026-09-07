import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthService } from '../src/services/authService.js';
import { authErrorMessage } from '../src/features/auth/errors.js';
import { validateRegistration, validatePassword, safeReturnPath } from '../src/features/auth/validation.js';

const valid = { fullName: ' Nguyễn An ', email: ' AN@EXAMPLE.COM ', phone: '090 123 4567', password: 'Strongpass123', confirmPassword: 'Strongpass123' };

function fakeAuth() {
  const calls = [];
  const auth = {};
  for (const method of ['signUp', 'signInWithPassword', 'signOut', 'resetPasswordForEmail', 'updateUser', 'getSession']) {
    auth[method] = async (...args) => {
      calls.push({ method, args });
      return { data: method === 'getSession' ? { session: { user: { id: 'user' } } } : { user: { id: 'user' }, session: null }, error: null };
    };
  }
  let callback;
  let unsubscribed = false;
  auth.onAuthStateChange = listener => {
    callback = listener;
    return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
  };
  return { client: { auth }, calls, emit: (...args) => callback(...args), isUnsubscribed: () => unsubscribed };
}

test('signup normalizes fields and never forwards user-supplied role', async () => {
  const fake = fakeAuth();
  const result = await createAuthService(fake.client).register({ ...valid, role: 'admin' }, 'https://concert.example/login');
  assert.equal(result.session, null, 'confirmation-required signup is not treated as logged in');
  assert.deepEqual(fake.calls[0].args[0], {
    email: 'an@example.com', password: valid.password,
    options: { emailRedirectTo: 'https://concert.example/login', data: { full_name: 'Nguyễn An', phone: '0901234567' } },
  });
});

test('login, reset, password update, local logout and session restoration use the auth SDK', async () => {
  const fake = fakeAuth();
  const service = createAuthService(fake.client);
  await service.login(valid);
  await service.requestPasswordReset(valid.email, 'https://concert.example/reset-password');
  await service.updatePassword('Newpassword123');
  await service.logout();
  assert.equal((await service.getSession()).session.user.id, 'user');
  assert.deepEqual(fake.calls[0].args[0], { email: 'an@example.com', password: valid.password });
  assert.deepEqual(fake.calls[1].args, ['an@example.com', { redirectTo: 'https://concert.example/reset-password' }]);
  assert.deepEqual(fake.calls[2].args, [{ password: 'Newpassword123' }]);
  assert.deepEqual(fake.calls[3].args, [{ scope: 'local' }]);
});

test('listener forwards recovery and signout events and can unsubscribe', () => {
  const fake = fakeAuth();
  const events = [];
  const subscription = createAuthService(fake.client).subscribe((event, session) => events.push([event, session]));
  fake.emit('PASSWORD_RECOVERY', { user: { id: 'u' } });
  fake.emit('SIGNED_OUT', null);
  subscription.unsubscribe();
  assert.equal(events[0][0], 'PASSWORD_RECOVERY');
  assert.deepEqual(events[1], ['SIGNED_OUT', null]);
  assert.equal(fake.isUnsubscribed(), true);
});

test('service failures map to Vietnamese without leaking raw messages', async () => {
  const service = createAuthService({ auth: { signInWithPassword: async () => ({ error: { code: 'invalid_credentials', message: 'raw backend error' } }) } });
  await assert.rejects(service.login(valid), error => authErrorMessage(error) === 'Email hoặc mật khẩu chưa đúng.');
  assert.equal(authErrorMessage({ message: 'secret raw diagnostic' }).includes('secret'), false);
  assert.throws(() => createAuthService(null).getSession(), { code: 'not_configured' });
});

test('profile update payload excludes roles and immutable columns', async () => {
  let payload;
  let requestedId;
  const query = {
    update: value => { payload = value; return query; },
    eq: (_column, id) => { requestedId = id; return query; },
    select: () => query,
    single: async () => ({ data: { id: requestedId }, error: null }),
  };
  await createAuthService({ from: () => query }).updateProfile('user-1', {
    full_name: 'An', phone: '0901234567', avatar_url: null, role: 'admin', id: 'other',
  });
  assert.deepEqual(payload, { full_name: 'An', phone: '0901234567', avatar_url: null });
  assert.equal(requestedId, 'user-1');
});

test('registration validation and internal return paths reject invalid input', () => {
  assert.deepEqual(validateRegistration(valid), {});
  const errors = validateRegistration({ fullName: '', email: 'invalid', phone: 'abc', password: 'short', confirmPassword: '' });
  assert.equal(Object.keys(errors).length, 5);
  assert.notEqual(validatePassword('abcdefgh'), '');
  assert.notEqual(validatePassword('Strongpass123', 'different'), '');
  for (const path of ['https://evil.example', '//evil.example', '/\\evil.example', '/login', null]) assert.equal(safeReturnPath(path), '/profile');
  assert.equal(safeReturnPath('/my-tickets'), '/my-tickets');
});
