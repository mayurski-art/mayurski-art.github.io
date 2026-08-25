/* ============================================================
   TROLL PRESENCE — shared "who's online" pill + roster popover.
   Same Supabase presence room as the homepage header pill and world.html's
   island roster (trollrunner-site-presence), same payload shape and the
   same localStorage viewerId, so every page that mounts this widget shares
   ONE live count/roster with the rest of the site instead of running its
   own separate headcount.

   Drop onto any Troll Runner page (after supabase-js + troll-accounts.js):
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="assets/js/troll-accounts.js"></script>
     <script src="assets/js/troll-presence.js"></script>
     <script>TrollPresence.mount(document.getElementById('presence-mount'));</script>

   Exposes: window.TrollPresence.mount(container, opts?)
     opts.align — 'left' | 'right' popover anchor (default 'right')
   ============================================================ */
(function () {
  const SUPABASE_URL = 'https://tjsyhfplxjtakdfkpdtg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3loZnBseGp0YWtkZmtwZHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTc0ODksImV4cCI6MjA5MTk3MzQ4OX0.xLUcPUUguRBQttNwiIRWJHxjJjLqrQDMu4Ubsk5yZoQ';
  const VIEWER_ID_KEY = 'trollrunner_viewer_id_v1';
  const VIEWER_CHANNEL = 'trollrunner-site-presence';

  const viewerOnlineAt = new Date().toISOString();
  let viewerChannel = null;
  let viewerJoined = false;
  const widgets = []; // {countEl, rows, sub, root} — every mounted pill repaints together

  function getViewerId() {
    try {
      const stored = localStorage.getItem(VIEWER_ID_KEY);
      if (stored) return stored;
      const made = crypto?.randomUUID ? crypto.randomUUID() : `viewer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(VIEWER_ID_KEY, made);
      return made;
    } catch { return `viewer-${Math.random().toString(16).slice(2)}`; }
  }

  function viewerPayload() {
    const me = window.TrollrunnerAccounts?.getCachedProfile?.() || null;
    return {
      viewerId: getViewerId(), userId: me?.userId || null, username: me?.username || null,
      avatarUrl: me?.avatarUrl || null, level: me?.level || null,
      host: location.hostname, path: location.pathname, activeWindow: null,
      onlineAt: viewerOnlineAt, trackedAt: new Date().toISOString(),
    };
  }

  // Presence metas accumulate under a key when you re-track without
  // untracking first (a login mid-visit) — leave-diffs don't reliably reach
  // every client, so the old guest entry would sit there forever otherwise.
  async function viewersRetrack() {
    if (!viewerJoined || !viewerChannel) return;
    try { await viewerChannel.untrack(); await viewerChannel.track(viewerPayload()); } catch {}
  }

  // Same de-dupe as the desktop/world.html: one entry per browser, freshest
  // trackedAt wins, one row per account across tabs/pages.
  function viewerRoster() {
    const byViewer = new Map();
    const state = viewerChannel?.presenceState?.() || {};
    Object.values(state).forEach(entries => {
      if (!Array.isArray(entries)) return;
      entries.forEach(entry => {
        if (!entry?.viewerId) return;
        const prev = byViewer.get(entry.viewerId);
        if (!prev || String(entry.trackedAt || '') >= String(prev.trackedAt || '')) {
          byViewer.set(entry.viewerId, entry);
        }
      });
    });
    if (!byViewer.size) byViewer.set(getViewerId(), viewerPayload());
    const members = [], guests = [], seen = new Set();
    byViewer.forEach(entry => {
      const username = String(entry.username || '').trim().slice(0, 20);
      const userId = String(entry.userId || '').trim().slice(0, 64);
      if (userId && username) {
        if (seen.has(userId)) return;
        seen.add(userId);
        const avatar = String(entry.avatarUrl || '');
        members.push({
          viewerId: entry.viewerId, userId, username,
          avatarUrl: /^https:\/\//.test(avatar) ? avatar : '',
          level: Math.max(1, Number(entry.level) || 1),
        });
      } else {
        guests.push({ viewerId: entry.viewerId, onlineAt: String(entry.onlineAt || '') });
      }
    });
    members.sort((a, b) => a.username.localeCompare(b.username));
    guests.sort((a, b) => a.onlineAt.localeCompare(b.onlineAt) || String(a.viewerId).localeCompare(String(b.viewerId)));
    guests.forEach((g, i) => { g.guestLabel = `Guest${String(i + 1).padStart(3, '0')}`; });
    return { members, guests, total: members.length + guests.length };
  }

  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      .tp-pill{border:0.5px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(5,13,28,.34);
        color:#fff;display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:7px 12px;
        box-shadow:0 8px 18px rgba(0,0,0,.2);font-size:12px;font-weight:700;line-height:1;font-family:inherit;
        cursor:pointer;appearance:none;-webkit-appearance:none;position:relative;}
      .tp-pill:hover,.tp-pill[aria-expanded="true"]{background:rgba(9,22,44,.62);border-color:rgba(255,255,255,.45);}
      .tp-dot{width:7px;height:7px;border-radius:50%;background:#30d158;box-shadow:0 0 0 2px rgba(48,209,88,.25);flex:none;}
      .tp-count{min-width:1ch;text-align:right;}
      .tp-wrap{position:relative;display:inline-block;}
      .tp-pop{position:absolute;top:calc(100% + 8px);width:240px;max-height:320px;overflow-y:auto;
        border-radius:14px;border:0.5px solid rgba(255,255,255,.18);background:rgba(18,20,26,.96);
        backdrop-filter:blur(14px);box-shadow:0 16px 40px rgba(0,0,0,.4);padding:10px;z-index:2147483000;
        display:none;font-family:inherit;}
      .tp-wrap[data-align="right"] .tp-pop{right:0;}
      .tp-wrap[data-align="left"] .tp-pop{left:0;}
      .tp-pop.is-open{display:block;}
      .tp-pop-sub{font-size:11.5px;color:rgba(255,255,255,.55);margin:2px 6px 8px;}
      .tp-row{display:flex;align-items:center;gap:8px;padding:6px;border-radius:10px;width:100%;
        text-align:left;background:none;border:none;font:inherit;color:inherit;}
      .tp-row:hover{background:rgba(255,255,255,.06);}
      button.tp-row{cursor:pointer;}
      button.tp-row:focus-visible{outline:1px solid rgba(255,255,255,.4);}
      .tp-av{width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.12);display:flex;
        align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex:none;overflow:hidden;}
      .tp-av img{width:100%;height:100%;object-fit:cover;display:block;}
      .tp-name{flex:1;min-width:0;font-size:13px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .tp-tag{flex:none;font-size:10px;font-weight:700;color:rgba(255,255,255,.55);
        border:0.5px solid rgba(255,255,255,.2);border-radius:999px;padding:1px 6px;}
      .tp-tag.is-you{color:#30d158;border-color:rgba(48,209,88,.4);}
    `;
    document.head.appendChild(style);
  }

  function paintAll() {
    const roster = viewerRoster();
    widgets.forEach(w => {
      w.countEl.textContent = String(roster.total);
      w.pill.setAttribute('aria-label', `${roster.total} ${roster.total === 1 ? 'person' : 'people'} online — see who`);
      w.pill.title = `${roster.total} ${roster.total === 1 ? 'person' : 'people'} online`;
      w.sub.textContent = roster.total === 1
        ? "Just you here right now."
        : `${roster.total} trolls online right now.`;
      const mine = getViewerId();
      w.rows.innerHTML = '';
      [...roster.members, ...roster.guests].forEach(who => {
        const clickable = !!who.userId;
        const row = document.createElement(clickable ? 'button' : 'div');
        row.className = 'tp-row';
        if (clickable) {
          row.type = 'button';
          row.setAttribute('aria-label', `View ${who.username}'s profile`);
        }
        const av = document.createElement('span');
        av.className = 'tp-av';
        if (who.avatarUrl) {
          const img = document.createElement('img');
          img.src = who.avatarUrl; img.alt = ''; img.loading = 'lazy';
          av.appendChild(img);
        } else {
          av.textContent = who.username ? who.username.slice(0, 1).toUpperCase() : '?';
        }
        const name = document.createElement('span');
        name.className = 'tp-name';
        name.textContent = who.username || who.guestLabel;
        row.append(av, name);
        if (who.username) {
          const lvl = document.createElement('span');
          lvl.className = 'tp-tag';
          lvl.textContent = `LV ${who.level}`;
          row.appendChild(lvl);
        }
        if (who.viewerId === mine) {
          const you = document.createElement('span');
          you.className = 'tp-tag is-you';
          you.textContent = 'You';
          row.appendChild(you);
        }
        if (clickable) {
          row.addEventListener('click', () => {
            w.setOpen(false);
            const me = window.TrollrunnerAccounts?.getCachedProfile?.();
            if (me && who.userId === me.id) window.TrollrunnerAccounts?.openProfile?.();
            else if (typeof window.openViewerProfileCard === 'function') window.openViewerProfileCard(who.userId, who.username);
            else window.TrollrunnerAccounts?.openProfileCard?.(who.userId);
          });
        }
        w.rows.appendChild(row);
      });
    });
  }

  function mount(container, opts) {
    if (!container) return null;
    injectStyles();
    const align = opts?.align === 'left' ? 'left' : 'right';

    const wrap = document.createElement('div');
    wrap.className = 'tp-wrap';
    wrap.dataset.align = align;

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'tp-pill';
    pill.setAttribute('aria-haspopup', 'true');
    pill.setAttribute('aria-expanded', 'false');
    const dot = document.createElement('span');
    dot.className = 'tp-dot';
    dot.setAttribute('aria-hidden', 'true');
    const countEl = document.createElement('span');
    countEl.className = 'tp-count';
    countEl.textContent = '1';
    pill.append(dot, countEl);

    const pop = document.createElement('div');
    pop.className = 'tp-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', "Who's online");
    const sub = document.createElement('p');
    sub.className = 'tp-pop-sub';
    const rows = document.createElement('div');
    pop.append(sub, rows);

    wrap.append(pill, pop);
    container.appendChild(wrap);

    const setOpen = open => {
      pop.classList.toggle('is-open', open);
      pill.setAttribute('aria-expanded', String(open));
    };
    pill.addEventListener('click', () => setOpen(!pop.classList.contains('is-open')));
    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });

    widgets.push({ pill, countEl, sub, rows, setOpen });
    paintAll();
    return wrap;
  }

  window.addEventListener('trollrunner:auth-changed', viewersRetrack);

  function connect() {
    if (!window.supabase?.createClient) return;
    try {
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      viewerChannel = client.channel(VIEWER_CHANNEL, { config: { presence: { key: getViewerId() } } });
      viewerChannel
        .on('presence', { event: 'sync' }, paintAll)
        .subscribe(status => {
          if (status !== 'SUBSCRIBED') return;
          viewerJoined = true;
          viewerChannel.track(viewerPayload());
        });
      // Heartbeat: re-track every 30s so trackedAt stays fresh and every
      // client's roster (including our own) repaints on a steady cadence.
      setInterval(viewersRetrack, 30000);
    } catch {}
  }

  window.TrollPresence = { mount };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect, { once: true });
  } else {
    connect();
  }
})();
