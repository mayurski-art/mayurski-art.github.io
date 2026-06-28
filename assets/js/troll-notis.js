/* ============================================================
   TROLL NOTIS ENGINE
   Self-contained pixel notification toast + Supabase live sync.
   Drop onto any Troll Runner page (after the supabase-js CDN script):
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="https://mayurski-art.github.io/assets/js/troll-notis.js"></script>
   Injects its own styles + fonts and a #troll-notis-root mount point.
   Exposes: window.TrollNotis.{ show, publish, ingest, platforms, isReady }
   ============================================================ */
(function () {
  const SUPABASE_URL = 'https://tjsyhfplxjtakdfkpdtg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3loZnBseGp0YWtkZmtwZHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTc0ODksImV4cCI6MjA5MTk3MzQ4OX0.xLUcPUUguRBQttNwiIRWJHxjJjLqrQDMu4Ubsk5yZoQ';
  const SUPABASE_TABLE = 'site_updates';
  const SUPABASE_ROW_ID = 'main';
  const NOTIS_META_ID = '__trollrunner_notis_meta__';
  const NOTIS_CHANNEL = 'trollrunner-notis';
  const SEEN_KEY = 'trollrunner_notis_seen_v1';
  const POLL_MS = 20000;              // late-joiner / cross-tab fallback
  const TOAST_TTL_MS = 13000;         // auto-dismiss
  const MAX_STORED = 20;              // keep last N alerts in meta
  const TN_AVATAR = 'https://mayurski-art.github.io/assets/animations/troll-grin.gif';

  const PLATFORMS = {
    x:      { app: 'TROLL RUNNER on 𝕏', kicker: 'New post', badge: '𝕏', cta: 'Open on X', handle: '@troll_runner', base: 'https://x.com/troll_runner' },
    tiktok: { app: 'TROLL RUNNER · TikTok', kicker: 'New video', badge: 'TT', cta: 'Watch on TikTok', handle: '@mayurski', base: 'https://www.tiktok.com/@mayurski' },
  };

  let client = null, channel = null, subscribed = false, pollTimer = null;
  let lastRenderedId = null;
  let stylesInjected = false;

  function platform(p) { return PLATFORMS[p] || PLATFORMS.x; }

  /* ---- one-time style + font injection (so the toast looks right on any page) ---- */
  function injectStyles() {
    if (stylesInjected || document.getElementById('troll-notis-style')) { stylesInjected = true; return; }
    const style = document.createElement('style');
    style.id = 'troll-notis-style';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
      #troll-notis-root{position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;flex-direction:column-reverse;gap:12px;width:min(360px,calc(100vw - 32px));pointer-events:none;}
      .tn-toast{pointer-events:auto;position:relative;border:3px solid #10201a;border-radius:5px;background:repeating-linear-gradient(0deg,rgba(16,32,26,0.05) 0 2px,transparent 2px 4px),linear-gradient(180deg,#f3f8e9,#d7e7cf);color:#14231d;box-shadow:0 0 0 3px #cfe3cd,5px 5px 0 3px rgba(16,32,26,0.5),0 16px 36px rgba(0,0,0,0.4);image-rendering:pixelated;overflow:hidden;transform:translateX(120%);opacity:0;animation:tn-in .42s steps(6,end) forwards;}
      .tn-toast.tn-leaving{animation:tn-out .3s steps(5,end) forwards;}
      @keyframes tn-in{from{transform:translateX(120%);opacity:0;}60%{opacity:1;}to{transform:translateX(0);opacity:1;}}
      @keyframes tn-out{from{transform:translateX(0);opacity:1;}to{transform:translateX(130%);opacity:0;}}
      .tn-titlebar{display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:3px solid #10201a;background:linear-gradient(90deg,#2bd66f,#2fb3a6 60%,#f4d35e);box-shadow:inset 0 0 0 2px rgba(255,255,255,0.3);}
      .tn-toast[data-platform="x"] .tn-titlebar{background:linear-gradient(90deg,#000,#2a2a2a 70%,#444);}
      .tn-toast[data-platform="x"] .tn-app{color:#fff;text-shadow:1px 1px 0 #000;}
      .tn-toast[data-platform="tiktok"] .tn-titlebar{background:linear-gradient(90deg,#ff0050,#000 55%,#00f2ea);}
      .tn-toast[data-platform="tiktok"] .tn-app{color:#fff;text-shadow:1px 1px 0 #000;}
      .tn-app{flex:1;min-width:0;font-family:'Press Start 2P','VT323',monospace;font-size:9px;letter-spacing:0.03em;color:#0c1a12;text-shadow:1px 1px 0 rgba(255,255,255,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .tn-badge{width:22px;height:22px;flex:none;display:grid;place-items:center;border:2px solid #10201a;border-radius:3px;background:#fff;font-weight:900;font-size:13px;line-height:1;color:#000;box-shadow:1px 1px 0 rgba(16,32,26,0.4);}
      .tn-toast[data-platform="tiktok"] .tn-badge{font-size:11px;}
      .tn-close{width:22px;height:22px;flex:none;cursor:pointer;border:2px solid #10201a;border-radius:3px;background:#fff;font-family:'Press Start 2P','VT323',monospace;font-size:8px;color:#000;line-height:1;display:grid;place-items:center;padding:0;box-shadow:1px 1px 0 rgba(16,32,26,0.4);}
      .tn-close:active{transform:translate(1px,1px);box-shadow:none;}
      .tn-body{display:flex;gap:10px;padding:10px;}
      .tn-avatar{width:42px;height:42px;flex:none;border:2px solid #10201a;border-radius:3px;background:#fff;object-fit:cover;image-rendering:pixelated;box-shadow:2px 2px 0 rgba(16,32,26,0.4);}
      .tn-content{min-width:0;flex:1;}
      .tn-kicker{font-family:'Press Start 2P','VT323',monospace;font-size:8px;letter-spacing:0.06em;color:#1c5b38;text-transform:uppercase;margin-bottom:4px;}
      .tn-summary{font-family:'VT323','DM Mono',monospace;font-size:18px;line-height:1.18;color:#10231a;margin-bottom:9px;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;}
      .tn-cta{display:inline-flex;align-items:center;gap:6px;font-family:'Press Start 2P','VT323',monospace;font-size:9px;letter-spacing:0.03em;text-decoration:none;color:#08160f;background:#f4d35e;border:2px solid #10201a;border-radius:4px;padding:7px 10px;box-shadow:2px 2px 0 rgba(16,32,26,0.45);}
      .tn-cta:active{transform:translate(2px,2px);box-shadow:none;}
      .tn-toast[data-platform="x"] .tn-cta{background:#fff;}
      .tn-toast[data-platform="tiktok"] .tn-cta{background:#00f2ea;}
      .tn-progress{height:4px;background:rgba(16,32,26,0.18);}
      .tn-progress span{display:block;height:100%;background:#2bd66f;width:100%;transform-origin:left;animation:tn-bar linear forwards;}
      .tn-toast[data-platform="x"] .tn-progress span{background:#fff;}
      .tn-toast[data-platform="tiktok"] .tn-progress span{background:#ff0050;}
      @keyframes tn-bar{from{transform:scaleX(1);}to{transform:scaleX(0);}}
      @media (max-width:520px){#troll-notis-root{left:16px;right:16px;width:auto;}}
    `;
    document.head.appendChild(style);
    stylesInjected = true;
  }

  /* ---- seen-id bookkeeping (one toast per user per alert) ---- */
  function getSeen() {
    try { const a = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch { return []; }
  }
  function markSeen(id) {
    if (!id) return;
    const seen = getSeen();
    if (seen.includes(id)) return;
    seen.push(id);
    while (seen.length > 60) seen.shift();
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch {}
  }
  function hasSeen(id) { return !!id && getSeen().includes(id); }

  function rootEl() {
    let root = document.getElementById('troll-notis-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'troll-notis-root';
      root.setAttribute('aria-live', 'polite');
      root.setAttribute('aria-label', 'Troll Runner notifications');
      document.body.appendChild(root);
    }
    return root;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function safeUrl(u, fallback) {
    const s = String(u || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
    return fallback;
  }

  /* ---- render one toast ---- */
  function show(notif) {
    if (!notif) return;
    injectStyles();
    const p = platform(notif.platform);
    const root = rootEl();
    const url = safeUrl(notif.url, p.base);
    const summary = String(notif.summary || '').trim() || `${p.handle} just posted something new.`;

    const toast = document.createElement('div');
    toast.className = 'tn-toast';
    toast.dataset.platform = (notif.platform in PLATFORMS) ? notif.platform : 'x';
    toast.setAttribute('role', 'alert');
    toast.innerHTML =
      '<div class="tn-titlebar">'
        + '<span class="tn-badge">' + esc(p.badge) + '</span>'
        + '<span class="tn-app">' + esc(p.app) + '</span>'
        + '<button class="tn-close" type="button" aria-label="Dismiss notification">✕</button>'
      + '</div>'
      + '<div class="tn-body">'
        + '<img class="tn-avatar" src="' + esc(TN_AVATAR) + '" alt="" aria-hidden="true">'
        + '<div class="tn-content">'
          + '<div class="tn-kicker">' + esc(p.kicker) + ' · ' + esc(p.handle) + '</div>'
          + '<div class="tn-summary">' + esc(summary) + '</div>'
          + '<a class="tn-cta" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(p.cta) + ' →</a>'
        + '</div>'
      + '</div>'
      + '<div class="tn-progress"><span style="animation-duration:' + TOAST_TTL_MS + 'ms"></span></div>';

    root.appendChild(toast);

    let ttl = null;
    const dismiss = () => {
      if (toast.classList.contains('tn-leaving')) return;
      window.clearTimeout(ttl);
      toast.classList.add('tn-leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };
    toast.querySelector('.tn-close').addEventListener('click', dismiss);
    toast.querySelector('.tn-cta').addEventListener('click', () => setTimeout(dismiss, 120));
    ttl = window.setTimeout(dismiss, TOAST_TTL_MS);
    toast.addEventListener('mouseenter', () => window.clearTimeout(ttl));
    toast.addEventListener('mouseleave', () => { ttl = window.setTimeout(dismiss, 3500); });

    return toast;
  }

  /* show only if new to this user */
  function ingest(notif) {
    if (!notif || !notif.id) return;
    if (hasSeen(notif.id)) return;
    if (notif.id === lastRenderedId) return;
    lastRenderedId = notif.id;
    markSeen(notif.id);
    show(notif);
  }

  /* ---- supabase plumbing ---- */
  function headers(extra) {
    return Object.assign({
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
    }, extra || {});
  }
  function getClient() {
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return client;
  }

  async function fetchLatest() {
    try {
      const qs = new URLSearchParams({ select: 'updates', id: 'eq.' + SUPABASE_ROW_ID, limit: '1' });
      const res = await fetch(SUPABASE_URL + '/rest/v1/' + SUPABASE_TABLE + '?' + qs, { cache: 'no-store', headers: headers({ 'Cache-Control': 'no-cache' }) });
      if (!res.ok) return null;
      const json = await res.json();
      const payload = Array.isArray(json) ? json[0] : json;
      const updates = Array.isArray(payload && payload.updates) ? payload.updates : [];
      const meta = updates.find(u => u && u.id === NOTIS_META_ID);
      const list = meta && Array.isArray(meta.notifs) ? meta.notifs : [];
      return list.length ? list[list.length - 1] : null;   // newest
    } catch { return null; }
  }

  // write newest alert into the shared meta item without clobbering other meta rows
  async function persist(notif) {
    try {
      const qs = new URLSearchParams({ select: 'updates', id: 'eq.' + SUPABASE_ROW_ID, limit: '1' });
      const readRes = await fetch(SUPABASE_URL + '/rest/v1/' + SUPABASE_TABLE + '?' + qs, { cache: 'no-store', headers: headers() });
      if (!readRes.ok) return false;
      const json = await readRes.json();
      const payload = Array.isArray(json) ? json[0] : json;
      const updates = Array.isArray(payload && payload.updates) ? payload.updates.slice() : [];
      const existing = updates.find(u => u && u.id === NOTIS_META_ID);
      const prevNotifs = existing && Array.isArray(existing.notifs) ? existing.notifs : [];
      const nextNotifs = prevNotifs.concat([notif]).slice(-MAX_STORED);
      const meta = {
        id: NOTIS_META_ID,
        title: '__notis_meta__', body: '__notis_meta__',
        createdAt: new Date().toISOString(),
        archived: true, source: 'system',
        notifs: nextNotifs,
      };
      const nextUpdates = updates.filter(u => !(u && u.id === NOTIS_META_ID)).concat([meta]);
      const writeRes = await fetch(SUPABASE_URL + '/rest/v1/' + SUPABASE_TABLE, {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify([{ id: SUPABASE_ROW_ID, updates: nextUpdates, updated_at: new Date().toISOString() }]),
      });
      return writeRes.ok;
    } catch { return false; }
  }

  /* publish: broadcast instantly + persist for late joiners. Returns {notif, persisted} */
  async function publish(input) {
    const notif = {
      id: input.id || ('n-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
      platform: (input.platform in PLATFORMS) ? input.platform : 'x',
      summary: String(input.summary || '').slice(0, 180),
      url: String(input.url || ''),
      createdAt: new Date().toISOString(),
    };
    markSeen(notif.id); // don't pop our own toast twice for the sender
    if (channel && subscribed) {
      try { await channel.send({ type: 'broadcast', event: 'notif', payload: notif }); } catch {}
    }
    const persisted = await persist(notif);
    return { notif, persisted };
  }

  function connect() {
    injectStyles();
    const c = getClient();
    if (!c) { startPolling(); return; }
    channel = c.channel(NOTIS_CHANNEL, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'notif' }, ({ payload }) => ingest(payload));
    channel.subscribe(s => {
      if (s === 'SUBSCRIBED') {
        subscribed = true;
        document.dispatchEvent(new CustomEvent('trollnotis:ready'));
      }
    });
    startPolling();
    fetchLatest().then(latest => { if (latest) ingest(latest); }); // catch most recent on load
  }
  function startPolling() {
    if (pollTimer) return;
    pollTimer = window.setInterval(() => { fetchLatest().then(latest => { if (latest) ingest(latest); }); }, POLL_MS);
  }

  window.TrollNotis = {
    show,            // show(notif) — render a toast locally, no sync
    publish,         // publish({platform,summary,url}) — broadcast + persist
    ingest,          // ingest(notif) — show if unseen
    platforms: PLATFORMS,
    isReady: () => subscribed,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect, { once: true });
  } else {
    connect();
  }
})();
