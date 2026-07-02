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
  const AVATAR_SIZE = 256;

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
    if (/rate limit/i.test(raw)) return new Error('Too many attempts — wait a minute and try again.');
    if (/email not confirmed/i.test(raw)) return new Error('Signups need email confirmation turned OFF in Supabase (see docs/ACCOUNTS.md).');
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
    if (!USERNAME_RE.test(name)) throw new Error('Usernames are 3–20 letters, numbers, or underscores.');
    if (String(password || '').length < 8) throw new Error('Use a password with at least 8 characters.');
    if (await isUsernameTaken(name)) throw new Error('That username is already taken.');

    const { data, error } = await sb.auth.signUp({
      email: loginEmailFor(name),
      password: String(password),
      options: { data: { username: name, contact_email: String(email || '').trim() || null } },
    });
    if (error) throw friendlyError(error, 'Could not create the account.');

    // If "Confirm email" is off (required setup), a session comes back here.
    if (!data.session) {
      const { error: loginError } = await sb.auth.signInWithPassword({
        email: loginEmailFor(name),
        password: String(password),
      });
      if (loginError) throw friendlyError(loginError, 'Account created — but login failed. Try logging in.');
    }
    await refreshProfile();
    void awardXp('daily_login', 'register');
    return toPublicSession();
  }

  async function login({ identifier, password }) {
    const sb = getClient();
    if (!sb) throw new Error('Account service failed to load. Refresh and try again.');
    const id = String(identifier || '').trim();
    if (!id || !password) throw new Error('Enter your username (or email) and password.');

    const email = id.includes('@') ? id : loginEmailFor(id);
    const { error } = await sb.auth.signInWithPassword({ email, password: String(password) });
    if (error) throw friendlyError(error, 'Login failed. Check your details and try again.');

    await refreshProfile();
    void awardXp('daily_login', 'login');
    return toPublicSession();
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

  async function updatePassword(next) {
    const sb = getClient();
    if (String(next || '').length < 8) throw new Error('Use a password with at least 8 characters.');
    const { error } = await sb.auth.updateUser({ password: String(next) });
    if (error) throw friendlyError(error, 'Could not update the password.');
    return true;
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

  async function awardXp(eventType, source, meta) {
    const sb = getClient();
    if (!sb) return null;
    try {
      const { data, error } = await sb.rpc('troll_award_xp', {
        p_event: eventType,
        p_source: source || null,
        p_meta: meta || {},
      });
      if (error) return null;
      if (data?.awarded > 0) void refreshProfile();
      return data;
    } catch {
      return null;
    }
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

  function init() {
    const sb = getClient();
    if (!sb) return;
    void getSession().then(session => {
      if (session) {
        dispatch(session);
        void awardXp('daily_login', 'visit');
      }
    });
  }

  window.TrollrunnerAccounts = {
    getClient,
    getSession,
    getAccessToken,
    getCachedProfile: () => (cachedProfile ? toPublicSession() : null),
    refreshProfile,
    register,
    login,
    logout,
    updateUsername,
    updatePassword,
    uploadAvatar,
    awardXp,
    recordGameResult,
    logPendingSpend,
    getProfileData,
    openProfile,
    openSettings,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
