# Phase 3: Supabase Authentication

## Apply the migration

Run [migrations/202609080001_auth_profiles.sql](migrations/202609080001_auth_profiles.sql) once in your project's SQL Editor, after the Phase 2 migration. It is transactional.

The migration creates:

- `public.profiles`, keyed by `auth.users.id`, with name, phone, avatar URL, role and timestamps.
- An insert trigger that creates a profile for every new Auth user.
- A backfill for accounts created before this migration.
- A timestamp trigger for profile updates.
- Own-profile SELECT and UPDATE policies for authenticated users. Anonymous clients have no access.
- Column-level UPDATE grants limited to `full_name`, `phone` and `avatar_url`. Browser clients cannot change `role`, `id`, `created_at` or `updated_at`, insert profiles or delete them.

The signup trigger uses a fixed empty search path and qualified table names. It always assigns `user`, regardless of signup metadata. There is no public role-management API. Even an admin profile cannot read other private profiles with these policies.

Only a trusted operator using the SQL Editor can assign a role, for example:

```sql
update public.profiles
set role = 'admin'
where id = 'REPLACE_WITH_AUTH_USER_UUID';
```

The admin route remains a placeholder. Future admin APIs will need their own server/database authorization; a React route guard is not a security boundary.

## Dashboard settings

1. Under Authentication, enable the Email provider and email/password signup.
2. Enable email confirmation for production. Signup handles both confirmation-required and immediate-session configurations.
3. Set a minimum password length of at least 8. The form requires 8-128 characters, including letters and numbers. Stronger dashboard policies are supported through translated error messages.
4. In Authentication > URL Configuration, set the Site URL to the deployed website origin. For local development, use the origin printed by Vite, for example `http://127.0.0.1:5173`.
5. Add these exact development redirect URLs, plus their production equivalents:

   ```text
   http://127.0.0.1:5173/login
   http://127.0.0.1:5173/reset-password
   http://localhost:5173/login
   http://localhost:5173/reset-password
   ```

   If Vite selects another port, add that port too. Signup redirects to `/login`; password recovery redirects to `/reset-password`. The app builds these URLs from the current browser origin.
6. Keep the standard confirmation/recovery email links using `{{ .ConfirmationURL }}`. This browser-only app uses Supabase's implicit redirect flow. No server callback endpoint or custom token-exchange template is needed.
7. Configure custom SMTP for real users and set appropriate email rate limits. Supabase's default mail service is restricted and should not be relied on for production delivery. Localize confirmation and recovery email subjects/body in the dashboard if the email experience must also be Vietnamese.

The existing `.env.local` values continue to work:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
VITE_CONCERT_SLUG=the-next-live-concert-2026
```

Never put a secret or service-role key in a `VITE_` variable. Restart Vite after changing environment values. Configure your production host's SPA fallback to `index.html` so emailed links work when opened directly.

## Auth flow

- Register: validate name/email/phone/password confirmation; call `signUp` with only name and phone metadata. A confirmation-required signup displays a neutral check-email message. A returned session opens the profile.
- Login: `signInWithPassword`; the auth listener updates the navbar and restores the internal route that originally required login.
- Persistence: the existing Supabase client persists sessions, refreshes tokens and handles email-link URLs. There is no separate remember-me storage or custom token copy.
- Session listener: synchronous callback updates React state. Private profile queries run in a separate effect to avoid SDK lock conflicts. Stale profile responses are ignored on account changes or unmount.
- Profile: shows the signed-in email, name, phone and avatar placeholder. Profile errors can be retried; logout remains available. Profile editing and avatar upload UI are not part of this phase.
- Logout: sign out this browser's session with `scope: 'local'`. Other devices stay signed in. The SDK notifies the other tabs sharing this browser storage.
- Recovery: request an email at `/forgot-password`; the link opens `/reset-password`. A `PASSWORD_RECOVERY` event also directs the user there. The user sets a new password with `updateUser`, then sees confirmation on their profile. An invalid/expired link offers a new reset request.
- Protected routes: `/profile` and `/my-tickets` require a session. `/admin` also requires a successfully loaded profile with role `admin`.
- All public form/state messages are Vietnamese. Raw backend errors are mapped to approved messages, not printed in the UI.

## Manual verification

1. Apply the migration and dashboard settings, then run `npm run dev`.
2. Open `/profile` signed out. Expect a redirect to login; no private content should appear.
3. Register with an email address you control, a full name, valid phone and matching password. Invalid fields should prevent submission.
4. With email confirmation enabled, inspect your inbox/spam folder and follow the confirmation link. Confirm a profile row was created with role `user` and the submitted name/phone.
5. Log in. The navbar should say **Tài khoản**, and `/profile` should show your email/name/phone.
6. Refresh the page and open a second tab on the same origin. Both should retain the session. Log out; protected pages should return to login.
7. Try a wrong password and an unconfirmed email. Expect natural Vietnamese messages with no raw Supabase diagnostics.
8. Request password recovery for your own address. Open the email link, set a different valid password, log out, then log in with the new password. The old password should fail.
9. Try an expired/used reset link in a signed-out browser. Expect a new-link action, not a working password form.
10. Use a second account to verify isolation. Neither account should be able to read or update the other's profile. A normal user must not access `/admin` or see admin navigation.
11. Optionally assign an admin role using trusted SQL, then refresh that user's session/page. The profile and mobile menu expose the admin entry, which still leads only to the placeholder page.

Do not publish real user emails, passwords or private profile data in test output.

## Automated checks and changed files

```sh
npm test
npm run lint
npm run build
```

The suite tests service calls, signup validation, safe error mapping, recovery redirects, session restoration, stale request handling, route guards, profile isolation, role grants, trigger behavior, backfill and cascade deletion. Database tests execute SQL in local PGlite with stand-in `auth.users` and `auth.uid()`; they do not change the hosted project. React tests use the real provider/guard components through a development-only JSX runner and renderer. All application sources remain JavaScript.

Created:

```text
supabase/migrations/202609080001_auth_profiles.sql
supabase/AUTH.md
src/contexts/AuthContext.js
src/contexts/AuthProvider.jsx
src/hooks/useAuth.js
src/services/authService.js
src/components/ProtectedRoute.jsx
src/features/auth/AuthForm.jsx
src/features/auth/AuthRecoveryRedirect.jsx
src/features/auth/errors.js
src/features/auth/validation.js
src/features/auth/useAuthForm.js
src/pages/ForgotPasswordPage.jsx
src/pages/ResetPasswordPage.jsx
tests/authService.test.js
tests/authComponents.test.js
tests/profiles.test.js
tests/tsconfig.json
```

Modified:

```text
src/lib/supabase.js
src/main.jsx
src/router.jsx
src/layouts/MainLayout.jsx
src/components/Navbar.jsx
src/pages/LoginPage.jsx
src/pages/RegisterPage.jsx
src/pages/ProfilePage.jsx
package.json
package-lock.json
supabase/README.md
```

Official documentation: [password authentication](https://supabase.com/docs/guides/auth/passwords), [profile triggers](https://supabase.com/docs/guides/auth/managing-user-data), [auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
