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
    client.auth.onAuthStateChange((_event, session) => {
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
        .select('id, username, avatar_url, bio, level, xp, created_at')
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
     Password recovery — reset links from Supabase land back on the site
     with tokens in the URL hash (implicit flow); we swap them for a
     session, scrub the URL, and ask for a new password.
     ------------------------------------------------------------------ */
  function detectRecoveryLink() {
    const hash = String(location.hash || '');
    if (!/access_token=/.test(hash)) return;
    const params = new URLSearchParams(hash.slice(1));
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const scrub = () => history.replaceState(null, '', location.pathname + location.search);
    if (!accessToken || !refreshToken) return;
    if (type === 'recovery') {
      const sb = getClient();
      if (!sb) return;
      void sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
        scrub();
        if (!error) openPasswordReset();
      });
    } else if (type === 'email_change' || type === 'signup' || type === 'magiclink') {
      scrub(); // confirmation links: session tokens are consumed, nothing to show
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
      .ta-status { min-height: 16px; font-size: 12px; color: #8fa396; }
      .ta-status[data-kind="error"] { color: #ff9ab6; }
      .ta-status[data-kind="success"] { color: #8cffbf; }
      @media (max-width: 480px) { .ta-card { font-size: 13px; } }
    `;
    document.head.appendChild(style);
  }

  function closeModal() {
    document.getElementById(MODAL_ID)?.remove();
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
    void getSession().then(session => {
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
    updatePassword,
    updateRecoveryEmail,
    requestPasswordReset,
    openRecovery,
    uploadAvatar,
    awardXp,
    recordGameResult,
    logPendingSpend,
    getProfileData,
    getXpHistory,
    openProfile,
    openSettings,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
