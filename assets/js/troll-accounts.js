/* ============================================================================
   TROLLRUNNER ACCOUNTS — shared auth + profile client (Supabase).
   Loaded by trollrunner.net and sibling subdomains (same pattern as
   troll-notis.js). Requires supabase-js v2 (window.supabase) loaded first,
   and assets/supabase/troll_accounts.sql run once in the Supabase project.

   Public API: window.TrollrunnerAccounts
     getSession()                    → session | null   (backend-verified)
     register({username,email,password}) → session
     login({identifier,password})    → session          (throws on bad creds)
     logout()
     getCachedProfile()              → last known profile (sync, may be null)
     getAccessToken()                → JWT for authed REST calls | null
     getClient()                     → the supabase client
     updateUsername(next) / updatePassword(next) / uploadAvatar(file)
     updateRecoveryEmail(email) / requestPasswordReset(email) / openRecovery()
     connectWallet() → address | null   (opens Phantom, links it if logged in)
     getWalletAddress() / unlinkWallet()
     connectX()                      → starts the X (Twitter) OAuth link, navigates away
     getXIdentity() → {handle,name,avatarUrl} | null   /   unlinkX()
     awardXp(event, source, meta)    → server-guarded XP (cooldowns/caps)
     recordGameResult(gameId, score, meta)
     logPendingSpend({token,amount,wallet,signature,purpose,feature})
     openProfile() / openSettings()  → built-in modals

   Auth state changes dispatch:  window 'trollrunner:auth-changed'
   (event.detail = session | null)

   Security note: a session here is a Supabase JWT. Faking localStorage can
   only ever fake the *look* of being logged in on that device — every read/
   write of account data is re-checked by Postgres RLS server-side.
   ========================================================================= */
