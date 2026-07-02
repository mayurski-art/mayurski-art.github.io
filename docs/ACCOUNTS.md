# TrollRunner Accounts — real auth, profiles, XP, and sync

The account system is Supabase Auth + Postgres RLS (same project that already
runs TrollChat and the site lock). No secrets live in this repo: the anon key
is public by design, and every privilege is enforced server-side by Row Level
Security.

## One-time setup

1. **Supabase dashboard → Authentication → Sign In / Up → Email**: turn OFF
   *"Confirm email"*. Accounts log in through synthetic mailboxes
   (`u_<username>@login.trollrunner.net`) that have no inbox to confirm.
2. **Supabase dashboard → SQL Editor**: paste and run
   [`assets/supabase/troll_accounts.sql`](../assets/supabase/troll_accounts.sql)
   (idempotent — safe to re-run). It creates tables, policies, XP/leaderboard
   functions, the avatar storage bucket, and the TrollChat identity policies.

Until step 2 runs, login correctly rejects everyone (verified: random
credentials show "Wrong username or password." and do not enter the site);
registration will fail with a database error because the profile trigger
doesn't exist yet.

### Password recovery setup (three more one-time steps)

3. **SQL Editor**: run
   [`assets/supabase/troll_recovery.sql`](../assets/supabase/troll_recovery.sql)
   — adds `troll_login_email(username, password)`, the password-verified
   username→email lookup that keeps username login working for accounts whose
   auth email is a real address.
4. **Authentication → URL Configuration**: Site URL
   `https://www.trollrunner.net`, and add `https://www.trollrunner.net/*` to
   Redirect URLs (reset links bounce through here).
5. **Authentication → Email**: turn OFF *"Secure email change"* — adding a
   recovery email then needs only one confirmation click (the old synthetic
   mailbox can never receive mail).

Note: Supabase's built-in mailer is rate-limited to a few emails per hour —
fine for now; plug in custom SMTP (Resend etc.) if reset volume ever grows.

## How password recovery works

