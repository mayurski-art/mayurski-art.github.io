/* TROLLRUNNER FEATURE FLAGS — cross-repo, self-contained.
   Loaded by trollrunner.net AND sibling sites (games.trollrunner.net, etc.)
   the same way troll-notis.js / coming-soon.js already are.
   Reads a shared meta key out of the same `site_updates` Supabase row
   admin.html already writes to (site lock, live status, notis all live
   there). Writes are admin-only via troll_admin_replace_site_row — this
   script only ever reads.
   Usage on a page: mark any element `data-feature="games"` (or
   `data-feature="game_troll_kombat"`, etc.) and call
   TrollrunnerFeatureFlags.applyFeatureVisibility() once the DOM exists and
   again whenever `trollrunner:feature-flags-updated` fires. */
(function () {
  if (window.TrollrunnerFeatureFlags) return;

  const SUPABASE_URL = 'https://tjsyhfplxjtakdfkpdtg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3loZnBseGp0YWtkZmtwZHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTc0ODksImV4cCI6MjA5MTk3MzQ4OX0.xLUcPUUguRBQttNwiIRWJHxjJjLqrQDMu4Ubsk5yZoQ';
  const SUPABASE_TABLE = 'site_updates';
  const SUPABASE_ROW_ID = 'main';
  const FEATURE_FLAGS_META_ID = '__trollrunner_feature_flags_meta__';
  const CACHE_KEY = 'trollrunner_feature_flags_v1';
  const POLL_MS = 20000;

  // Every flag defaults to "on" -- an unknown key (e.g. this script is
  // older than a newly-added feature) should never hide something by
  // accident.
  const DEFAULT_FLAGS = {
    games: true,
    game_meme_metro: true,
    game_troll_kombat: true,
    game_trollrreria: true,
    game_troll_casino: true,
    troll_chat: true,
    finance: true,
    blog: true,
    nutrition: true,
    videos: true,
    projects: true,
    stickers: true,
    garden: true,
  };

  let cachedFlags = null;
  let pollTimer = null;

  function safeParse(raw, fallback) {
    try {
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function normalizeFlags(raw) {
    const input = raw && typeof raw === 'object' ? raw : {};
    const normalized = { ...DEFAULT_FLAGS };
    Object.keys(DEFAULT_FLAGS).forEach(key => {
      if (typeof input[key] === 'boolean') normalized[key] = input[key];
    });
    return normalized;
  }

  function getCachedFlags() {
    if (cachedFlags) return cachedFlags;
    cachedFlags = normalizeFlags(safeParse(localStorage.getItem(CACHE_KEY), {}));
    return cachedFlags;
  }

  function setCachedFlags(flags) {
    cachedFlags = normalizeFlags(flags);
    localStorage.setItem(CACHE_KEY, JSON.stringify(cachedFlags));
    return cachedFlags;
  }

  function buildMetaItem(flags) {
    return {
      id: FEATURE_FLAGS_META_ID,
      title: '__feature_flags_meta__',
      body: '__feature_flags_meta__',
      createdAt: new Date().toISOString(),
      archived: true,
      source: 'system',
      featureFlags: normalizeFlags(flags),
    };
  }

  function extractFlagsFromPayload(payload) {
    const updates = Array.isArray(payload?.updates) ? payload.updates : [];
    const meta = updates.find(item => item && item.id === FEATURE_FLAGS_META_ID);
    return normalizeFlags(meta?.featureFlags || payload?.featureFlags || {});
  }

  // A feature id like "game_troll_kombat" also requires the "games" master
  // switch to be on -- flipping "games" off is a one-click way to take the
  // whole arcade down without touching each game's flag.
  function isEnabled(id, flags = getCachedFlags()) {
    if (!id) return true;
    if (Object.prototype.hasOwnProperty.call(flags, id) === false) return true;
    if (id.startsWith('game_') && flags.games === false) return false;
    return flags[id] !== false;
  }

  function applyFeatureVisibility(root = document) {
    const flags = getCachedFlags();
    root.querySelectorAll('[data-feature]').forEach(el => {
      const id = el.getAttribute('data-feature');
      const enabled = isEnabled(id, flags);
      el.hidden = !enabled;
      el.classList.toggle('is-feature-hidden', !enabled);
    });
  }

  async function fetchFlags() {
    try {
      const qs = new URLSearchParams({
        select: 'updates',
        id: `eq.${SUPABASE_ROW_ID}`,
        limit: '1',
      });
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?${qs.toString()}`, {
        cache: 'no-store',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      if (!response.ok) return getCachedFlags();
      const json = await response.json();
      const payload = Array.isArray(json) ? json[0] : json;
      const nextFlags = extractFlagsFromPayload(payload);
      const prevFlags = getCachedFlags();
      const changed = JSON.stringify(nextFlags) !== JSON.stringify(prevFlags);
      setCachedFlags(nextFlags);
      if (changed) {
        applyFeatureVisibility(document);
        window.dispatchEvent(new CustomEvent('trollrunner:feature-flags-updated', { detail: nextFlags }));
      }
      return nextFlags;
    } catch {
      return getCachedFlags();
    }
  }

  function ensureHideStyle() {
    if (document.querySelector('style[data-feature-flags-style]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-feature-flags-style', '1');
    // Host pages sometimes set `display` on these same elements with equal
    // or higher specificity (e.g. `.game-select-card { display: flex }`),
    // which would otherwise silently beat the `[hidden]` UA rule.
    style.textContent = '[data-feature].is-feature-hidden { display: none !important; }';
    (document.head || document.documentElement).appendChild(style);
  }

  function hydrate() {
    ensureHideStyle();
    applyFeatureVisibility(document);
    void fetchFlags();
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = window.setInterval(fetchFlags, POLL_MS);
    window.addEventListener('storage', event => {
      if (event.key !== CACHE_KEY) return;
      cachedFlags = null;
      applyFeatureVisibility(document);
    });
  }

  window.TrollrunnerFeatureFlags = {
    DEFAULT_FLAGS,
    metaId: FEATURE_FLAGS_META_ID,
    getFlags: getCachedFlags,
    setCachedFlags,
    isEnabled,
    applyFeatureVisibility,
    fetchFlags,
    buildMetaItem,
    extractFlagsFromPayload,
    refresh: fetchFlags,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate, { once: true });
  } else {
    hydrate();
  }
})();