(function () {
  const SUPABASE_URL = 'https://tjsyhfplxjtakdfkpdtg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3loZnBseGp0YWtkZmtwZHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTc0ODksImV4cCI6MjA5MTk3MzQ4OX0.xLUcPUUguRBQttNwiIRWJHxjJjLqrQDMu4Ubsk5yZoQ';
  // Usernames sign in through a synthetic mailbox; a real email (optional)
  // lives privately in troll_user_settings for future password reset.
  const LOGIN_EMAIL_DOMAIN = 'login.trollrunner.net';
  const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const AVATAR_SIZE = 256;

  // Display names/icons for "recently played" — keyed by the same game_id
  // games already pass to recordGameResult(). Unknown ids fall back to the
  // raw id so a new game never breaks the list.
  const GAME_META = {
    'troll-kombat': { name: 'Troll Kombat', icon: '🥋' },
    'troll-casino': { name: 'Troll Casino', icon: '🎰' },
    'troll-pizzeria': { name: "Papa Troll's Pizzeria", icon: '🍕' },
    'bridge-patrol': { name: 'Bridge Patrol', icon: '🌉' },
    'trollrreria': { name: 'Trollrreria', icon: '⛏️' },
    'meme-metro': { name: 'Meme Metro', icon: '🚇' },
    'troll-high': { name: 'Troll High', icon: '🏫' },
  };
  function gameMeta(gameId) {
    return GAME_META[gameId] || { name: gameId, icon: '🕹️' };
  }

  // Password-reset links land on the main site (the only place with the
  // reset UI); local/preview hosts land on themselves for testing.
  function recoveryRedirectUrl() {
    const onTrollrunner = /(^|\.)trollrunner\.net$/i.test(location.hostname);
    const base = onTrollrunner ? 'https://www.trollrunner.net' : location.origin;
    return `${base}/?recovery=1`;
  }

  let client = null;
  let cachedProfile = null;
  let profilePromise = null;
  // Set by detectRecoveryLink() when the page just came back from an X
  // (Twitter) identity-link round trip; openSettings() reads + clears these.
  let justLinkedX = false;
  let lastXLinkError = null;

  /* ----------------------------------------------------------- cross-domain SSO
     Supabase's own session storage is localStorage, which is scoped per-origin --
     trollrunner.net and games.trollrunner.net never see each other's copy even
     though they're sibling subdomains of the same site. The iframe postMessage
     bridge below (initSsoBridge) covers pages embedded in the main site's desktop
     shell, but a subdomain opened directly (its own tab/popup, e.g. someone
     bookmarking games.trollrunner.net) is a top-level page, so that bridge never
     fires and the visitor silently looks logged-out there even with an active
     session elsewhere.
       Fix: every subdomain shares one registrable domain (trollrunner.net), so a
     cookie set with Domain=.trollrunner.net *is* visible to all of them on a
     normal top-level load, no embedding required. We mirror the current session's
     tokens into such a cookie on every auth change, and on init adopt it into this
     origin's own Supabase client if this origin doesn't already have a session.
     Same trust model as localStorage already documented above (a JWT re-verified
     server-side by RLS on every request) -- this isn't a new attack surface, just
     a wider read scope for the same token. Local/preview hosts (localhost, the
     raw *.github.io domain) don't get this cookie -- they fall back to per-origin
     localStorage only, same as before. */
  const SSO_COOKIE = 'trollrunner_sso';
  function ssoCookieDomain() {
    return /(^|\.)trollrunner\.net$/i.test(location.hostname) ? '.trollrunner.net' : null;
  }
  function writeSsoCookie(session) {
    const domain = ssoCookieDomain();
    if (!domain) return;
    if (!session) {
      document.cookie = `${SSO_COOKIE}=; Domain=${domain}; Path=/; Max-Age=0; SameSite=Lax; Secure`;
      return;
    }
    const value = encodeURIComponent(JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }));
    document.cookie = `${SSO_COOKIE}=${value}; Domain=${domain}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
  }
  function readSsoCookie() {
    const match = document.cookie.match(new RegExp(`(?:^|; )${SSO_COOKIE}=([^;]*)`));
    if (!match) return null;
    try { return JSON.parse(decodeURIComponent(match[1])); } catch { return null; }
  }
  async function adoptSsoCookie(sb) {
    if (!ssoCookieDomain()) return;
    const { data } = await sb.auth.getSession();
    if (data?.session) return; // this origin already has its own session
    const cookieSession = readSsoCookie();
    if (!cookieSession?.access_token || !cookieSession?.refresh_token) return;
    try { await sb.auth.setSession(cookieSession); } catch { /* stale/expired -- ignore */ }
  }

  function getClient() {
    if (client) return client;
    if (!window.supabase?.createClient) return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'trollrunner-accounts-auth',
      },
    });
    client.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION fires on every fresh page load, including origins that
      // have never signed in locally and are relying on adoptSsoCookie() to pull
      // in a session from the cookie. Writing here (with session:null, since this
      // origin's own localStorage is empty) would wipe that cookie out from under
      // adoptSsoCookie before/while it's trying to read it. Only mirror the cookie
      // on events that reflect an actual sign-in/out action.
      if (event !== 'INITIAL_SESSION') writeSsoCookie(session);
      if (!session) {
        cachedProfile = null;
        profilePromise = null;
        dispatch(null);
        return;
      }
      void loadProfile(session.user.id).then(() => dispatch(toPublicSession()));
    });
    return client;
  }

  function dispatch(detail) {
    try {
      window.dispatchEvent(new CustomEvent('trollrunner:auth-changed', { detail }));
    } catch {}
  }

  function friendlyError(error, fallback) {
    const raw = String(error?.message || error || '');
    if (/invalid login credentials/i.test(raw)) return new Error('Wrong username or password.');
    if (/already registered|already exists/i.test(raw)) return new Error('That account already exists. Try logging in.');
    if (/already taken/i.test(raw)) return new Error('That username is already taken.');
    if (/rate limit|security purposes/i.test(raw)) return new Error('Too many attempts — wait a minute and try again.');
    if (/email not confirmed/i.test(raw)) return new Error('Signups need email confirmation turned OFF in Supabase (see docs/ACCOUNTS.md).');
    if (/email.*(taken|exists|in use)|address.*already/i.test(raw)) return new Error('That email is already on another account.');
    if (/invalid.*email|unable to validate email/i.test(raw)) return new Error('That email address looks wrong.');
    return new Error(raw || fallback);
  }

  function loginEmailFor(username) {
    return `u_${String(username).toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
  }

  async function loadProfile(userId) {
    const sb = getClient();
    if (!sb || !userId) return null;
    if (!profilePromise) {
      profilePromise = sb
        .from('troll_profiles')
        .select('id, username, avatar_url, bio, level, xp, created_at, auto_join_groups')
        .eq('id', userId)
        .maybeSingle()
        .then(({ data }) => {
          cachedProfile = data || null;
          return cachedProfile;
        })
        .catch(() => null);
    }
    return profilePromise;
  }

  async function refreshProfile() {
    profilePromise = null;
    const sb = getClient();
    const { data } = (await sb?.auth.getSession()) || {};
    const userId = data?.session?.user?.id;
    if (!userId) return null;
    await loadProfile(userId);
    dispatch(toPublicSession());
    return cachedProfile;
  }

  function toPublicSession() {
    if (!cachedProfile) return null;
    return {
      userId: cachedProfile.id,
      username: cachedProfile.username,
      level: cachedProfile.level || 1,
      xp: cachedProfile.xp || 0,
      avatarUrl: cachedProfile.avatar_url || null,
      avatar: cachedProfile.avatar_url ? null : '🧌',
      joinedAt: cachedProfile.created_at || null,
      autoJoinGroups: cachedProfile.auto_join_groups !== false,
    };
  }

  async function getSession() {
    const sb = getClient();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    const user = data?.session?.user;
    if (!user) return null;
    await loadProfile(user.id);
    return toPublicSession();
  }

  async function getAccessToken() {
    const sb = getClient();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function isUsernameTaken(username) {
    const sb = getClient();
    if (!sb) return false;
    const { data } = await sb
      .from('troll_profiles')
      .select('id')
      .eq('username_lower', String(username).toLowerCase())
      .maybeSingle();
    return Boolean(data);
  }

  async function register({ username, email, password }) {
    const sb = getClient();
    if (!sb) throw new Error('Account service failed to load. Refresh and try again.');
    const name = String(username || '').trim();
    const contact = String(email || '').trim().toLowerCase();
    if (!USERNAME_RE.test(name)) throw new Error('Usernames are 3–20 letters, numbers, or underscores.');
    if (contact && !EMAIL_RE.test(contact)) throw new Error('That email address looks wrong.');
    if (String(password || '').length < 8) throw new Error('Use a password with at least 8 characters.');
    if (await isUsernameTaken(name)) throw new Error('That username is already taken.');

    // A real email becomes the auth email so password recovery works out of
    // the box; accounts without one fall back to the synthetic mailbox.
    const authEmail = contact || loginEmailFor(name);
    const { data, error } = await sb.auth.signUp({
      email: authEmail,
      password: String(password),
      options: { data: { username: name, contact_email: contact || null } },
    });
    if (error) throw friendlyError(error, 'Could not create the account.');

    // If "Confirm email" is off (required setup), a session comes back here.
    if (!data.session) {
      const { error: loginError } = await sb.auth.signInWithPassword({
        email: authEmail,
        password: String(password),
      });
      if (loginError) throw friendlyError(loginError, 'Account created — but login failed. Try logging in.');
    }
    await refreshProfile();
    void awardXp('login_streak', 'register');
    return toPublicSession();
  }

  async function login({ identifier, password }) {
    const sb = getClient();
    if (!sb) throw new Error('Account service failed to load. Refresh and try again.');
    const id = String(identifier || '').trim();
    if (!id || !password) throw new Error('Enter your username (or email) and password.');

    let { error } = await sb.auth.signInWithPassword({
      email: id.includes('@') ? id : loginEmailFor(id),
      password: String(password),
    });
    if (error && !id.includes('@') && /invalid login credentials/i.test(String(error.message || ''))) {
      // Username whose auth email is a real address (recovery-enabled account):
      // resolve it server-side — the RPC only answers when the password matches.
      let realEmail = null;
      try {
        ({ data: realEmail } = await sb.rpc('troll_login_email', { p_username: id, p_password: String(password) }));
      } catch {}
      if (realEmail) {
        ({ error } = await sb.auth.signInWithPassword({ email: realEmail, password: String(password) }));
      }
    }
    if (error) throw friendlyError(error, 'Login failed. Check your details and try again.');

    await refreshProfile();
    void awardXp('login_streak', 'login');
    return toPublicSession();
  }

  async function requestPasswordReset(email) {
    const sb = getClient();
    if (!sb) throw new Error('Account service failed to load. Refresh and try again.');
    const addr = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) throw new Error('Enter the email on your account.');
    const { error } = await sb.auth.resetPasswordForEmail(addr, { redirectTo: recoveryRedirectUrl() });
    if (error && /rate limit|security purposes/i.test(String(error.message || ''))) {
      throw friendlyError(error, 'Could not send the reset email.');
    }
    // Deliberately succeed for unknown emails too — no account enumeration.
    return true;
  }

  async function logout() {
    const sb = getClient();
    if (!sb) return;
    await sb.auth.signOut();
    cachedProfile = null;
    profilePromise = null;
    dispatch(null);
  }

  async function updateUsername(next) {
    const sb = getClient();
    const name = String(next || '').trim();
    if (!USERNAME_RE.test(name)) throw new Error('Usernames are 3–20 letters, numbers, or underscores.');
    if (!cachedProfile) throw new Error('Login first.');
    if (name.toLowerCase() !== cachedProfile.username.toLowerCase() && (await isUsernameTaken(name))) {
      throw new Error('That username is already taken.');
    }
    const { error } = await sb.from('troll_profiles').update({ username: name }).eq('id', cachedProfile.id);
    if (error) throw friendlyError(error, 'Could not update the username.');
    await sb.auth.updateUser({ data: { username: name } }).catch(() => {});
    await refreshProfile();
    return toPublicSession();
  }

  async function updateBio(next) {
    const sb = getClient();
    if (!cachedProfile) throw new Error('Login first.');
    const bio = String(next || '').trim().slice(0, 280);
    const { error } = await sb.from('troll_profiles').update({ bio }).eq('id', cachedProfile.id);
    if (error) throw friendlyError(error, 'Could not update the bio.');
    await refreshProfile();
    if (bio) void awardXp('profile_bio', 'settings');
    return toPublicSession();
  }

  async function updateAutoJoinGroups(next) {
    const sb = getClient();
    if (!cachedProfile) throw new Error('Login first.');
    const value = Boolean(next);
    const { error } = await sb.from('troll_profiles').update({ auto_join_groups: value }).eq('id', cachedProfile.id);
    if (error) throw friendlyError(error, 'Could not update that setting.');
    cachedProfile.auto_join_groups = value;
    return value;
  }

  async function updatePassword(next) {
    const sb = getClient();
    if (String(next || '').length < 8) throw new Error('Use a password with at least 8 characters.');
    const { error } = await sb.auth.updateUser({ password: String(next) });
    if (error) throw friendlyError(error, 'Could not update the password.');
    return true;
  }

  async function getRecoveryEmail() {
    const sb = getClient();
    if (!sb || !cachedProfile) return null;
    const { data } = await sb
      .from('troll_user_settings')
      .select('contact_email')
      .eq('user_id', cachedProfile.id)
      .maybeSingle();
    return data?.contact_email || null;
  }

  async function updateRecoveryEmail(email) {
    const sb = getClient();
    if (!cachedProfile) throw new Error('Login first.');
    const addr = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) throw new Error('That email address looks wrong.');
    // The real email becomes the auth email, so Supabase can send reset links.
    const { error } = await sb.auth.updateUser(
      { email: addr, data: { contact_email: addr } },
      { emailRedirectTo: recoveryRedirectUrl() }
    );
    if (error) throw friendlyError(error, 'Could not update the recovery email.');
    try {
      await sb.from('troll_user_settings').update({ contact_email: addr }).eq('user_id', cachedProfile.id);
    } catch {}
    void awardXp('profile_email', 'settings');
    return true;
  }

  /* ------------------------------------------------------------------
     Wallet link — Phantom/Solana address attached to the account.
     Desktop: the injected provider (browser extension) handles connect.
     Mobile: a normal mobile browser has no injected provider, so instead
     of failing we bounce the visitor into the Phantom app's own in-app
     browser (which does inject one) via its universal link, same handoff
     pattern troll-pay.js uses for payments. There's no return callback —
     they land back here already inside Phantom's browser and just tap
     Connect Wallet again to finish.
     ------------------------------------------------------------------ */
  const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  function getPhantomProvider() {
    return (window.phantom && window.phantom.solana) || window.solana || null;
  }

  function isTouchMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
      (('ontouchstart' in window) && Math.min(screen.width || 9999, screen.height || 9999) < 820);
  }

  function openPhantomAppBrowser() {
    const url = encodeURIComponent(location.href);
    const ref = encodeURIComponent(location.origin);
    location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
  }

  async function connectWallet() {
    const provider = getPhantomProvider();
    if (!provider || !provider.isPhantom) {
      if (isTouchMobile()) {
        openPhantomAppBrowser();
        return null; // navigating away — nothing to return yet
      }
      throw new Error('Phantom wallet not found. Install the browser extension, or open this site in the Phantom app on mobile.');
    }
    const resp = await provider.connect();
    const address = resp?.publicKey?.toString();
    if (!address) throw new Error('Could not read the wallet address.');
    if (cachedProfile) await updateWalletAddress(address);
    return address;
  }

  async function getWalletAddress() {
    const sb = getClient();
    if (!sb || !cachedProfile) return null;
    const { data } = await sb
      .from('troll_user_settings')
      .select('wallet_address')
      .eq('user_id', cachedProfile.id)
      .maybeSingle();
    return data?.wallet_address || null;
  }

  async function updateWalletAddress(address) {
    const sb = getClient();
    if (!cachedProfile) throw new Error('Login first.');
    const addr = String(address || '').trim();
    if (!SOLANA_ADDRESS_RE.test(addr)) throw new Error('That does not look like a valid Solana address.');
    const { error } = await sb.from('troll_user_settings').update({ wallet_address: addr }).eq('user_id', cachedProfile.id);
    if (error) throw friendlyError(error, 'Could not link the wallet.');
    return true;
  }

  async function unlinkWallet() {
    const sb = getClient();
    if (!cachedProfile) throw new Error('Login first.');
    const { error } = await sb.from('troll_user_settings').update({ wallet_address: null }).eq('user_id', cachedProfile.id);
    if (error) throw friendlyError(error, 'Could not unlink the wallet.');
    return true;
  }

  /* ------------------------------------------------------------------
     X (Twitter) link — uses Supabase Auth's identity linking, so no
     custom backend/token exchange lives in this repo. Requires the
     "Twitter" provider to be turned on in the Supabase dashboard with
     an X Developer App's client id/secret (see docs/ACCOUNTS.md).
     linkIdentity() navigates the whole page to X and back; the return
     trip is caught by detectRecoveryLink() below (same hash-token path
     password recovery already uses) and completed with setSession().
     ------------------------------------------------------------------ */
  const X_LINK_PARAM = 'x_linked';

  function xRedirectUrl() {
    const url = new URL(location.href);
    url.hash = '';
    url.searchParams.set(X_LINK_PARAM, '1');
    return url.toString();
  }

  async function connectX() {
    const sb = getClient();
    if (!sb) throw new Error('Account service failed to load. Refresh and try again.');
    if (!cachedProfile) throw new Error('Login first.');
    const { error } = await sb.auth.linkIdentity({ provider: 'x', options: { redirectTo: xRedirectUrl() } });
    if (error) throw friendlyError(error, 'Could not start the X connection.');
    // Success navigates the browser to X — nothing left to do on this page load.
  }

  async function getXIdentity() {
    const sb = getClient();
    if (!sb || !cachedProfile) return null;
    const { data, error } = await sb.auth.getUserIdentities();
    if (error) return null;
    const identity = (data?.identities || []).find(i => i.provider === 'x' || i.provider === 'twitter');
    if (!identity) return null;
    const meta = identity.identity_data || {};
    return {
      handle: meta.user_name || meta.preferred_username || meta.screen_name || null,
      name: meta.name || meta.full_name || null,
      avatarUrl: meta.picture || meta.avatar_url || null,
    };
  }

  async function unlinkX() {
    const sb = getClient();
    if (!cachedProfile) throw new Error('Login first.');
    const { data, error: listError } = await sb.auth.getUserIdentities();
    if (listError) throw friendlyError(listError, 'Could not look up your X connection.');
    const identity = (data?.identities || []).find(i => i.provider === 'x' || i.provider === 'twitter');
    if (!identity) return true;
    const { error } = await sb.auth.unlinkIdentity(identity);
    if (error) throw friendlyError(error, 'Could not disconnect X.');
    return true;
  }

  /* ------------------------------------------------------------------
     Password recovery — reset links from Supabase land back on the site
     with tokens in the URL hash (implicit flow); we swap them for a
     session, scrub the URL, and ask for a new password.
     ------------------------------------------------------------------ */
  // JWTs from other Trollrunner auth clients (e.g. the site-admin login) can
  // land in this same hash. Peek at the unverified payload so we don't steal
  // a token that isn't ours — admin-auth.js owns admin@login.trollrunner.net.
  function jwtEmail(token) {
    try {
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json)?.email || null;
    } catch {
      return null;
    }
  }

  function scrubXLinkParam() {
    const url = new URL(location.href);
    if (!url.searchParams.has(X_LINK_PARAM)) return;
    url.searchParams.delete(X_LINK_PARAM);
    history.replaceState(null, '', url.pathname + url.search);
  }

  function detectRecoveryLink() {
    const hash = String(location.hash || '');
    const wasXLink = new URLSearchParams(location.search).get(X_LINK_PARAM) === '1';

    // X (Twitter) link errors come back as #error=...&error_description=...
    // (no access_token), e.g. the visitor cancelled on X's side.
    if (wasXLink && /error=/.test(hash) && !/access_token=/.test(hash)) {
      const params = new URLSearchParams(hash.slice(1));
      history.replaceState(null, '', location.pathname);
      lastXLinkError = decodeURIComponent(params.get('error_description') || params.get('error') || 'X connection was cancelled.');
      void openSettings();
      return;
    }

    if (!/access_token=/.test(hash)) { if (wasXLink) scrubXLinkParam(); return; }
    const params = new URLSearchParams(hash.slice(1));
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const scrub = () => history.replaceState(null, '', location.pathname + (wasXLink ? '' : location.search));
    if (!accessToken || !refreshToken) return;
    if (jwtEmail(accessToken) === 'admin@login.trollrunner.net') return;
    if (type === 'recovery') {
      const sb = getClient();
      if (!sb) return;
      void sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
        scrub();
        if (!error) openPasswordReset();
      });
    } else if (type === 'email_change' || type === 'signup' || type === 'magiclink') {
      scrub(); // confirmation links: session tokens are consumed, nothing to show
    } else if (!type) {
      // OAuth identity-link return (currently only used by connectX()).
      const sb = getClient();
      if (!sb) return;
      void sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(async ({ error }) => {
        scrub();
        if (!error) {
          await refreshProfile();
          if (wasXLink) { justLinkedX = true; void openSettings(); }
        } else if (wasXLink) {
          lastXLinkError = friendlyError(error, 'Could not finish connecting X.').message;
          void openSettings();
        }
      });
    }
  }

  async function uploadAvatar(file) {
    const sb = getClient();
    if (!cachedProfile) throw new Error('Login first.');
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      throw new Error('Use a PNG, JPG, or WebP image.');
    }
    if (file.size > 8 * 1024 * 1024) throw new Error('Image too large (8 MB max before resize).');

    const blob = await resizeToAvatar(file);
    const path = `${cachedProfile.id}/avatar.webp`;
    const { error } = await sb.storage.from('avatars').upload(path, blob, {
      upsert: true,
      contentType: blob.type,
      cacheControl: '3600',
    });
    if (error) throw friendlyError(error, 'Avatar upload failed.');

    const { data } = sb.storage.from('avatars').getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    const { error: profileError } = await sb.from('troll_profiles').update({ avatar_url: url }).eq('id', cachedProfile.id);
    if (profileError) throw friendlyError(profileError, 'Avatar saved but the profile update failed.');
    await refreshProfile();
    void awardXp('profile_avatar', 'settings');
    return url;
  }

  function resizeToAvatar(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext('2d');
        const side = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - side) / 2, (img.height - side) / 2, side, side,
          0, 0, AVATAR_SIZE, AVATAR_SIZE
        );
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Could not process that image.'));
        }, 'image/webp', 0.9);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not read that image.'));
      };
      img.src = objectUrl;
    });
  }

  function showLevelUpToast(level) {
    try {
      document.getElementById('ta-levelup-toast')?.remove();
      const el = document.createElement('div');
      el.id = 'ta-levelup-toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99998;' +
        'background:linear-gradient(135deg,#ffe88a,#ffd84d 50%,#e6b521);color:#08110a;' +
        'font:800 14px "DM Mono","Courier New",monospace;padding:10px 18px;border:2px solid #000;' +
        'border-radius:8px;box-shadow:0 8px 0 rgba(0,0,0,0.35);letter-spacing:0.04em;' +
        'text-transform:uppercase;pointer-events:none;opacity:0;transition:opacity .25s ease;';
      el.textContent = `🧌 Level up! You're now LV ${level}`;
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.opacity = '1'; });
      setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
      }, 3500);
    } catch {}
  }

  async function awardXp(eventType, source, meta) {
    const sb = getClient();
    if (!sb) return null;
    const prevLevel = cachedProfile?.level || 1;
    try {
      const { data, error } = await sb.rpc('troll_award_xp', {
        p_event: eventType,
        p_source: source || null,
        p_meta: meta || {},
      });
      if (error) return null;
      if (data?.awarded > 0) {
        await refreshProfile();
        if (typeof data.level === 'number' && data.level > prevLevel) showLevelUpToast(data.level);
      }
      return data;
    } catch {
      return null;
    }
  }

  async function getXpHistory(limit = 20) {
    const sb = getClient();
    if (!sb || !cachedProfile) return [];
    const { data } = await sb
      .from('troll_xp_events')
      .select('event_type, xp, source, created_at')
      .eq('user_id', cachedProfile.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    return Array.isArray(data) ? data : [];
  }

  async function recordGameResult(gameId, score, meta) {
    const sb = getClient();
    if (!sb) throw new Error('Account service unavailable.');
    const { data, error } = await sb.rpc('troll_record_game_result', {
      p_game_id: gameId,
      p_score: score,
      p_meta: meta || {},
    });
    if (error) throw friendlyError(error, 'Could not save the game result.');
    void refreshProfile();
    return data;
  }

  // Safe wrapper for games: no-ops for guests (recordGameResult requires a
  // real session) and never throws, so a flaky network call can't break a
  // run. This is what actually makes game_run / high_score / game_first_daily
  // XP fire -- games call this alongside their own (unrelated) mock/local
  // weekly-leaderboard display, which this does not touch.
  async function reportGameResult(gameId, score, meta) {
    try {
      if (!cachedProfile) return null;
      return await recordGameResult(gameId, score, meta);
    } catch {
      return null;
    }
  }

  // Files a PENDING spend/donation claim. Confirmation happens server-side
  // only (future Edge Function verifies the signature on-chain) — never here.
  async function logPendingSpend({ token, amount, wallet, signature, purpose, feature }) {
    const sb = getClient();
    if (!cachedProfile) throw new Error('Login first.');
    const { error } = await sb.from('troll_transactions').insert({
      user_id: cachedProfile.id,
      token: token === 'USDC' ? 'USDC' : 'TROLL',
      amount,
      wallet_address: wallet || null,
      tx_signature: signature || null,
      purpose: purpose || null,
      feature: feature || null,
    });
    if (error) throw friendlyError(error, 'Could not record the transaction.');
    return true;
  }

  async function getProfileData() {
    const sb = getClient();
    if (!cachedProfile) await getSession();
    if (!cachedProfile) return null;
    const [statsRes, txRes] = await Promise.all([
      sb.from('troll_game_stats').select('game_id, games_played, high_score, updated_at').eq('user_id', cachedProfile.id),
      sb.from('troll_transactions').select('token, amount, status').eq('user_id', cachedProfile.id),
    ]);
    const stats = Array.isArray(statsRes?.data) ? statsRes.data : [];
    const txs = Array.isArray(txRes?.data) ? txRes.data : [];
    const totals = { USDC: 0, TROLL: 0 };
    txs.forEach(tx => {
      if (tx.status === 'confirmed') totals[tx.token] = (totals[tx.token] || 0) + Number(tx.amount || 0);
    });
    return { profile: { ...cachedProfile }, session: toPublicSession(), stats, totals };
  }

  /* ------------------------------------------------------------------
     Friends — requests go through SECURITY DEFINER RPCs (troll_friends.sql);
     there are no direct table grants, so the server is the only place a
     request/accept/remove can actually happen.
     ------------------------------------------------------------------ */
  async function sendFriendRequest(targetId) {
    const sb = getClient();
    const { data, error } = await sb.rpc('troll_send_friend_request', { p_target: targetId });
    if (error) throw friendlyError(error, 'Could not send that friend request.');
    return data?.status || 'pending_out';
  }

  async function respondFriendRequest(requesterId, accept) {
    const sb = getClient();
    const { data, error } = await sb.rpc('troll_respond_friend_request', { p_requester: requesterId, p_accept: !!accept });
    if (error) throw friendlyError(error, 'Could not update that request.');
    return data?.status || 'none';
  }

  async function removeFriend(otherId) {
    const sb = getClient();
    const { error } = await sb.rpc('troll_remove_friend', { p_other: otherId });
    if (error) throw friendlyError(error, 'Could not remove that friend.');
    return true;
  }

  async function friendStatus(otherId) {
    if (!cachedProfile) return 'none';
    if (otherId === cachedProfile.id) return 'self';
    const sb = getClient();
    const { data, error } = await sb.rpc('troll_friend_status', { p_other: otherId });
    if (error) return 'none';
    return data || 'none';
  }

  // Splits troll_friendships_view rows (stored as an ordered pair) into "me"
  // vs "the other runner" from the caller's point of view.
  function friendRowOther(row) {
    const uid = cachedProfile?.id;
    const iAmA = row.user_a === uid;
    return {
      id: iAmA ? row.user_b : row.user_a,
      username: iAmA ? row.user_b_username : row.user_a_username,
      avatar_url: iAmA ? row.user_b_avatar : row.user_a_avatar,
      level: iAmA ? row.user_b_level : row.user_a_level,
      requestedByMe: row.requested_by === uid,
      status: row.status,
      created_at: row.created_at,
    };
  }

  async function listFriends() {
    const sb = getClient();
    if (!cachedProfile) return [];
    const { data, error } = await sb.from('troll_friendships_view')
      .select('*')
      .eq('status', 'accepted')
      .order('responded_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map(friendRowOther);
  }

  // Incoming = someone else requested me; outgoing = I requested someone else.
  async function listFriendRequests() {
    const sb = getClient();
    if (!cachedProfile) return { incoming: [], outgoing: [] };
    const { data, error } = await sb.from('troll_friendships_view')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return { incoming: [], outgoing: [] };
    const rows = data.map(friendRowOther);
    return {
      incoming: rows.filter(r => !r.requestedByMe),
      outgoing: rows.filter(r => r.requestedByMe),
    };
  }

  async function findProfileByUsername(username) {
    const sb = getClient();
    const clean = String(username || '').trim();
    if (!clean) return null;
    const { data, error } = await sb.from('troll_profiles')
      .select('id, username, avatar_url, bio, level')
      .ilike('username', clean)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  }

  async function getPublicProfile(userId) {
    const sb = getClient();
    const { data, error } = await sb.from('troll_profiles')
      .select('id, username, avatar_url, bio, level')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  }

  async function getRecentlyPlayed(userId, limit = 5) {
    const sb = getClient();
    const { data, error } = await sb.from('troll_game_stats')
      .select('game_id, games_played, high_score, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);
    return Array.isArray(data) && !error ? data : [];
  }

  // Top-3 leaderboard placements — cosmetic medal badges on a profile card.
  async function getLeaderboardBadges(userId) {
    const sb = getClient();
    const { data, error } = await sb.rpc('troll_leaderboard_badges', { p_user: userId });
    return Array.isArray(data) && !error ? data : [];
  }

  // Recent high scores among a user's friends — no new schema, just the
  // public leaderboard view filtered to friend ids (both are already
  // anon/authenticated-readable).
  async function getFriendActivity(friendIds, limit = 8) {
    if (!Array.isArray(friendIds) || !friendIds.length) return [];
    const sb = getClient();
    const { data, error } = await sb.from('troll_leaderboard_view')
      .select('user_id, username, avatar_url, game_id, score, achieved_at')
      .in('user_id', friendIds)
      .order('achieved_at', { ascending: false })
      .limit(limit);
    return Array.isArray(data) && !error ? data : [];
  }

  /* ------------------------------------------------------------------
     Direct messages — friends-only threads (troll_dm_open enforces the
     friendship server-side). Realtime broadcast for instant delivery,
     table insert for history; same two-layer pattern as TrollChat.
     ------------------------------------------------------------------ */
  const dmChannels = new Map(); // threadId -> { channel, subscribed }

  async function openDmThread(otherId) {
    const sb = getClient();
    const { data, error } = await sb.rpc('troll_dm_open', { p_other: otherId });
    if (error) throw friendlyError(error, 'Could not open that conversation.');
    return data;
  }

  async function getDmHistory(threadId, limit = 60) {
    const sb = getClient();
    const { data, error } = await sb.from('troll_dm_messages')
      .select('id, sender_id, body, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(limit);
    return Array.isArray(data) && !error ? data : [];
  }

  async function sendDm(threadId, body) {
    const text = String(body || '').trim().slice(0, 240);
    if (!text || !cachedProfile) return null;
    const sb = getClient();
    const row = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, thread_id: threadId, sender_id: cachedProfile.id, body: text };
    const { error } = await sb.from('troll_dm_messages').insert(row);
    if (error) throw friendlyError(error, 'Could not send that message.');
    const entry = dmChannels.get(threadId);
    if (entry?.subscribed) entry.channel.send({ type: 'broadcast', event: 'msg', payload: { ...row, created_at: new Date().toISOString() } });
    return row;
  }

  // Subscribes once per thread; returns an unsubscribe function.
  function subscribeDm(threadId, onMessage) {
    const sb = getClient();
    let entry = dmChannels.get(threadId);
    if (!entry) {
      const channel = sb.channel(`trolldm_${threadId}`, { config: { broadcast: { self: false } } });
      entry = { channel, subscribed: false, listeners: new Set() };
      channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
        entry.listeners.forEach(fn => { try { fn(payload); } catch {} });
      });
      channel.subscribe(status => { if (status === 'SUBSCRIBED') entry.subscribed = true; });
      dmChannels.set(threadId, entry);
    }
    entry.listeners.add(onMessage);
    return () => {
      entry.listeners.delete(onMessage);
      if (!entry.listeners.size) {
        try { entry.channel.unsubscribe(); } catch {}
        dmChannels.delete(threadId);
      }
    };
  }

  /* ------------------------------------------------------------------
     Built-in Profile / Settings modals (pixel-arcade style, self-styled
     so subdomains get them for free).
     ------------------------------------------------------------------ */
  const MODAL_ID = 'troll-accounts-modal';

  function ensureModalStyles() {
    if (document.getElementById('troll-accounts-style')) return;
    const style = document.createElement('style');
    style.id = 'troll-accounts-style';
    style.textContent = `
      .ta-overlay { position: fixed; inset: 0; z-index: 99990; display: flex; align-items: center;
        justify-content: center; padding: 16px; background: rgba(4,6,5,0.78); }
      .ta-card { width: min(430px, 100%); max-height: 86vh; overflow: auto; color: #e6f2e6;
        font-family: 'DM Mono', 'Courier New', monospace; font-size: 14px; line-height: 1.45;
        background: linear-gradient(160deg, #131a15, #0a0d0b); border: 2px solid #000; border-radius: 8px;
        box-shadow: 0 0 0 1px rgba(77,255,115,0.22), 6px 8px 0 rgba(0,0,0,0.55); }
      .ta-head { display: flex; align-items: center; justify-content: space-between; gap: 10px;
        padding: 12px 14px; border-bottom: 2px solid #000; background: rgba(77,255,115,0.08); }
      .ta-title { margin: 0; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; color: #4dff73; }
      .ta-close { border: 2px solid #000; border-radius: 6px; background: #1d2620; color: #cfe9cf;
        font: inherit; padding: 3px 10px; cursor: pointer; }
      .ta-close:hover { background: #2a372e; }
      .ta-body { padding: 14px; display: grid; gap: 14px; }
      .ta-row { display: flex; align-items: center; gap: 12px; }
      .ta-avatar { width: 64px; height: 64px; flex: none; display: grid; place-items: center; font-size: 34px;
        border: 2px solid #000; border-radius: 8px; overflow: hidden;
        background: linear-gradient(180deg, #17231b, #0c100e); box-shadow: inset 0 0 0 1px rgba(77,255,115,0.24); }
      .ta-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .ta-name { margin: 0; font-size: 19px; color: #fff; word-break: break-all; }
      .ta-pill { display: inline-block; margin-top: 4px; padding: 1px 8px; font-size: 12px; color: #08110a;
        background: linear-gradient(180deg, #ffe88a, #ffd84d 50%, #e6b521); border: 2px solid #000; border-radius: 4px; }
      .ta-muted { color: #8fa396; font-size: 12px; }
      .ta-bar { height: 12px; border: 2px solid #000; border-radius: 4px; background: #0c100e; overflow: hidden; }
      .ta-bar > span { display: block; height: 100%; background: linear-gradient(90deg, #1ec94f, #4dff73); }
      .ta-section { display: grid; gap: 8px; padding: 12px; border: 2px solid #000; border-radius: 6px;
        background: rgba(0,0,0,0.28); }
      .ta-section h4 { margin: 0; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #8cffbf; }
      .ta-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .ta-table td { padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
      .ta-table td:last-child { text-align: right; color: #ffd84d; }
      .ta-input { width: 100%; box-sizing: border-box; font: inherit; color: #0a0b0d; background: #e9e9e0;
        border: 2px solid #000; border-radius: 0; padding: 7px 9px; box-shadow: inset 2px 2px 0 rgba(0,0,0,0.32); }
      .ta-btn { font: inherit; font-weight: 700; color: #08110a; border: 2px solid #000; border-radius: 6px;
        background: linear-gradient(180deg, #ffe88a, #ffd84d 50%, #e6b521);
        box-shadow: 0 3px 0 #9a7a14, 3px 5px 0 rgba(0,0,0,0.4); padding: 7px 14px; cursor: pointer; }
      .ta-btn:active { transform: translateY(2px); }
      .ta-btn[disabled] { opacity: 0.6; cursor: progress; }
      .ta-btn--ghost { background: linear-gradient(180deg, #222a25, #141a16); color: #cfe9cf; box-shadow: 0 3px 0 #000; }
      .ta-btn--x { display: inline-flex; align-items: center; gap: 8px; background: #000; color: #fff;
        box-shadow: 0 3px 0 #000; }
      .ta-btn--x svg { width: 14px; height: 14px; fill: #fff; flex: none; }
      .ta-btn--sm { padding: 4px 10px; font-size: 12px; margin-top: 4px; }
      .ta-btn--sm svg { width: 12px; height: 12px; }
      .ta-x-badge { display: inline-flex; align-items: center; gap: 5px; margin-top: 4px; font-size: 12px;
        color: #cfe9cf; text-decoration: none; }
      .ta-x-badge svg { width: 12px; height: 12px; fill: #cfe9cf; flex: none; }
      .ta-x-badge:hover { color: #fff; }
      .ta-x-badge:hover svg { fill: #fff; }
      .ta-btn--x[hidden], .ta-x-badge[hidden] { display: none; }
      .ta-status { min-height: 16px; font-size: 12px; color: #8fa396; }
      .ta-status[data-kind="error"] { color: #ff9ab6; }
      .ta-status[data-kind="success"] { color: #8cffbf; }
      @media (max-width: 480px) { .ta-card { font-size: 13px; } }
      /* Non-blocking drawer (another runner's profile) — pinned to the far
         right so it never covers the middle of the page (e.g. TrollChat)
         while it's open. */
      .ta-drawer-overlay { position: fixed; inset: 0; z-index: 99985; pointer-events: none; }
      .ta-drawer-card { position: absolute; top: 0; right: 0; height: 100%; width: min(340px, 92vw);
        overflow: auto; pointer-events: auto; transform: translateX(100%); transition: transform 0.22s ease;
        border-width: 0 0 0 2px; box-shadow: -6px 0 0 rgba(0,0,0,0.4), -1px 0 0 1px rgba(77,255,115,0.22); border-radius: 0; }
      .ta-drawer-overlay.is-open .ta-drawer-card { transform: translateX(0); }
      @media (max-width: 480px) { .ta-drawer-card { width: 100vw; } }
      /* Online dot + "playing" tag, shown next to a username anywhere */
      .ta-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px;
        background: #3a4a3f; box-shadow: 0 0 0 1px #000; flex: none; }
      .ta-dot[data-online="1"] { background: #4dff73; box-shadow: 0 0 0 1px #000, 0 0 5px rgba(77,255,115,0.9); }
      .ta-playing-tag { display: inline-flex; align-items: center; gap: 3px; margin-left: 6px; font-size: 10px;
        color: #ffd84d; }
      /* Leaderboard medal badges */
      .ta-medals { display: flex; flex-wrap: wrap; gap: 6px; }
      .ta-medal { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 3px 8px;
        border: 2px solid #000; border-radius: 4px; background: rgba(255,216,77,0.12); color: #ffd84d; }
      /* Direct-message drawer */
      .ta-dm-feed { flex: 1; overflow-y: auto; display: grid; gap: 8px; padding: 4px 2px; min-height: 0; }
      .ta-dm-msg { max-width: 84%; padding: 6px 9px; border: 2px solid #000; border-radius: 8px;
        background: rgba(255,255,255,0.06); font-size: 13px; word-break: break-word; }
      .ta-dm-msg.is-me { margin-left: auto; background: rgba(77,255,115,0.16); }
      .ta-dm-msg .ta-dm-time { display: block; margin-top: 3px; font-size: 10px; color: #8fa396; }
      .ta-dm-composer { display: flex; gap: 6px; margin-top: 8px; }
      .ta-dm-composer .ta-input { flex: 1; }
      /* Small self-dismissing local toast (friend requests / accepts) —
         intentionally separate from TrollNotis, which is a social-post
         announcer, not a generic notification system. */
      .ta-toast-root { position: fixed; top: 14px; right: 14px; z-index: 99995; display: grid; gap: 8px;
        pointer-events: none; }
      .ta-toast { pointer-events: auto; width: min(280px, 84vw); padding: 10px 12px; border: 2px solid #000;
        border-radius: 8px; background: linear-gradient(160deg, #131a15, #0a0d0b); color: #e6f2e6;
        font-family: 'DM Mono', 'Courier New', monospace; font-size: 12px; line-height: 1.4;
        box-shadow: 0 0 0 1px rgba(77,255,115,0.22), 4px 6px 0 rgba(0,0,0,0.5);
        animation: ta-toast-in 0.18s ease; cursor: pointer; }
      .ta-toast strong { display: block; color: #4dff73; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 2px; }
      @keyframes ta-toast-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);
  }

  function closeModal() {
    document.getElementById(MODAL_ID)?.remove();
  }

  const DRAWER_ID = 'troll-accounts-drawer';
  let drawerOutsideClick = null;

  function closeDrawer() {
    document.getElementById(DRAWER_ID)?.remove();
    if (drawerOutsideClick) {
      document.removeEventListener('click', drawerOutsideClick, true);
      drawerOutsideClick = null;
    }
  }

  // Same content shell as buildModal (ta-head/ta-body), but rendered as a
  // right-side drawer that doesn't block the rest of the page — used for
  // viewing OTHER runners' profiles (not the built-in Profile/Settings/
  // Friends modals, which stay centered).
  function buildDrawer(title) {
    ensureModalStyles();
    closeDrawer();
    const overlay = document.createElement('div');
    overlay.id = DRAWER_ID;
    overlay.className = 'ta-drawer-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'false');
    overlay.setAttribute('aria-label', title);
    overlay.innerHTML = `
      <div class="ta-card ta-drawer-card">
        <div class="ta-head">
          <h3 class="ta-title"></h3>
          <button class="ta-close" type="button" aria-label="Close">✕</button>
        </div>
        <div class="ta-body"></div>
      </div>`;
    overlay.querySelector('.ta-title').textContent = title;
    const card = overlay.querySelector('.ta-drawer-card');
    overlay.querySelector('.ta-close').addEventListener('click', closeDrawer);
    drawerOutsideClick = event => { if (!card.contains(event.target)) closeDrawer(); };
    document.addEventListener('click', drawerOutsideClick, true);
    const onKey = event => { if (event.key === 'Escape') { closeDrawer(); window.removeEventListener('keydown', onKey); } };
    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    return overlay.querySelector('.ta-body');
  }

  function buildModal(title) {
    ensureModalStyles();
    closeModal();
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'ta-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title);
    overlay.innerHTML = `
      <div class="ta-card">
        <div class="ta-head">
          <h3 class="ta-title"></h3>
          <button class="ta-close" type="button" aria-label="Close">✕</button>
        </div>
        <div class="ta-body"></div>
      </div>`;
    overlay.querySelector('.ta-title').textContent = title;
    overlay.addEventListener('click', event => { if (event.target === overlay) closeModal(); });
    overlay.querySelector('.ta-close').addEventListener('click', closeModal);
    const onKey = event => { if (event.key === 'Escape') { closeModal(); window.removeEventListener('keydown', onKey); } };
    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    return overlay.querySelector('.ta-body');
  }

  /* ------------------------------------------------------------------
     Guest exit gate — games call this before actually discarding an
     unsaved guest run (closing the window, quitting to title, etc.)
     since guest progress is intentionally never persisted. Resolves:
       'leave'  — proceed, discard the run
       'cancel' — stay / keep playing
       'saved'  — an account was just created; onAccountCreated already
                  ran (the caller's own save call), so progress is safe
     ------------------------------------------------------------------ */
  function renderGuestSignupForm(body, onSuccess) {
    body.innerHTML = `<div class="ta-section">
      <h4>Create your account</h4>
      <p class="ta-muted">Saves your current progress to a real account.</p>
    </div>`;
    const section = body.querySelector('.ta-section');
    const nameInput = document.createElement('input');
    nameInput.className = 'ta-input';
    nameInput.placeholder = 'Username';
    nameInput.autocomplete = 'off';
    nameInput.autocapitalize = 'none';
    nameInput.spellcheck = false;
    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.className = 'ta-input';
    passInput.placeholder = '8+ character password';
    passInput.autocomplete = 'new-password';
    const submitBtn = document.createElement('button');
    submitBtn.className = 'ta-btn';
    submitBtn.type = 'button';
    submitBtn.textContent = 'Create account & save';
    const status = document.createElement('div');
    status.className = 'ta-status';
    section.append(nameInput, passInput, submitBtn, status);

    submitBtn.addEventListener('click', async () => {
      submitBtn.disabled = true;
      status.textContent = 'Creating account…';
      status.dataset.kind = '';
      try {
        await register({ username: nameInput.value, password: passInput.value });
        status.textContent = 'Account created — saving your progress…';
        status.dataset.kind = 'success';
        await onSuccess();
      } catch (error) {
        status.textContent = error?.message || 'Could not create the account.';
        status.dataset.kind = 'error';
        submitBtn.disabled = false;
      }
    });
    nameInput.focus();
  }

  async function confirmGuestExit({
    title = 'Leave without saving?',
    message = 'You are not logged in — this progress will not be saved.',
    declineLabel = 'Leave anyway — don’t save',
    stayLabel = 'Stay',
    onAccountCreated,
  } = {}) {
    return new Promise(resolve => {
      let settled = false;
      const settle = value => { if (!settled) { settled = true; resolve(value); } };

      const body = buildModal(title);
      body.innerHTML = `<p class="ta-muted">${message}</p>`;
      const choices = document.createElement('div');
      choices.className = 'row';
      choices.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:12px;';
      const createBtn = document.createElement('button');
      createBtn.className = 'ta-btn';
      createBtn.type = 'button';
      createBtn.textContent = '🧌 Create account & save';
      const leaveBtn = document.createElement('button');
      leaveBtn.className = 'ta-btn ta-btn--ghost';
      leaveBtn.type = 'button';
      leaveBtn.textContent = declineLabel;
      const stayBtn = document.createElement('button');
      stayBtn.className = 'ta-btn ta-btn--ghost';
      stayBtn.type = 'button';
      stayBtn.textContent = stayLabel;
      choices.append(createBtn, leaveBtn, stayBtn);
      body.appendChild(choices);

      const overlay = document.getElementById(MODAL_ID);
      const observer = new MutationObserver(() => {
        if (overlay && !document.body.contains(overlay)) {
          observer.disconnect();
          settle('cancel');
        }
      });
      observer.observe(document.body, { childList: true });

      const finish = value => { observer.disconnect(); closeModal(); settle(value); };
      leaveBtn.addEventListener('click', () => finish('leave'));
      stayBtn.addEventListener('click', () => finish('cancel'));
      createBtn.addEventListener('click', () => {
        renderGuestSignupForm(body, async () => {
          try { if (onAccountCreated) await onAccountCreated(); } catch {}
          finish('saved');
        });
      });
    });
  }

  function avatarNode(session) {
    const box = document.createElement('span');
    box.className = 'ta-avatar';
    if (session?.avatarUrl) {
      const img = document.createElement('img');
      img.src = session.avatarUrl;
      img.alt = '';
      box.appendChild(img);
    } else {
      box.textContent = '🧌';
    }
    return box;
  }

  const X_LOGO_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

  function xpProgress(session) {
    const level = Math.max(1, session?.level || 1);
    const floor = 50 * (level - 1) * (level - 1);
    const ceil = 50 * level * level;
    const xp = Math.max(session?.xp || 0, floor);
    const pct = Math.max(0, Math.min(100, Math.round(((xp - floor) / Math.max(1, ceil - floor)) * 100)));
    return { pct, xp, next: ceil };
  }

  const XP_EVENT_LABELS = {
    daily_login: 'Daily login',
    login_streak: 'Login streak',
    chat_post: 'TrollChat message',
    game_run: 'Played a game',
    high_score: 'New high score',
    feedback_post: 'Feedback submitted',
    profile_avatar: 'Set a profile picture',
    profile_bio: 'Wrote a bio',
    profile_email: 'Added a recovery email',
    game_first_daily: 'First game of the day',
    boss_kill: 'Boss defeated',
    versus_match: 'Versus match played',
  };

  function xpEventLabel(eventType, source) {
    const label = XP_EVENT_LABELS[eventType] || eventType;
    return source ? `${label} (${source})` : label;
  }

  async function openProfile() {
    const body = buildModal('Profile');
    body.innerHTML = '<p class="ta-muted">Loading profile…</p>';
    const data = await getProfileData();
    if (!data) {
      body.innerHTML = '<p class="ta-muted">Login to see your profile.</p>';
      return;
    }
    const { session, stats, totals } = data;
    const progress = xpProgress(session);
    body.innerHTML = '';

    const row = document.createElement('div');
    row.className = 'ta-row';
    row.appendChild(avatarNode(session));
    const meta = document.createElement('div');
    const joined = session.joinedAt ? new Date(session.joinedAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    meta.innerHTML = `<p class="ta-name"></p><span class="ta-pill"></span><div class="ta-muted"></div>`;
    meta.querySelector('.ta-name').textContent = session.username;
    meta.querySelector('.ta-pill').textContent = `LV ${session.level}`;
    meta.querySelector('.ta-muted').textContent = `Running since ${joined}`;
    const xLink = document.createElement('a');
    xLink.className = 'ta-x-badge';
    xLink.target = '_blank';
    xLink.rel = 'noopener noreferrer';
    xLink.hidden = true;
    xLink.innerHTML = X_LOGO_SVG;
    meta.appendChild(xLink);
    const xConnectBtn = document.createElement('button');
    xConnectBtn.className = 'ta-btn ta-btn--x ta-btn--sm';
    xConnectBtn.type = 'button';
    xConnectBtn.innerHTML = `${X_LOGO_SVG}<span>Connect X</span>`;
    xConnectBtn.hidden = true;
    xConnectBtn.addEventListener('click', async () => {
      xConnectBtn.disabled = true;
      try {
        await connectX();
      } catch (error) {
        xConnectBtn.disabled = false;
        xConnectBtn.innerHTML = `${X_LOGO_SVG}<span>${error?.message || 'Could not connect X'}</span>`;
      }
    });
    meta.appendChild(xConnectBtn);
    void getXIdentity().then(identity => {
      if (!identity?.handle) { xConnectBtn.hidden = false; return; }
      xLink.href = `https://x.com/${identity.handle}`;
      xLink.appendChild(document.createTextNode(`@${identity.handle}`));
      xLink.hidden = false;
    });
    row.appendChild(meta);
    body.appendChild(row);

    const xpSection = document.createElement('div');
    xpSection.className = 'ta-section';
    xpSection.innerHTML = `<h4>XP</h4><div class="ta-bar"><span></span></div><div class="ta-muted"></div>`;
    xpSection.querySelector('.ta-bar > span').style.width = `${progress.pct}%`;
    xpSection.querySelector('.ta-muted').textContent = `${progress.xp} XP — next level at ${progress.next}`;
    body.appendChild(xpSection);

    const xpLog = document.createElement('div');
    xpLog.className = 'ta-section';
    xpLog.innerHTML = '<h4>XP log</h4><p class="ta-muted">Loading…</p>';
    body.appendChild(xpLog);
    void getXpHistory(12).then(events => {
      if (!events.length) {
        xpLog.innerHTML = '<h4>XP log</h4><p class="ta-muted">No XP earned yet — log in tomorrow or play a game.</p>';
        return;
      }
      const table = document.createElement('table');
      table.className = 'ta-table';
      events.forEach(ev => {
        const tr = document.createElement('tr');
        const label = document.createElement('td');
        const when = new Date(ev.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
        label.textContent = `${xpEventLabel(ev.event_type, ev.source)} · ${when}`;
        const amount = document.createElement('td');
        amount.textContent = `+${ev.xp} XP`;
        tr.append(label, amount);
        table.appendChild(tr);
      });
      xpLog.innerHTML = '<h4>XP log</h4>';
      xpLog.appendChild(table);
    });

    const games = document.createElement('div');
    games.className = 'ta-section';
    games.innerHTML = '<h4>Game stats</h4>';
    if (stats.length) {
      const table = document.createElement('table');
      table.className = 'ta-table';
      stats.forEach(stat => {
        const tr = document.createElement('tr');
        const name = document.createElement('td');
        name.textContent = `${stat.game_id} · ${stat.games_played} runs`;
        const score = document.createElement('td');
        score.textContent = `best ${Number(stat.high_score).toLocaleString()}`;
        tr.append(name, score);
        table.appendChild(tr);
      });
      games.appendChild(table);
    } else {
      games.insertAdjacentHTML('beforeend', '<p class="ta-muted">No saved runs yet — play something.</p>');
    }
    body.appendChild(games);

    const spend = document.createElement('div');
    spend.className = 'ta-section';
    spend.innerHTML = `<h4>Confirmed support</h4>
      <table class="ta-table">
        <tr><td>USDC</td><td>${Number(totals.USDC || 0).toLocaleString()}</td></tr>
        <tr><td>$TROLL</td><td>${Number(totals.TROLL || 0).toLocaleString()}</td></tr>
      </table>
      <p class="ta-muted">Only on-chain confirmed transactions count here.</p>`;
    body.appendChild(spend);

    const chat = document.createElement('div');
    chat.className = 'ta-section';
    chat.innerHTML = '<h4>TrollChat identity</h4>';
    const chatRow = document.createElement('div');
    chatRow.className = 'ta-row';
    chatRow.appendChild(avatarNode(session));
    const chatName = document.createElement('span');
    chatName.textContent = `${session.username} · LV ${session.level}`;
    chatRow.appendChild(chatName);
    chat.appendChild(chatRow);
    body.appendChild(chat);
  }

  async function openSettings() {
    const body = buildModal('Settings');
    const session = await getSession();
    if (!session) {
      body.innerHTML = '<p class="ta-muted">Login to change your settings.</p>';
      return;
    }
    body.innerHTML = '';

    const mkStatus = () => {
      const el = document.createElement('div');
      el.className = 'ta-status';
      return el;
    };
    const report = (el, message, kind) => {
      el.textContent = message;
      el.dataset.kind = kind || '';
    };
    const run = async (button, status, task, successMessage) => {
      button.disabled = true;
      report(status, 'Working…', '');
      try {
        await task();
        report(status, successMessage, 'success');
      } catch (error) {
        report(status, error?.message || 'Something broke. Try again.', 'error');
      } finally {
        button.disabled = false;
      }
    };

    // Username
    const nameSection = document.createElement('div');
    nameSection.className = 'ta-section';
    nameSection.innerHTML = `<h4>Username</h4>`;
    const nameInput = document.createElement('input');
    nameInput.className = 'ta-input';
    nameInput.value = session.username;
    nameInput.maxLength = 20;
    const nameBtn = document.createElement('button');
    nameBtn.className = 'ta-btn';
    nameBtn.type = 'button';
    nameBtn.textContent = 'Save username';
    const nameStatus = mkStatus();
    nameBtn.addEventListener('click', () => run(nameBtn, nameStatus,
      () => updateUsername(nameInput.value), 'Username updated everywhere.'));
    nameSection.append(nameInput, nameBtn, nameStatus);
    body.appendChild(nameSection);

    // Avatar
    const avatarSection = document.createElement('div');
    avatarSection.className = 'ta-section';
    avatarSection.innerHTML = `<h4>Profile picture</h4><p class="ta-muted">PNG/JPG/WebP — cropped square, shown in chat + leaderboards.</p>`;
    const avatarRow = document.createElement('div');
    avatarRow.className = 'ta-row';
    const avatarPreview = avatarNode(session);
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/webp';
    fileInput.className = 'ta-input';
    avatarRow.append(avatarPreview, fileInput);
    const avatarBtn = document.createElement('button');
    avatarBtn.className = 'ta-btn';
    avatarBtn.type = 'button';
    avatarBtn.textContent = 'Upload avatar';
    const avatarStatus = mkStatus();
    avatarBtn.addEventListener('click', () => run(avatarBtn, avatarStatus, async () => {
      const file = fileInput.files?.[0];
      if (!file) throw new Error('Pick an image first.');
      const url = await uploadAvatar(file);
      avatarPreview.innerHTML = '';
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      avatarPreview.appendChild(img);
    }, 'Avatar updated.'));
    avatarSection.append(avatarRow, avatarBtn, avatarStatus);
    body.appendChild(avatarSection);

    // Bio
    const bioSection = document.createElement('div');
    bioSection.className = 'ta-section';
    bioSection.innerHTML = `<h4>Bio</h4><p class="ta-muted">Shown on your profile card.</p>`;
    const bioInput = document.createElement('textarea');
    bioInput.className = 'ta-input';
    bioInput.rows = 3;
    bioInput.maxLength = 280;
    bioInput.value = cachedProfile?.bio || '';
    bioInput.placeholder = 'Tell other trolls about yourself…';
    const bioBtn = document.createElement('button');
    bioBtn.className = 'ta-btn';
    bioBtn.type = 'button';
    bioBtn.textContent = 'Save bio';
    const bioStatus = mkStatus();
    bioBtn.addEventListener('click', () => run(bioBtn, bioStatus,
      () => updateBio(bioInput.value), 'Bio saved.'));
    bioSection.append(bioInput, bioBtn, bioStatus);
    body.appendChild(bioSection);

    // Recovery email
    const emailSection = document.createElement('div');
    emailSection.className = 'ta-section';
    emailSection.innerHTML = `<h4>Recovery email</h4>
      <p class="ta-muted">Used only for password-reset links. A confirmation email may arrive — click it to finish.</p>`;
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.className = 'ta-input';
    emailInput.placeholder = 'you@example.com';
    emailInput.autocomplete = 'email';
    void getRecoveryEmail().then(addr => { if (addr && !emailInput.value) emailInput.value = addr; });
    const emailBtn = document.createElement('button');
    emailBtn.className = 'ta-btn';
    emailBtn.type = 'button';
    emailBtn.textContent = 'Save recovery email';
    const emailStatus = mkStatus();
    emailBtn.addEventListener('click', () => run(emailBtn, emailStatus,
      () => updateRecoveryEmail(emailInput.value),
      'Saved — if a confirmation email shows up, click it to activate recovery.'));
    emailSection.append(emailInput, emailBtn, emailStatus);
    body.appendChild(emailSection);

    // Wallet
    const walletSection = document.createElement('div');
    walletSection.className = 'ta-section';
    walletSection.innerHTML = `<h4>Wallet</h4>
      <p class="ta-muted">Link your Phantom wallet — only visible to you here.</p>`;
    const walletStatus = mkStatus();
    const walletRow = document.createElement('div');
    walletRow.className = 'ta-row';
    const walletConnectBtn = document.createElement('button');
    walletConnectBtn.className = 'ta-btn';
    walletConnectBtn.type = 'button';
    const walletUnlinkBtn = document.createElement('button');
    walletUnlinkBtn.className = 'ta-btn ta-btn--ghost';
    walletUnlinkBtn.type = 'button';
    walletUnlinkBtn.textContent = 'Unlink';
    walletUnlinkBtn.hidden = true;
    walletRow.append(walletConnectBtn, walletUnlinkBtn);
    walletSection.append(walletRow, walletStatus);
    body.appendChild(walletSection);

    const refreshWalletUi = async () => {
      const addr = await getWalletAddress();
      if (addr) {
        walletConnectBtn.textContent = `${addr.slice(0, 4)}…${addr.slice(-4)} — reconnect`;
        walletUnlinkBtn.hidden = false;
      } else {
        walletConnectBtn.textContent = '👛 Connect Phantom wallet';
        walletUnlinkBtn.hidden = true;
      }
    };
    walletConnectBtn.addEventListener('click', async () => {
      walletConnectBtn.disabled = true;
      report(walletStatus, 'Connecting…', '');
      try {
        const address = await connectWallet();
        if (!address) {
          // Mobile handoff: navigating to the Phantom app, nothing more to do here.
          report(walletStatus, 'Opening the Phantom app… tap Connect again once you land back here.', '');
          return;
        }
        await refreshWalletUi();
        report(walletStatus, 'Wallet linked.', 'success');
      } catch (error) {
        report(walletStatus, error?.message || 'Could not connect the wallet.', 'error');
      } finally {
        walletConnectBtn.disabled = false;
      }
    });
    walletUnlinkBtn.addEventListener('click', () => run(walletUnlinkBtn, walletStatus, async () => {
      await unlinkWallet();
      await refreshWalletUi();
    }, 'Wallet unlinked.'));
    void refreshWalletUi();

    // X (Twitter)
    const xSection = document.createElement('div');
    xSection.className = 'ta-section';
    xSection.innerHTML = `<h4>X</h4><p class="ta-muted">Connect your X account — shown on your profile card.</p>`;
    const xStatus = mkStatus();
    const xRow = document.createElement('div');
    xRow.className = 'ta-row';
    const xConnectBtn = document.createElement('button');
    xConnectBtn.className = 'ta-btn ta-btn--x';
    xConnectBtn.type = 'button';
    xConnectBtn.innerHTML = `${X_LOGO_SVG}<span>Connect</span>`;
    const xUnlinkBtn = document.createElement('button');
    xUnlinkBtn.className = 'ta-btn ta-btn--ghost';
    xUnlinkBtn.type = 'button';
    xUnlinkBtn.textContent = 'Disconnect';
    xUnlinkBtn.hidden = true;
    xRow.append(xConnectBtn, xUnlinkBtn);
    xSection.append(xRow, xStatus);
    body.appendChild(xSection);

    const refreshXUi = async () => {
      const identity = await getXIdentity();
      if (identity?.handle) {
        xConnectBtn.innerHTML = `${X_LOGO_SVG}<span>@${identity.handle} — reconnect</span>`;
        xUnlinkBtn.hidden = false;
      } else {
        xConnectBtn.innerHTML = `${X_LOGO_SVG}<span>Connect X account</span>`;
        xUnlinkBtn.hidden = true;
      }
    };
    if (lastXLinkError) {
      report(xStatus, lastXLinkError, 'error');
      lastXLinkError = null;
    } else if (justLinkedX) {
      report(xStatus, 'X connected.', 'success');
      justLinkedX = false;
    }
    xConnectBtn.addEventListener('click', () => run(xConnectBtn, xStatus, () => connectX(),
      'Redirecting to X…'));
    xUnlinkBtn.addEventListener('click', () => run(xUnlinkBtn, xStatus, async () => {
      await unlinkX();
      await refreshXUi();
    }, 'X disconnected.'));
    void refreshXUi();

    // Group chat invites
    const groupSection = document.createElement('div');
    groupSection.className = 'ta-section';
    groupSection.innerHTML = `<h4>Group chat invites</h4>
      <p class="ta-muted">When another troll invites you to a group by username, join automatically or land in a pending-invites list to accept/decline yourself.</p>`;
    const groupRow = document.createElement('label');
    groupRow.className = 'ta-row';
    groupRow.style.gap = '8px';
    const groupCheckbox = document.createElement('input');
    groupCheckbox.type = 'checkbox';
    groupCheckbox.checked = session.autoJoinGroups !== false;
    const groupLabel = document.createElement('span');
    groupLabel.textContent = 'Auto-join groups I’m invited to';
    groupRow.append(groupCheckbox, groupLabel);
    const groupStatus = mkStatus();
    groupCheckbox.addEventListener('change', () => run(groupCheckbox, groupStatus,
      () => updateAutoJoinGroups(groupCheckbox.checked), 'Saved.'));
    groupSection.append(groupRow, groupStatus);
    body.appendChild(groupSection);

    // Password
    const passSection = document.createElement('div');
    passSection.className = 'ta-section';
    passSection.innerHTML = `<h4>Password</h4>`;
    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.className = 'ta-input';
    passInput.placeholder = 'New password (8+ characters)';
    passInput.autocomplete = 'new-password';
    const passConfirm = document.createElement('input');
    passConfirm.type = 'password';
    passConfirm.className = 'ta-input';
    passConfirm.placeholder = 'Confirm new password';
    passConfirm.autocomplete = 'new-password';
    const passBtn = document.createElement('button');
    passBtn.className = 'ta-btn';
    passBtn.type = 'button';
    passBtn.textContent = 'Change password';
    const passStatus = mkStatus();
    passBtn.addEventListener('click', () => run(passBtn, passStatus, async () => {
      if (passInput.value !== passConfirm.value) throw new Error('Passwords do not match.');
      await updatePassword(passInput.value);
      passInput.value = '';
      passConfirm.value = '';
    }, 'Password changed.'));
    passSection.append(passInput, passConfirm, passBtn, passStatus);
    body.appendChild(passSection);

    // Logout
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'ta-btn ta-btn--ghost';
    logoutBtn.type = 'button';
    logoutBtn.textContent = 'Logout';
    logoutBtn.addEventListener('click', async () => {
      await logout();
      closeModal();
    });
    body.appendChild(logoutBtn);
  }

  // Friend/DM controls whose buttons depend on live status. Shared by the
  // profile card, the roster's richer card (via renderFriendAction), and
  // the Friends panel so they all stay in sync.
  function friendControls(otherId, otherName, status, onChange) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;';
    const mainBtn = document.createElement('button');
    mainBtn.className = 'ta-btn ta-btn--sm';
    mainBtn.type = 'button';
    const declineBtn = document.createElement('button');
    declineBtn.className = 'ta-btn ta-btn--sm ta-btn--ghost';
    declineBtn.type = 'button';
    declineBtn.textContent = 'Decline';
    declineBtn.hidden = true;
    const msgBtn = document.createElement('button');
    msgBtn.className = 'ta-btn ta-btn--sm ta-btn--ghost';
    msgBtn.type = 'button';
    msgBtn.textContent = '💬 Message';
    msgBtn.hidden = true;
    msgBtn.addEventListener('click', () => openDmPanel(otherId, otherName));

    const paint = s => {
      status = s;
      mainBtn.disabled = false;
      mainBtn.hidden = s === 'self';
      declineBtn.hidden = s !== 'pending_in';
      msgBtn.hidden = s !== 'accepted';
      if (s === 'accepted') { mainBtn.textContent = '✓ Friends — remove'; mainBtn.className = 'ta-btn ta-btn--sm ta-btn--ghost'; }
      else if (s === 'pending_out') { mainBtn.textContent = 'Request sent — cancel'; mainBtn.className = 'ta-btn ta-btn--sm ta-btn--ghost'; }
      else if (s === 'pending_in') { mainBtn.textContent = 'Accept'; mainBtn.className = 'ta-btn ta-btn--sm'; }
      else { mainBtn.textContent = '+ Add friend'; mainBtn.className = 'ta-btn ta-btn--sm'; }
    };
    mainBtn.addEventListener('click', async () => {
      if (!cachedProfile) { mainBtn.textContent = 'Login to add friends'; return; }
      mainBtn.disabled = true;
      try {
        let next = status;
        if (status === 'none') next = await sendFriendRequest(otherId);
        else if (status === 'pending_in') next = await respondFriendRequest(otherId, true);
        else if (status === 'pending_out' || status === 'accepted') { await removeFriend(otherId); next = 'none'; }
        paint(next);
        if (onChange) onChange(next);
      } catch (error) {
        mainBtn.disabled = false;
        mainBtn.textContent = error?.message || 'Something broke.';
      }
    });
    declineBtn.addEventListener('click', async () => {
      declineBtn.disabled = true;
      try {
        await respondFriendRequest(otherId, false);
        paint('none');
        if (onChange) onChange('none');
      } catch { declineBtn.disabled = false; }
    });
    paint(status);
    wrap.append(mainBtn, declineBtn, msgBtn);
    return wrap;
  }

  // Presence-driven UI: an online dot (data-ta-online-for="<uid>") and a
  // "currently playing" tag (data-ta-playing-for="<uid>"), refreshed from
  // the site's existing viewer-presence roster (window.getViewerRoster,
  // defined in index.html) whenever it re-syncs. On subdomains without that
  // roster, dots simply stay grey — nothing breaks.
  function refreshPresenceUI() {
    const roster = typeof window.getViewerRoster === 'function' ? window.getViewerRoster() : null;
    const online = new Map();
    (roster?.members || []).forEach(m => { if (m.userId) online.set(m.userId, m); });
    document.querySelectorAll('[data-ta-online-for]').forEach(el => {
      const m = online.get(el.getAttribute('data-ta-online-for'));
      el.dataset.online = m ? '1' : '0';
    });
    document.querySelectorAll('[data-ta-playing-for]').forEach(el => {
      const m = online.get(el.getAttribute('data-ta-playing-for'));
      el.hidden = !(m && m.activeWindow === 'games');
      if (!el.hidden) el.textContent = '🎮 Playing';
    });
  }
  window.addEventListener('trollrunner:presence-sync', refreshPresenceUI);

  function onlineDotNode(userId) {
    const dot = document.createElement('span');
    dot.className = 'ta-dot';
    dot.setAttribute('data-ta-online-for', userId);
    return dot;
  }
  function playingTagNode(userId) {
    const tag = document.createElement('span');
    tag.className = 'ta-playing-tag';
    tag.setAttribute('data-ta-playing-for', userId);
    tag.hidden = true;
    return tag;
  }

  function medalsSection(badges) {
    if (!badges.length) return null;
    const section = document.createElement('div');
    section.className = 'ta-section';
    section.innerHTML = '<h4>Leaderboard badges</h4>';
    const wrap = document.createElement('div');
    wrap.className = 'ta-medals';
    const medal = r => (r === 1 ? '🥇' : r === 2 ? '🥈' : '🥉');
    badges.forEach(b => {
      const meta = gameMeta(b.game_id);
      const chip = document.createElement('span');
      chip.className = 'ta-medal';
      chip.textContent = `${medal(b.rank)} #${b.rank} ${meta.name}`;
      wrap.appendChild(chip);
    });
    section.appendChild(wrap);
    return section;
  }

  function recentlyPlayedSection(stats) {
    const section = document.createElement('div');
    section.className = 'ta-section';
    section.innerHTML = '<h4>Recently played</h4>';
    if (!stats.length) {
      section.insertAdjacentHTML('beforeend', '<p class="ta-muted">No games played yet.</p>');
      return section;
    }
    const table = document.createElement('table');
    table.className = 'ta-table';
    stats.slice(0, 5).forEach(stat => {
      const meta = gameMeta(stat.game_id);
      const tr = document.createElement('tr');
      const name = document.createElement('td');
      name.textContent = `${meta.icon} ${meta.name} · ${stat.games_played} runs`;
      const score = document.createElement('td');
      score.textContent = `best ${Number(stat.high_score).toLocaleString()}`;
      tr.append(name, score);
      table.appendChild(tr);
    });
    section.appendChild(table);
    return section;
  }

  // Lets host pages (e.g. index.html's richer viewer/chat profile card)
  // embed the same add/accept/remove/message controls this file uses
  // internally, without duplicating the friendship logic.
  async function renderFriendAction(otherId, otherName, container, onChange) {
    if (!container || !otherId) return;
    if (!cachedProfile || otherId === cachedProfile.id) return;
    ensureModalStyles();
    const status = await friendStatus(otherId);
    container.appendChild(friendControls(otherId, otherName, status, onChange));
  }

  // Public profile card for ANY runner — click a username in TrollChat, the
  // leaderboard, or the Friends panel to open it.
  async function openProfileCard(userId) {
    if (!userId) return;
    if (cachedProfile && userId === cachedProfile.id) { await openProfile(); return; }
    const body = buildDrawer('Profile');
    body.innerHTML = '<p class="ta-muted">Loading profile…</p>';
    const [profile, stats, status, badges] = await Promise.all([
      getPublicProfile(userId),
      getRecentlyPlayed(userId, 5),
      friendStatus(userId),
      getLeaderboardBadges(userId),
    ]);
    if (!profile) { body.innerHTML = '<p class="ta-muted">Couldn’t find that runner.</p>'; return; }
    body.innerHTML = '';

    const row = document.createElement('div');
    row.className = 'ta-row';
    row.appendChild(avatarNode({ avatarUrl: profile.avatar_url }));
    const meta = document.createElement('div');
    meta.innerHTML = `<p class="ta-name" style="display:flex;align-items:center;"></p><span class="ta-pill"></span>`;
    const nameEl = meta.querySelector('.ta-name');
    nameEl.appendChild(onlineDotNode(userId));
    nameEl.appendChild(document.createTextNode(profile.username));
    meta.querySelector('.ta-pill').textContent = `LV ${profile.level}`;
    meta.appendChild(playingTagNode(userId));
    row.appendChild(meta);
    body.appendChild(row);

    if (profile.bio) {
      const bio = document.createElement('div');
      bio.className = 'ta-section';
      bio.innerHTML = '<h4>Bio</h4>';
      const p = document.createElement('p');
      p.className = 'ta-muted';
      p.textContent = profile.bio;
      bio.appendChild(p);
      body.appendChild(bio);
    }

    const medals = medalsSection(badges);
    if (medals) body.appendChild(medals);

    body.appendChild(recentlyPlayedSection(stats));

    if (cachedProfile) {
      const actions = document.createElement('div');
      actions.className = 'ta-section';
      actions.appendChild(friendControls(userId, profile.username, status));
      body.appendChild(actions);
    }
    refreshPresenceUI();
  }

  // Prefer the site's richer roster/chat profile card (avatar + bio + full
  // stats table) when it's on the page; fall back to the lean built-in one
  // on subdomains that don't have it.
  function viewProfile(id, name) {
    if (typeof window.openViewerProfileCard === 'function') window.openViewerProfileCard(id, name);
    else openProfileCard(id);
  }

  // status: 'accepted' | 'pending_in' | 'pending_out' — drives which
  // friendControls buttons show. onChange re-renders the panel's lists.
  function friendListRow(person, status, onChange) {
    const row = document.createElement('div');
    row.className = 'ta-row';
    row.style.alignItems = 'flex-start';
    const avatarWrap = document.createElement('span');
    avatarWrap.style.cursor = 'pointer';
    avatarWrap.appendChild(avatarNode({ avatarUrl: person.avatar_url }));
    avatarWrap.addEventListener('click', () => viewProfile(person.id, person.username));
    row.appendChild(avatarWrap);

    const meta = document.createElement('div');
    meta.style.flex = '1';
    const nameEl = document.createElement('p');
    nameEl.className = 'ta-name';
    nameEl.style.cssText = 'font-size:15px;cursor:pointer;display:flex;align-items:center;';
    nameEl.appendChild(onlineDotNode(person.id));
    nameEl.appendChild(document.createTextNode(person.username || 'runner'));
    nameEl.addEventListener('click', () => viewProfile(person.id, person.username));
    const sub = document.createElement('span');
    sub.className = 'ta-muted';
    sub.textContent = `LV ${person.level ?? 1}`;
    meta.append(nameEl, sub, playingTagNode(person.id), friendControls(person.id, person.username, status, onChange));
    row.appendChild(meta);
    refreshPresenceUI();
    return row;
  }

  async function openFriendsPanel() {
    const body = buildModal('Friends');
    if (!cachedProfile) {
      body.innerHTML = '<p class="ta-muted">Login to add friends.</p>';
      return;
    }
    body.innerHTML = '<p class="ta-muted">Loading…</p>';

    const addSection = document.createElement('div');
    addSection.className = 'ta-section';
    addSection.innerHTML = '<h4>Add a friend</h4>';
    const addRow = document.createElement('div');
    addRow.className = 'ta-row';
    const addInput = document.createElement('input');
    addInput.className = 'ta-input';
    addInput.placeholder = 'username';
    addInput.autocapitalize = 'none';
    addInput.spellcheck = false;
    const addBtn = document.createElement('button');
    addBtn.className = 'ta-btn ta-btn--sm';
    addBtn.type = 'button';
    addBtn.textContent = 'Send request';
    const addStatus = document.createElement('div');
    addStatus.className = 'ta-status';
    addRow.append(addInput, addBtn);
    addSection.append(addRow, addStatus);
    addBtn.addEventListener('click', async () => {
      addBtn.disabled = true;
      addStatus.textContent = 'Looking…';
      addStatus.dataset.kind = '';
      try {
        const target = await findProfileByUsername(addInput.value);
        if (!target) throw new Error('No runner with that username.');
        if (target.id === cachedProfile.id) throw new Error("That's you.");
        const status = await sendFriendRequest(target.id);
        addStatus.textContent = status === 'accepted' ? `You and ${target.username} are now friends.` : `Request sent to ${target.username}.`;
        addStatus.dataset.kind = 'success';
        addInput.value = '';
        void renderLists();
      } catch (error) {
        addStatus.textContent = error?.message || 'Could not send that request.';
        addStatus.dataset.kind = 'error';
      } finally {
        addBtn.disabled = false;
      }
    });

    const requestsSection = document.createElement('div');
    requestsSection.className = 'ta-section';
    requestsSection.innerHTML = '<h4>Requests</h4>';

    const friendsSection = document.createElement('div');
    friendsSection.className = 'ta-section';
    friendsSection.innerHTML = '<h4>Friends</h4>';

    const activitySection = document.createElement('div');
    activitySection.className = 'ta-section';
    activitySection.innerHTML = '<h4>Activity</h4>';

    body.innerHTML = '';
    body.append(addSection, requestsSection, friendsSection, activitySection);

    async function renderActivity(friendIds) {
      activitySection.innerHTML = '<h4>Activity</h4>';
      const events = await getFriendActivity(friendIds, 8);
      if (!events.length) {
        activitySection.insertAdjacentHTML('beforeend', '<p class="ta-muted">Nothing from your friends yet.</p>');
        return;
      }
      events.forEach(ev => {
        const row = document.createElement('div');
        row.className = 'ta-row';
        row.style.cssText = 'cursor:pointer;gap:8px;';
        row.appendChild(avatarNode({ avatarUrl: ev.avatar_url }));
        const meta = gameMeta(ev.game_id);
        const text = document.createElement('span');
        text.style.fontSize = '13px';
        text.textContent = `${ev.username} scored ${Number(ev.score).toLocaleString()} in ${meta.icon} ${meta.name}`;
        row.appendChild(text);
        row.addEventListener('click', () => viewProfile(ev.user_id, ev.username));
        activitySection.appendChild(row);
      });
    }

    async function renderLists() {
      const [{ incoming, outgoing }, friends] = await Promise.all([listFriendRequests(), listFriends()]);

      requestsSection.innerHTML = '<h4>Requests</h4>';
      if (!incoming.length && !outgoing.length) {
        requestsSection.insertAdjacentHTML('beforeend', '<p class="ta-muted">No pending requests.</p>');
      } else {
        incoming.forEach(req => requestsSection.appendChild(friendListRow(req, 'pending_in', () => renderLists())));
        outgoing.forEach(req => requestsSection.appendChild(friendListRow(req, 'pending_out', () => renderLists())));
      }

      friendsSection.innerHTML = '<h4>Friends</h4>';
      if (!friends.length) {
        friendsSection.insertAdjacentHTML('beforeend', '<p class="ta-muted">No friends yet — add one above.</p>');
      } else {
        friends.forEach(friend => friendsSection.appendChild(friendListRow(friend, 'accepted', () => renderLists())));
      }

      void renderActivity(friends.map(f => f.id));
    }

    void renderLists();
  }

  // Friends-only 1:1 chat — reuses the drawer shell + ta- styles, plain
  // text only (no gif/draw protocol, unlike TrollChat). Realtime broadcast
  // for instant delivery, troll_dm_messages for history; troll_dm_open
  // enforces server-side that you can only message an accepted friend.
  async function openDmPanel(otherId, otherName) {
    if (!cachedProfile) return;
    const body = buildDrawer(`💬 ${otherName || 'Message'}`);
    body.style.cssText = 'display:flex;flex-direction:column;height:100%;box-sizing:border-box;';
    body.innerHTML = '<p class="ta-muted">Opening…</p>';

    let threadId;
    try {
      threadId = await openDmThread(otherId);
    } catch (error) {
      body.innerHTML = `<p class="ta-muted">${error?.message || 'Could not open that conversation.'}</p>`;
      return;
    }
    body.innerHTML = '';

    const feed = document.createElement('div');
    feed.className = 'ta-dm-feed';
    const composerRow = document.createElement('div');
    composerRow.className = 'ta-dm-composer';
    const input = document.createElement('input');
    input.className = 'ta-input';
    input.placeholder = 'Message…';
    input.maxLength = 240;
    const sendBtn = document.createElement('button');
    sendBtn.className = 'ta-btn ta-btn--sm';
    sendBtn.type = 'button';
    sendBtn.textContent = 'Send';
    composerRow.append(input, sendBtn);
    body.append(feed, composerRow);

    const renderMsg = m => {
      const el = document.createElement('div');
      el.className = 'ta-dm-msg' + (m.sender_id === cachedProfile.id ? ' is-me' : '');
      const text = document.createElement('div');
      text.textContent = m.body;
      const time = document.createElement('span');
      time.className = 'ta-dm-time';
      time.textContent = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      el.append(text, time);
      feed.appendChild(el);
      feed.scrollTop = feed.scrollHeight;
    };

    (await getDmHistory(threadId, 60)).forEach(renderMsg);
    feed.scrollTop = feed.scrollHeight;

    const unsub = subscribeDm(threadId, payload => {
      if (payload.sender_id === cachedProfile.id) return; // already rendered on send
      renderMsg(payload);
    });
    // buildDrawer doesn't expose a close hook, so watch for its own removal
    // to stop listening once the panel closes.
    const watcher = new MutationObserver(() => {
      if (!document.getElementById(DRAWER_ID)) { unsub(); watcher.disconnect(); }
    });
    watcher.observe(document.body, { childList: true });

    const doSend = async () => {
      const text = input.value;
      if (!String(text || '').trim()) return;
      input.value = '';
      sendBtn.disabled = true;
      try {
        const row = await sendDm(threadId, text);
        if (row) renderMsg({ ...row, created_at: new Date().toISOString() });
      } catch {
        input.value = text;
      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
    };
    sendBtn.addEventListener('click', doSend);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') void doSend(); });
    input.focus();
  }

  /* ------------------------------------------------------------------
     Local toasts (friend requests/accepts) — a small self-dismissing
     corner popup, intentionally separate from TrollNotis (that engine is
     a social-post cross-announcer, not a generic notification system).
     ------------------------------------------------------------------ */
  function showLocalToast(title, message, onClick) {
    ensureModalStyles();
    let root = document.getElementById('ta-toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'ta-toast-root';
      root.className = 'ta-toast-root';
      document.body.appendChild(root);
    }
    const toast = document.createElement('div');
    toast.className = 'ta-toast';
    toast.innerHTML = '<strong></strong><span></span>';
    toast.querySelector('strong').textContent = title;
    toast.querySelector('span').textContent = message;
    if (onClick) toast.addEventListener('click', onClick);
    root.appendChild(toast);
    window.setTimeout(() => toast.remove(), 7000);
  }

  /* ------------------------------------------------------------------
     Friend-activity polling: dispatches a pending-request count (host
     pages badge their Friends button off it) and toasts NEW incoming
     requests / newly-accepted friends since the last poll. No realtime
     subscription needed (and none of this table's replication is on) —
     a cheap poll while a session is open is enough.
     ------------------------------------------------------------------ */
  let friendPollTimer = null;
  let friendPollSeeded = false;
  let seenIncomingIds = new Set();
  let seenFriendIds = new Set();

  function dispatchFriendCount(count) {
    try { window.dispatchEvent(new CustomEvent('trollrunner:friend-requests-changed', { detail: { count } })); } catch {}
  }

  async function pollFriendActivity() {
    if (!cachedProfile) return;
    try {
      const [{ incoming }, friends] = await Promise.all([listFriendRequests(), listFriends()]);
      dispatchFriendCount(incoming.length);
      if (!friendPollSeeded) {
        seenIncomingIds = new Set(incoming.map(r => r.id));
        seenFriendIds = new Set(friends.map(f => f.id));
        friendPollSeeded = true;
        return;
      }
      incoming.forEach(req => {
        if (seenIncomingIds.has(req.id)) return;
        seenIncomingIds.add(req.id);
        showLocalToast('Friend request', `${req.username} wants to be friends.`, () => openFriendsPanel());
      });
      friends.forEach(f => {
        if (seenFriendIds.has(f.id)) return;
        seenFriendIds.add(f.id);
        showLocalToast('New friend', `You and ${f.username} are now friends.`, () => viewProfile(f.id, f.username));
      });
    } catch {}
  }

  function startFriendActivityPolling() {
    stopFriendActivityPolling();
    friendPollSeeded = false;
    void pollFriendActivity();
    friendPollTimer = window.setInterval(pollFriendActivity, 45000);
  }
  function stopFriendActivityPolling() {
    if (friendPollTimer) { window.clearInterval(friendPollTimer); friendPollTimer = null; }
    dispatchFriendCount(0);
  }
  window.addEventListener('trollrunner:auth-changed', event => {
    if (event.detail) startFriendActivityPolling();
    else stopFriendActivityPolling();
  });

  function openRecovery() {
    const body = buildModal('Reset password');
    body.innerHTML = '';
    const section = document.createElement('div');
    section.className = 'ta-section';
    section.innerHTML = `<h4>Forgot your password?</h4>
      <p class="ta-muted">Enter the email on your account and we'll send a reset link.
      No email on the account? Ping the Troll Runner in TrollChat or Feedback to recover it.</p>`;
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.className = 'ta-input';
    emailInput.placeholder = 'you@example.com';
    emailInput.autocomplete = 'email';
    const sendBtn = document.createElement('button');
    sendBtn.className = 'ta-btn';
    sendBtn.type = 'button';
    sendBtn.textContent = 'Send reset link';
    const status = document.createElement('div');
    status.className = 'ta-status';
    const send = async () => {
      sendBtn.disabled = true;
      status.textContent = 'Sending…';
      status.dataset.kind = '';
      try {
        await requestPasswordReset(emailInput.value);
        status.textContent = 'If that email has an account, a reset link is on its way. Check spam too.';
        status.dataset.kind = 'success';
      } catch (error) {
        status.textContent = error?.message || 'Could not send the reset email.';
        status.dataset.kind = 'error';
        sendBtn.disabled = false;
      }
    };
    sendBtn.addEventListener('click', send);
    emailInput.addEventListener('keydown', event => { if (event.key === 'Enter') void send(); });
    section.append(emailInput, sendBtn, status);
    body.appendChild(section);
    emailInput.focus();
  }

  function openPasswordReset() {
    const body = buildModal('Set a new password');
    body.innerHTML = '';
    const section = document.createElement('div');
    section.className = 'ta-section';
    section.innerHTML = `<h4>Almost back in</h4>
      <p class="ta-muted">Pick a new password for your account.</p>`;
    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.className = 'ta-input';
    passInput.placeholder = 'New password (8+ characters)';
    passInput.autocomplete = 'new-password';
    const passConfirm = document.createElement('input');
    passConfirm.type = 'password';
    passConfirm.className = 'ta-input';
    passConfirm.placeholder = 'Confirm new password';
    passConfirm.autocomplete = 'new-password';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'ta-btn';
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save new password';
    const status = document.createElement('div');
    status.className = 'ta-status';
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      status.textContent = 'Working…';
      status.dataset.kind = '';
      try {
        if (passInput.value !== passConfirm.value) throw new Error('Passwords do not match.');
        await updatePassword(passInput.value);
        await refreshProfile();
        status.textContent = 'Password changed — you are logged in.';
        status.dataset.kind = 'success';
        window.setTimeout(closeModal, 1600);
      } catch (error) {
        status.textContent = error?.message || 'Could not change the password.';
        status.dataset.kind = 'error';
        saveBtn.disabled = false;
      }
    });
    section.append(passInput, passConfirm, saveBtn, status);
    body.appendChild(section);
    passInput.focus();
  }

  /* ------------------------------------------------------------------
     Cross-origin session bridge — trollrunner.net, games.trollrunner.net,
     and every sibling subdomain each run this same script, but Supabase
     Auth sessions live in localStorage scoped per-origin, so logging in
     on the main site does NOT automatically log you in inside an iframed
     subdomain (e.g. the "Games" desktop window). The PARENT page pushes
     its session down to iframed children it controls (see twOpen/
     tdBuildIframe in the main site's index.html); children here just
     accept it from a known allowlist of parent origins and adopt it.
     Only ever acted on inside an iframe -- a top-level page ignores it.
     ------------------------------------------------------------------ */
  const SSO_ALLOWED_PARENT_ORIGINS = [
    'https://mayurski-art.github.io',
    'https://www.trollrunner.net',
    'https://trollrunner.net',
  ];

  async function getRawTokens() {
    const sb = getClient();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    const session = data?.session;
    if (!session) return null;
    return { access_token: session.access_token, refresh_token: session.refresh_token };
  }

  function initSsoBridge() {
    if (window === window.top) return; // only iframed pages adopt a parent's session
    window.addEventListener('message', event => {
      if (!SSO_ALLOWED_PARENT_ORIGINS.includes(event.origin)) return;
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      const sb = getClient();
      if (!sb) return;
      if (msg.type === 'trollrunner:sso-session' && msg.accessToken && msg.refreshToken) {
        void sb.auth.setSession({ access_token: msg.accessToken, refresh_token: msg.refreshToken });
      } else if (msg.type === 'trollrunner:sso-logout') {
        void logout();
      }
    });
  }

  function init() {
    const sb = getClient();
    if (!sb) return;
    detectRecoveryLink();
    initSsoBridge();
    void adoptSsoCookie(sb).then(() => getSession()).then(session => {
      if (session) {
        dispatch(session);
        void awardXp('login_streak', 'visit');
      }
    });
  }

  window.TrollrunnerAccounts = {
    getClient,
    getSession,
    getAccessToken,
    getRawTokens,
    getCachedProfile: () => (cachedProfile ? toPublicSession() : null),
    refreshProfile,
    register,
    login,
    logout,
    updateUsername,
    updateBio,
    updateAutoJoinGroups,
    updatePassword,
    updateRecoveryEmail,
    requestPasswordReset,
    openRecovery,
    connectWallet,
    getWalletAddress,
    unlinkWallet,
    connectX,
    getXIdentity,
    unlinkX,
    uploadAvatar,
    awardXp,
    recordGameResult,
    reportGameResult,
    logPendingSpend,
    getProfileData,
    getXpHistory,
    confirmGuestExit,
    openProfile,
    openSettings,
    openProfileCard,
    openFriendsPanel,
    renderFriendAction,
    sendFriendRequest,
    respondFriendRequest,
    removeFriend,
    friendStatus,
    listFriends,
    listFriendRequests,
    findProfileByUsername,
    getPublicProfile,
    getRecentlyPlayed,
    getLeaderboardBadges,
    getFriendActivity,
    ensureSocialStyles: ensureModalStyles,
    openDmPanel,
    openDmThread,
    getDmHistory,
    sendDm,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
