/* TROLLRUNNER COMING-SOON GATE — cross-repo, self-contained.
   Loaded by trollrunner.net AND every subdomain (games, blog, finance,
   nutrition, projects, videos, stickers) the same way troll-notis.js is.
   It injects its own markup + styles, so host pages only need the one
   <script> tag. Admin unlock uses the real Supabase admin account via
   admin-auth.js (lazy-loaded on pages that don't already have it).

   Whether the gate is shown at all is a LIVE, cross-device switch stored
   in the same site_updates row site-lock.js uses (see
   assets/js/site-lock.js and assets/supabase/troll_admin_lockdown.sql).
   Toggle it from admin.html's "Coming-soon gate" console — one click
   flips it for every visitor within ~GATE_POLL_MS, no per-browser admin
   password needed. The password field in the gate corner is a separate,
   optional per-browser preview: it lets an admin look at the live site
   while the gate is still up for everyone else. */
(function () {
  const ASSET_ORIGIN = 'https://mayurski-art.github.io';
  const SUPABASE_URL = 'https://tjsyhfplxjtakdfkpdtg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3loZnBseGp0YWtkZmtwZHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTc0ODksImV4cCI6MjA5MTk3MzQ4OX0.xLUcPUUguRBQttNwiIRWJHxjJjLqrQDMu4Ubsk5yZoQ';
  const SUPABASE_TABLE = 'site_updates';
  const SUPABASE_ROW_ID = 'main';
  const ADMIN_FLAG_KEY = 'trollrunner_admin_auth';
  const GATE_META_ID = '__trollrunner_coming_soon_meta__';
  const GATE_STORAGE_KEY = 'trollrunner_coming_soon_gate_v1';
  const GATE_POLL_MS = 1500;
  const GATE_BROADCAST_CHANNEL = 'trollrunner-coming-soon-gate';
  const isAdminPage = /\/admin\.html(?:$|\?)/.test(window.location.pathname);
  const isPublicPage = !isAdminPage;

  if (window.__trollComingSoonGate) return;
  window.__trollComingSoonGate = true;

  function safeParse(raw, fallback) {
    try {
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  // No stored record yet (fresh browser, or Supabase unreachable) defaults
  // to enabled — the gate fails closed, never open, so a network hiccup
  // can't accidentally expose an unlaunched site.
  function normalizeGate(raw) {
    const input = raw && typeof raw === 'object' ? raw : {};
    return {
      enabled: input.enabled !== false,
      updatedAt: String(input.updatedAt || new Date().toISOString()),
    };
  }

  function getStoredGate() {
    return normalizeGate(safeParse(localStorage.getItem(GATE_STORAGE_KEY), {}));
  }

  function setStoredGate(record) {
    const normalized = normalizeGate(record);
    localStorage.setItem(GATE_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function buildMetaItem(record) {
    const normalized = normalizeGate(record);
    return {
      id: GATE_META_ID,
      title: '__coming_soon_gate_meta__',
      body: '__coming_soon_gate_meta__',
      createdAt: normalized.updatedAt,
      archived: true,
      source: 'system',
      comingSoonGate: normalized,
    };
  }

  function extractRecordFromPayload(payload) {
    const updates = Array.isArray(payload?.updates) ? payload.updates : [];
    const meta = updates.find(item => item && item.id === GATE_META_ID);
    return meta ? normalizeGate(meta.comingSoonGate || {}) : null;
  }

  function getReadHeaders() {
    return {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    };
  }

  // Writes go through the troll_admin_replace_site_row RPC (see
  // assets/supabase/troll_admin_lockdown.sql), which requires a real admin
  // session — the anon key alone can't flip this for everyone.
  async function getAdminWriteHeaders() {
    const headers = getReadHeaders();
    try {
      const token = await window.TrollrunnerAdminAuth?.getAccessToken?.();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {}
    return headers;
  }

  async function syncStateToBackend(record) {
    const normalized = normalizeGate(record);
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
    try {
      const qs = new URLSearchParams({ select: 'updates', id: `eq.${SUPABASE_ROW_ID}`, limit: '1' });
      const existingResponse = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?${qs.toString()}`, { headers: getReadHeaders() });
      if (!existingResponse.ok) return false;
      const json = await existingResponse.json();
      const payload = Array.isArray(json) ? json[0] : json;
      const existingUpdates = Array.isArray(payload?.updates) ? payload.updates : [];
      const nextUpdates = existingUpdates.filter(item => item && item.id !== GATE_META_ID);
      nextUpdates.push(buildMetaItem(normalized));
      const writeResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/troll_admin_replace_site_row`, {
        method: 'POST',
        headers: await getAdminWriteHeaders(),
        body: JSON.stringify({ p_updates: nextUpdates }),
      });
      return writeResponse.ok;
    } catch {
      return false;
    }
  }

  let gateState = getStoredGate();
  let broadcastChannel = null;
  const hasBroadcastChannel = typeof window.BroadcastChannel !== 'undefined';

  function broadcastState() {
    if (!broadcastChannel) return;
    try {
      broadcastChannel.postMessage({ type: 'coming-soon-gate-state' });
    } catch {}
  }

  function requestGateTransition(enabled) {
    const nextRecord = { enabled: Boolean(enabled), updatedAt: new Date().toISOString() };
    gateState = setStoredGate(nextRecord);
    applyGateState();
    broadcastState();
    void syncStateToBackend(nextRecord);
    return gateState;
  }

  async function pollRemoteState() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    try {
      const qs = new URLSearchParams({ select: 'updates', id: `eq.${SUPABASE_ROW_ID}`, limit: '1' });
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?${qs.toString()}`, { headers: getReadHeaders() });
      if (!response.ok) return;
      const json = await response.json();
      const payload = Array.isArray(json) ? json[0] : json;
      const nextRecord = extractRecordFromPayload(payload);
      if (!nextRecord) return;
      if (JSON.stringify(nextRecord) !== JSON.stringify(gateState)) {
        gateState = setStoredGate(nextRecord);
        applyGateState();
        broadcastState();
      }
    } catch {}
  }

  /* ---- pre-paint lock: applied immediately from the cached value so
     nothing behind the gate flashes before the markup exists ---- */
  if (isPublicPage && gateState.enabled) document.documentElement.classList.add('cs-locked');

  if (isPublicPage) {
    const style = document.createElement('style');
    style.setAttribute('data-coming-soon-style', '1');
    style.textContent = `
      html.cs-locked body > :not(#coming-soon-gate) { visibility: hidden !important; }
      html.cs-locked { overflow: hidden; }
      .coming-soon-gate {
        position: fixed; inset: 0; z-index: 2147483000;
        display: flex; align-items: center; justify-content: center;
        background: #0a0b0d; overflow-y: auto; padding: 24px 0;
        font-family: 'DM Sans', -apple-system, 'Segoe UI', sans-serif;
      }
      .coming-soon-gate.is-unlocked { display: none; }
      .cs-inner {
        display: flex; flex-direction: column; align-items: center; gap: 22px;
        width: 100%; max-width: 900px; margin: auto; padding: 0 20px;
      }
      .cs-bg { width: 100%; height: auto; max-height: 78vh; object-fit: contain; border-radius: 8px; }
      .cs-newsletter {
        display: flex; flex-direction: column; align-items: center; gap: 8px;
        width: min(92vw, 420px); text-align: center;
      }
      .cs-newsletter-label {
        color: #f4f3ee; font-size: 15px; letter-spacing: 0.06em;
        text-shadow: 0 2px 10px rgba(0,0,0,0.6);
      }
      .cs-newsletter-row { display: flex; gap: 8px; width: 100%; }
      .cs-newsletter-input {
        flex: 1; min-width: 0; padding: 11px 14px; border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.22); background: rgba(10,11,13,0.72);
        color: #fff; font-size: 14px; font-family: inherit;
      }
      .cs-newsletter-input::placeholder { color: rgba(255,255,255,0.45); }
      .cs-newsletter-input:focus { outline: 2px solid #4dff73; outline-offset: 1px; }
      .cs-newsletter-btn {
        padding: 11px 18px; border-radius: 10px; border: none;
        background: #4dff73; color: #04140a; font-weight: 700; font-size: 14px;
        cursor: pointer; white-space: nowrap; font-family: inherit;
      }
      .cs-newsletter-btn:hover { filter: brightness(1.08); }
      .cs-newsletter-btn:disabled { opacity: 0.6; cursor: default; }
      .cs-newsletter-status { min-height: 1.2em; font-size: 12.5px; color: rgba(255,255,255,0.75); }
      .cs-newsletter-status[data-kind="success"] { color: #4dff73; }
      .cs-newsletter-status[data-kind="error"] { color: #ff6b6b; }
      .cs-hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
      .cs-admin-corner {
        position: absolute; right: 10px; bottom: 10px;
        display: flex; align-items: center; gap: 6px;
        opacity: 0.28; transition: opacity 0.2s ease;
      }
      .cs-admin-corner:hover, .cs-admin-corner:focus-within { opacity: 1; }
      .cs-admin-input {
        width: 74px; padding: 5px 8px; border-radius: 7px;
        border: 1px solid rgba(255,255,255,0.2); background: rgba(10,11,13,0.7);
        color: #fff; font-size: 12px;
      }
      .cs-admin-btn {
        width: 26px; height: 26px; border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.2); background: rgba(10,11,13,0.7);
        color: #fff; font-size: 13px; line-height: 1; cursor: pointer;
      }
      .cs-admin-status {
        position: absolute; right: 0; bottom: 32px; width: max-content;
        max-width: 200px; font-size: 11px; color: #ff6b6b; text-align: right;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  let overlay = null;
  let localAdminUnlocked = false;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', reject);
        // Already-executed scripts fire no events; resolve on next tick if
        // the global it defines showed up.
        setTimeout(resolve, 0);
        return;
      }
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(el);
    });
  }

  async function ensureAdminAuth() {
    if (window.TrollrunnerAdminAuth) return window.TrollrunnerAdminAuth;
    if (!window.supabase?.createClient) {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    }
    await loadScript(`${ASSET_ORIGIN}/assets/js/admin-auth.js`);
    return window.TrollrunnerAdminAuth || null;
  }

  function setInertBehindOverlay(isLocked) {
    if (!document.body) return;
    Array.from(document.body.children).forEach(child => {
      if (child === overlay) return;
      if (isLocked) child.setAttribute('inert', '');
      else child.removeAttribute('inert');
    });
  }

  function applyGateState() {
    if (!isPublicPage) return;
    const visible = !gateState.enabled || localAdminUnlocked;
    if (visible) {
      document.documentElement.classList.remove('cs-locked');
      overlay?.classList.add('is-unlocked');
      setInertBehindOverlay(false);
    } else {
      document.documentElement.classList.add('cs-locked');
      overlay?.classList.remove('is-unlocked');
      setInertBehindOverlay(true);
    }
  }

  function buildOverlay() {
    overlay = document.getElementById('coming-soon-gate');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'coming-soon-gate';
    overlay.className = 'coming-soon-gate';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Trollrunner.net — coming soon');
    overlay.innerHTML = `
      <div class="cs-inner">
        <img class="cs-bg" src="${ASSET_ORIGIN}/assets/img/coming-soon.png" alt="Trollrunner.net — the official Trollrunner website. Coming soon this summer." loading="eager">
        <form id="cs-newsletter-form" class="cs-newsletter" autocomplete="off" novalidate>
          <label class="cs-newsletter-label" for="cs-newsletter-email">Get notified when we launch</label>
          <input id="cs-newsletter-website" class="cs-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="cs-newsletter-row">
            <input id="cs-newsletter-email" class="cs-newsletter-input" type="email" placeholder="you@email.com" required autocomplete="email">
            <button type="submit" class="cs-newsletter-btn">Notify Me</button>
          </div>
          <div id="cs-newsletter-status" class="cs-newsletter-status" aria-live="polite"></div>
        </form>
      </div>
      <div id="coming-soon-admin" class="cs-admin-corner">
        <input id="cs-admin-pass" class="cs-admin-input" type="password" placeholder="•••" aria-label="Admin password" autocomplete="current-password">
        <button id="cs-admin-go" class="cs-admin-btn" type="button" aria-label="Admin unlock" title="Admin">🧌</button>
        <div id="cs-admin-status" class="cs-admin-status" aria-live="polite"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function wireUp() {
    buildOverlay();
    applyGateState();

    const form = document.getElementById('cs-newsletter-form');
    const emailInput = document.getElementById('cs-newsletter-email');
    const newsletterStatus = document.getElementById('cs-newsletter-status');
    const adminInput = document.getElementById('cs-admin-pass');
    const adminGoBtn = document.getElementById('cs-admin-go');
    const adminStatus = document.getElementById('cs-admin-status');

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      // Honeypot: hidden field humans can't see. If it's filled, a bot did
      // it — show fake success and never touch the network.
      const honeypot = document.getElementById('cs-newsletter-website');
      if (honeypot && honeypot.value) {
        newsletterStatus.textContent = "You're on the list. 🧌";
        newsletterStatus.dataset.kind = 'success';
        form.reset();
        return;
      }
      const email = String(emailInput?.value || '').trim();
      if (!email) return;
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      newsletterStatus.textContent = 'Submitting...';
      newsletterStatus.dataset.kind = 'info';
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/troll_submit_newsletter_signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ p_email: email }),
        });
        if (!response.ok) {
          const errJson = await response.json().catch(() => null);
          throw new Error(errJson?.message || 'Could not save that email.');
        }
        newsletterStatus.textContent = "You're on the list. 🧌";
        newsletterStatus.dataset.kind = 'success';
        form.reset();
      } catch (error) {
        newsletterStatus.textContent = error?.message ? String(error.message) : 'Something went wrong.';
        newsletterStatus.dataset.kind = 'error';
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    adminGoBtn?.addEventListener('click', async () => {
      const password = String(adminInput?.value || '');
      if (!password) {
        adminInput?.focus();
        return;
      }
      adminGoBtn.disabled = true;
      adminStatus.textContent = 'Checking...';
      adminStatus.dataset.kind = 'info';
      try {
        const auth = await ensureAdminAuth();
        if (!auth?.signInWithAdminPassword) throw new Error('Admin login service failed to load.');
        await auth.signInWithAdminPassword(password, { silent: true });
        adminStatus.textContent = '';
        if (adminInput) adminInput.value = '';
        localAdminUnlocked = true;
        applyGateState();
      } catch (error) {
        adminStatus.textContent = error?.message ? String(error.message) : 'Wrong admin password.';
        adminStatus.dataset.kind = 'error';
      } finally {
        adminGoBtn.disabled = false;
      }
    });

    adminInput?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        adminGoBtn?.click();
      }
    });

    // Only pay the cost of loading Supabase to re-verify a session when a
    // prior admin login on this origin left its flag; the public never
    // loads any of it.
    if (localStorage.getItem(ADMIN_FLAG_KEY) === '1') {
      void (async () => {
        try {
          const auth = await ensureAdminAuth();
          const authed = await auth?.hasAdminSession?.();
          if (authed) {
            localAdminUnlocked = true;
            applyGateState();
          } else {
            localStorage.removeItem(ADMIN_FLAG_KEY);
          }
        } catch {}
      })();
    }
  }

  function hydrate() {
    if (isPublicPage) wireUp();
    window.setInterval(pollRemoteState, GATE_POLL_MS);
    if (hasBroadcastChannel && !broadcastChannel) {
      try {
        broadcastChannel = new BroadcastChannel(GATE_BROADCAST_CHANNEL);
        broadcastChannel.onmessage = () => {
          gateState = getStoredGate();
          applyGateState();
        };
      } catch {
        broadcastChannel = null;
      }
    }
    window.addEventListener('storage', event => {
      if (event.key !== GATE_STORAGE_KEY) return;
      gateState = getStoredGate();
      applyGateState();
    });
    void pollRemoteState();
  }

  window.TrollrunnerComingSoonGate = {
    storageKey: GATE_STORAGE_KEY,
    metaId: GATE_META_ID,
    getStoredGate,
    setStoredGate,
    buildMetaItem,
    extractRecordFromPayload,
    requestGateTransition,
    syncStateToBackend,
    refresh: pollRemoteState,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate, { once: true });
  } else {
    hydrate();
  }
})();