- **Signup with an email** → that email *is* the auth email; Supabase can
  send it reset links. Signup without an email → synthetic mailbox, no
  self-serve recovery (the gate's recovery modal says to ping the admin).
- **Existing accounts** add a recovery email in **Settings → Recovery
  email** (`updateRecoveryEmail` calls `auth.updateUser({ email })`, so the
  auth email flips from synthetic to real; a confirmation email may arrive).
- **Username login** always tries the synthetic mailbox first; on a miss it
  calls the `troll_login_email` RPC, which returns the real auth email *only
  when the submitted password matches the stored bcrypt hash* (plus a 250 ms
  sleep), so it can't be used to harvest or enumerate emails.
- **"Forgot password?"** on the gate opens a modal → `resetPasswordForEmail`
  → the emailed link redirects to `https://www.trollrunner.net/?recovery=1`
  with tokens in the URL hash → `troll-accounts.js` swaps them for a session,
  scrubs the URL, and opens a "Set a new password" modal. The request modal
  always reports success (no account enumeration).

## Files

| File | Role |
|---|---|
| `assets/supabase/troll_accounts.sql` | Full backend: tables, RLS, RPCs, storage |
| `assets/js/troll-accounts.js` | Shared client lib → `window.TrollrunnerAccounts` (+ built-in Profile/Settings modals) |
| `index.html` (gate section) | Account portal UI: Login/Create Account tabs, logged-in panel |
| `index.html` (TrollChat section) | Chat posts as the account identity when logged in |

## Why fake login is impossible now

- The old "type anything and enter" handler is deleted. Login calls
  `supabase.auth.signInWithPassword`; only a correct password yields a JWT.
- Passwords are bcrypt-hashed by Supabase Auth — never stored or seen by us.
- Sessions are JWTs persisted by supabase-js. Editing localStorage can only
  fake the *appearance* of a session on that one device — every data read and
  write is re-authorized by Postgres RLS against a signed token.
- Guests can still browse via **▶ Press Enter** (the site's public content is
  static HTML; the gate is presentation, not a security boundary). Everything
  account-linked — profile edits, XP, stats, leaderboard rows, transactions —
  is protected by RLS, which is the real boundary.

## The client API (`window.TrollrunnerAccounts`)

```js
await TrollrunnerAccounts.register({ username, email /*optional*/, password });
await TrollrunnerAccounts.login({ identifier, password }); // throws on bad creds
await TrollrunnerAccounts.logout();
await TrollrunnerAccounts.getSession();       // backend-verified session | null
TrollrunnerAccounts.getCachedProfile();       // sync snapshot | null
await TrollrunnerAccounts.updateUsername('new_name');
await TrollrunnerAccounts.updatePassword('newpass123');
await TrollrunnerAccounts.updateRecoveryEmail('me@example.com'); // enables reset links
await TrollrunnerAccounts.requestPasswordReset('me@example.com'); // sends the link
TrollrunnerAccounts.openRecovery();           // "forgot password" modal
await TrollrunnerAccounts.uploadAvatar(file); // PNG/JPG/WebP → 256px square webp
TrollrunnerAccounts.openProfile();            // built-in modal
TrollrunnerAccounts.openSettings();           // username / avatar / recovery email / password / logout
```

Auth changes broadcast `window` event **`trollrunner:auth-changed`**
(`event.detail` = session or null). The gate and TrollChat already listen.

## XP + levels (server-side, idle-proof)

XP only enters through the `troll_award_xp` RPC. Every event type has a
cooldown **and** a daily cap enforced in Postgres, so idle tabs, refresh spam,
and bot loops earn nothing:

| Event | XP | Cooldown | Cap/day |
|---|---|---|---|
| `daily_login` | 10 | 20 h | 1 |
| `chat_post` | 2 | 2 min | 20 |
| `game_run` | 5 | 30 s | 60 |
| `high_score` | 20 | 30 s | 20 |
| `feedback_post` | 5 | 6 h | 2 |

Level = `floor(sqrt(xp / 50)) + 1` (L2 at 50 XP, L3 at 200, L5 at 800…).
Clients cannot write `xp`/`level` columns at all (column-level grants).

## Games + leaderboard integration

From any game (after loading supabase-js + troll-accounts.js):

```js
// Saves the run, updates high score, adds a leaderboard row, awards XP —
// all in one server-side RPC with rate limiting and score caps.
await TrollrunnerAccounts.recordGameResult('troll-dash', score, { character: 'muscular' });
```

- Guests: `recordGameResult` throws "Login required" — catch it and show
  "login to save your score" (guest play itself is unaffected).
- Read the board from the `troll_leaderboard_view` view — it joins live
  username/avatar/level, so entries update automatically when a user renames
  or changes avatar. This is the real provider for the leaderboard.js seam
  in trollrunner-games (keep `live=false` there until wired).
- Per-game score caps / submit intervals: add rows to `troll_game_config`.
- True anti-cheat (server-simulated score validation) needs an Edge Function
  later; the RPC's caps + rate limits are the current line of defense.

## TrollChat identity

- Logged in → the name field locks to the account username and posts carry
  `user_id`. RLS guarantees: an authed post's name **must** equal the
  account's current username, and guests **cannot** post under any registered
  username (case-insensitive). Impersonation is blocked at the database.
- Messages are text-only in the DOM (`textContent`, no innerHTML) — XSS-safe.
- Historical messages keep the name they were posted with.

## USDC / $TROLL spend tracking

`troll_transactions` accepts only **pending** rows from clients
(`logPendingSpend({...})` after a TrollPay payment, with the tx signature).
Nothing client-side can mark a row `confirmed` — that needs a service-role
verifier (Edge Function) that checks the signature on-chain. The profile
modal's "Confirmed support" totals count only confirmed rows, so the frontend
can never fake donations. No private keys or seed phrases anywhere; future
wallet-linking must use a signed-message verification flow.

## Cross-subdomain identity

One Supabase project = one user ID across the whole ecosystem. Any sibling
site (games., garden., …) gets the same accounts by loading:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://www.trollrunner.net/assets/js/troll-accounts.js"></script>
```

Today each subdomain holds its own session (users log in once per subdomain,
same account — never separate accounts). Single sign-on across
`*.trollrunner.net` is a later upgrade: swap the client's `storage` for a
cookie adapter scoped to `Domain=.trollrunner.net` (chunked cookies, like
Supabase's SSR helpers). The seam is ready — only `getClient()` in
troll-accounts.js changes.

## Still to build (deliberately not faked)

- **Transaction confirmation** — Edge Function verifying Solana signatures,
  then setting `status='confirmed'` + awarding donation XP (service role).
- **Cross-subdomain cookie session**, **admin/moderation tools** (ban, rename,
  score audits — add an `is_moderator` claim later), **badges**.
