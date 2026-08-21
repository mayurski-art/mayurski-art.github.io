/* ============================================================================
   TROLL MAP — the world map at trollrunner.net/maps.
   Ported 1:1 from the trollrunner-maps Next.js app (MapLibre GL + the shared
   TrollRunner Supabase project) into vanilla JS, the same way stickers.html
   and pfp.html fold a standalone app into a same-origin page. Login/session
   comes from window.TrollrunnerAccounts (assets/js/troll-accounts.js),
   already loaded on this page, so there's no separate auth system here.

   Table/RPC surface (see trollrunner-maps/supabase/troll_locations.sql):
     troll_locations_view   — public.select, joined to profile identity
     troll_locations         — the caller's own row (visibility/read)
     troll_set_location()    — the only door into moving a pin
     troll_top_locations()   — Top Cities leaderboard
   ========================================================================= */
(function () {
  'use strict';

  const CITY_ZOOM = 9;
  const HOME_ZOOM = 2;
  const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

  // The stock dark style paints water lighter than land, which reads as a
  // flat grey wash from orbit — this repaints it the way a map should look.
  const REPAINT = [
    ['background', 'background-color', '#1b2331'],
    ['water', 'fill-color', '#070d17'],
    ['waterway', 'line-color', '#0b1524'],
    ['landcover_wood', 'fill-color', '#1b2a26'],
    ['landuse_park', 'fill-color', '#1b2a26'],
    ['landuse_residential', 'fill-color', '#212a39'],
    ['landcover_glacier', 'fill-color', '#2b3546'],
    ['landcover_ice_shelf', 'fill-color', '#232d3d'],
    ['building', 'fill-color', '#141b26'],
    ['boundary_country_z0-4', 'line-color', '#6b7a93'],
    ['boundary_country_z5-', 'line-color', '#6b7a93'],
    ['boundary_state', 'line-color', '#3f4b5e'],
    ['water_name', 'text-color', '#7f93b0'],
    ['water_name', 'text-halo-color', 'rgba(3,6,12,0.9)'],
  ];
  const LABEL_LAYERS = [
    'place_other', 'place_suburb', 'place_village', 'place_town',
    'place_city', 'place_city_large', 'place_state',
    'place_country_other', 'place_country_minor', 'place_country_major',
  ];

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* ── Geocoding — OpenStreetMap Nominatim, keyless, <1 req/s ─────────────── */
  function placeLabel(place) {
    const a = place.address || {};
    return a.city || a.town || a.village || a.municipality || a.county || a.state ||
      place.name || (place.display_name || '').split(',')[0];
  }

  async function geocode(query, signal) {
    const q = String(query || '').trim();
    if (q.length < 2) return [];
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '6');
    url.searchParams.set('featureType', 'settlement');
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Search is unavailable right now.');
    const places = await res.json();
    return places.map((place) => {
      const address = place.address || {};
      return {
        label: placeLabel(place),
        detail: place.display_name,
        lat: Number(place.lat),
        lng: Number(place.lon),
        country: address.country || null,
        countryCode: address.country_code ? address.country_code.toUpperCase() : null,
      };
    });
  }

  async function reverseGeocode(lat, lng, signal) {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', '10');
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error("Couldn't look up that spot.");
    const place = await res.json();
    if (!place || !place.lat) throw new Error('Nothing there — try a spot closer to a town.');
    const address = place.address || {};
    return {
      label: placeLabel(place),
      detail: place.display_name,
      lat, lng,
      country: address.country || null,
      countryCode: address.country_code ? address.country_code.toUpperCase() : null,
    };
  }

  /* ── Data layer — direct Supabase calls via the shared accounts client ─── */
  function sb() { return window.TrollrunnerAccounts.getClient(); }

  async function listPins() {
    const { data, error } = await sb()
      .from('troll_locations_view')
      .select('user_id, lat, lng, label, country, country_code, username, avatar_url, level, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => ({
      userId: row.user_id, lat: row.lat, lng: row.lng, label: row.label,
      country: row.country, countryCode: row.country_code, username: row.username,
      avatarUrl: row.avatar_url, level: row.level || 1, updatedAt: row.updated_at,
    }));
  }

  async function getMyLocation(userId) {
    const { data } = await sb()
      .from('troll_locations')
      .select('lat, lng, label, country, country_code, is_visible')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return null;
    return {
      lat: data.lat, lng: data.lng, label: data.label, country: data.country,
      countryCode: data.country_code, isVisible: data.is_visible,
    };
  }

  async function setMyLocation(input) {
    const { data, error } = await sb().rpc('troll_set_location', {
      p_lat: input.lat, p_lng: input.lng, p_label: input.label,
      p_country: input.country || null, p_country_code: input.countryCode || null,
    });
    if (error) throw new Error(error.message);
    if (data && !data.saved) {
      throw new Error(data.reason === 'too_fast'
        ? 'You just moved your pin — give it half a minute.'
        : 'Could not save that pin.');
    }
  }

  async function setMyLocationVisible(userId, isVisible) {
    const { error } = await sb().from('troll_locations').update({ is_visible: !!isVisible }).eq('user_id', userId);
    if (error) throw new Error(error.message);
  }

  async function removeMyLocation(userId) {
    const { error } = await sb().from('troll_locations').delete().eq('user_id', userId);
    if (error) throw new Error(error.message);
  }

  async function listTopLocations(limit) {
    const { data, error } = await sb().rpc('troll_top_locations', { p_limit: limit || 10 });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => ({
      label: row.label, country: row.country, countryCode: row.country_code,
      trolls: Number(row.trolls), lat: row.lat, lng: row.lng,
    }));
  }

  /* ── Pin markers — plain DOM, vector-crisp in both projections ─────────── */
  function pinSvg(fill, stroke) {
    return '<svg viewBox="0 0 26 34" aria-hidden="true">' +
      '<path d="M13 33.2C13 33.2 24.4 21.6 24.4 13.1 24.4 6.4 19.3 1 13 1S1.6 6.4 1.6 13.1C1.6 21.6 13 33.2 13 33.2Z" ' +
      'fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.1"/>' +
      '<circle cx="13" cy="12.7" r="4.1" fill="rgba(255,255,255,0.94)"/></svg>';
  }

  function buildPinElement(pin, opts) {
    const el = document.createElement('div');
    el.className = opts.isMine ? 'pin pin--mine' : 'pin';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    const place = pin.country ? pin.label + ', ' + pin.country : pin.label;
    el.setAttribute('aria-label', pin.username + ' — ' + place);
    el.innerHTML = opts.isMine ? pinSvg('#ffb020', 'rgba(94,54,0,0.65)') : pinSvg('#ff2d55', 'rgba(94,8,26,0.6)');

    const card = document.createElement('div');
    card.className = 'pin-card';
    const avatar = document.createElement(pin.avatarUrl ? 'img' : 'span');
    avatar.className = 'pin-card__avatar';
    if (pin.avatarUrl && avatar instanceof HTMLImageElement) {
      avatar.src = pin.avatarUrl; avatar.alt = ''; avatar.loading = 'lazy';
    } else {
      avatar.textContent = (pin.username || '?').trim()[0]?.toUpperCase() || '?';
    }
    const text = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'pin-card__name';
    name.textContent = pin.username + ' · LV ' + pin.level;
    const where = document.createElement('div');
    where.className = 'pin-card__place';
    where.textContent = place;
    text.append(name, where);
    card.append(avatar, text);
    el.appendChild(card);

    if (opts.onSelect) {
      const select = () => opts.onSelect(pin);
      el.addEventListener('click', select);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
      });
    }
    return el;
  }

  /* ── State ────────────────────────────────────────────────────────────── */
  const state = {
    mode: '3d',
    panel: 'none', // none | pin | auth | top
    pins: [],
    myLocation: null,
    draft: null,
    loadError: null,
    picking: false,
    pickError: null,
    session: null,
  };

  let map = null;
  let markers = [];
  let mapReady = false;

  /* ── Map ──────────────────────────────────────────────────────────────── */
  function initMap() {
    map = new maplibregl.Map({
      container: document.getElementById('map'),
      style: STYLE_URL,
      center: [-40, 20],
      zoom: HOME_ZOOM,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('error', (event) => { console.warn('[map]', event?.error?.message || event); });
    map.on('style.load', () => {
      mapReady = true;
      const repaint = (layer, prop, value) => { if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value); };
      REPAINT.forEach(([layer, prop, value]) => repaint(layer, prop, value));
      LABEL_LAYERS.forEach((layer) => {
        repaint(layer, 'text-color', '#e2e9f5');
        repaint(layer, 'text-halo-color', 'rgba(3,6,12,0.95)');
      });
      map.setProjection({ type: state.mode === '3d' ? 'globe' : 'mercator' });
    });
    map.on('click', (event) => {
      if (state.picking) handleMapPick(event.lngLat.lat, event.lngLat.lng);
    });
  }

  function flyTo(lat, lng, zoom) {
    map && map.flyTo({ center: [lng, lat], zoom: zoom == null ? CITY_ZOOM : zoom, duration: 1600, essential: true });
  }

  function setPicking(next) {
    state.picking = next;
    document.getElementById('pick-banner').style.display = next ? '' : 'none';
    if (map) map.getCanvas().style.cursor = next ? 'crosshair' : '';
  }

  function renderMarkers() {
    if (!map) return;
    markers.forEach((m) => m.remove());
    markers = [];
    const myUserId = state.session ? state.session.userId : null;
    let visible = state.draft ? state.pins.filter((p) => p.userId !== myUserId) : state.pins.slice();
    if (state.draft) {
      visible.push({
        userId: myUserId || 'draft', lat: state.draft.lat, lng: state.draft.lng,
        label: state.draft.label, country: null, countryCode: null,
        username: 'Your pin', avatarUrl: null, level: 1, updatedAt: new Date().toISOString(),
      });
    }
    visible.forEach((pin) => {
      const el = buildPinElement(pin, {
        isMine: pin.userId === myUserId,
        onSelect: (p) => flyTo(p.lat, p.lng, CITY_ZOOM),
      });
      markers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([pin.lng, pin.lat]).addTo(map));
    });
  }

  /* ── Draft / picking flow ────────────────────────────────────────────── */
  function handleDraftChange(next) {
    state.draft = next;
    if (next) flyTo(next.lat, next.lng, CITY_ZOOM);
    renderMarkers();
    renderPanel();
  }

  function handleMapPick(lat, lng) {
    setPicking(false);
    state.pickError = null;
    reverseGeocode(lat, lng)
      .then((result) => handleDraftChange(result))
      .catch((err) => { state.pickError = err.message || "Couldn't look up that spot."; renderPanel(); });
  }

  /* ── Data refresh ────────────────────────────────────────────────────── */
  async function refreshPins() {
    try {
      state.pins = await listPins();
      state.loadError = null;
    } catch (err) {
      state.loadError = err.message || 'Could not load the map.';
    }
    renderStats();
    renderMarkers();
  }

  async function refreshMyLocation() {
    if (!state.session) { state.myLocation = null; return; }
    try { state.myLocation = await getMyLocation(state.session.userId); }
    catch { state.myLocation = null; }
  }

  async function refreshAll() {
    await Promise.all([refreshPins(), refreshMyLocation()]);
    renderPanel();
  }

  /* ── Session ─────────────────────────────────────────────────────────── */
  function updateDropPinButtonLabel() {
    document.getElementById('drop-pin-label').textContent = state.myLocation ? 'My pin' : 'Drop my pin';
  }

  function renderSessionButton() {
    const btn = document.getElementById('session-btn');
    if (state.session) {
      btn.style.display = '';
      btn.textContent = state.session.username;
      btn.title = 'Logged in as ' + state.session.username + ' — click to log out';
    } else {
      btn.style.display = 'none';
    }
  }

  async function refreshSession() {
    try { state.session = await window.TrollrunnerAccounts.getSession(); }
    catch { state.session = null; }
    renderSessionButton();
    updateDropPinButtonLabel();
    await refreshAll();
  }

  window.addEventListener('trollrunner:auth-changed', (event) => {
    state.session = event.detail || null;
    renderSessionButton();
    updateDropPinButtonLabel();
    refreshAll();
  });

  /* ── Side panel ──────────────────────────────────────────────────────── */
  function closePanel() {
    state.panel = 'none';
    state.draft = null;
    setPicking(false);
    renderMarkers();
    renderPanel();
  }

  function openPinPanel() {
    state.panel = state.session ? 'pin' : 'auth';
    renderPanel();
  }

  function renderPanel() {
    const host = document.getElementById('side-panel');
    if (state.panel === 'none') { host.classList.remove('open'); host.innerHTML = ''; return; }
    host.classList.add('open');
    if (state.panel === 'auth') renderAuthPanel(host);
    else if (state.panel === 'pin') renderPinPanel(host);
    else if (state.panel === 'top') renderTopPanel(host);
  }

  /* ── Auth panel ──────────────────────────────────────────────────────── */
  function renderAuthPanel(host) {
    let mode = host.dataset.authMode || 'login';
    host.innerHTML =
      '<div class="stack">' +
      '<div><h2>' + (mode === 'login' ? 'Log in to drop your pin' : 'Create your troll account') + '</h2>' +
      '<p>One account works across every TrollRunner site.</p></div>' +
      '<div class="mode-tabs">' +
      '<button type="button" data-authmode="login" class="' + (mode === 'login' ? 'active' : '') + '">Log in</button>' +
      '<button type="button" data-authmode="register" class="' + (mode === 'register' ? 'active' : '') + '">Sign up</button>' +
      '</div>' +
      '<form id="auth-form" class="stack-sm">' +
      (mode === 'login'
        ? '<label class="block"><span class="field-label">Username or email</span>' +
          '<input class="field" id="auth-identifier" autocomplete="username" required></label>'
        : '<label class="block"><span class="field-label">Username</span>' +
          '<input class="field" id="auth-username" autocomplete="username" maxlength="20" required></label>' +
          '<label class="block"><span class="field-label">Email (optional)</span>' +
          '<input class="field" id="auth-email" type="email" autocomplete="email"></label>') +
      '<label class="block"><span class="field-label">Password</span>' +
      '<input class="field" id="auth-password" type="password" autocomplete="' + (mode === 'login' ? 'current-password' : 'new-password') + '" required></label>' +
      '<p id="auth-error" class="error-text" style="display:none;" role="alert"></p>' +
      '<button type="submit" class="btn btn--primary" style="width:100%;" id="auth-submit">' + (mode === 'login' ? 'Log in' : 'Create account') + '</button>' +
      '</form>' +
      '</div>';

    host.querySelectorAll('[data-authmode]').forEach((btn) => {
      btn.addEventListener('click', () => { host.dataset.authMode = btn.dataset.authmode; renderAuthPanel(host); });
    });

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('auth-error');
      const submitBtn = document.getElementById('auth-submit');
      errEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Working…';
      try {
        if (mode === 'login') {
          await window.TrollrunnerAccounts.login({
            identifier: document.getElementById('auth-identifier').value,
            password: document.getElementById('auth-password').value,
          });
        } else {
          await window.TrollrunnerAccounts.register({
            username: document.getElementById('auth-username').value,
            email: document.getElementById('auth-email').value,
            password: document.getElementById('auth-password').value,
          });
        }
        state.session = await window.TrollrunnerAccounts.getSession();
        renderSessionButton();
        updateDropPinButtonLabel();
        await refreshAll();
        state.panel = 'pin';
        renderPanel();
      } catch (err) {
        errEl.textContent = err.message || 'Something went wrong.';
        errEl.style.display = '';
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'login' ? 'Log in' : 'Create account';
      }
    });
  }

  /* ── Pin composer ────────────────────────────────────────────────────── */
  let pinSearchAbort = null;
  function renderPinPanel(host) {
    const myLocation = state.myLocation;
    const draft = state.draft;
    const visible = draft ? true : (myLocation ? myLocation.isVisible : true);

    host.innerHTML =
      '<div class="stack">' +
      '<div class="panel-head">' +
      '<div><h2>' + (myLocation ? 'Your pin' : 'Drop your pin') + '</h2>' +
      '<p>Pick the town you rep. Nothing more precise than that gets stored.</p></div>' +
      '<button type="button" class="btn btn--ghost" style="padding:4px 12px;font-size:12px;" id="pin-close" aria-label="Close">Close</button>' +
      '</div>' +
      (myLocation && !draft
        ? '<div class="saved-pin"><p class="name">' + esc(myLocation.label) + '</p>' +
          (myLocation.country ? '<p class="country">' + esc(myLocation.country) + '</p>' : '') + '</div>'
        : '') +
      '<label class="block"><span class="field-label">' + (myLocation ? 'Move your pin' : 'Search for your city') + '</span>' +
      '<input class="field" id="pin-search" placeholder="e.g. Los Angeles, California" autocomplete="off"></label>' +
      '<button type="button" class="btn ' + (state.picking ? 'btn--primary' : 'btn--ghost') + '" style="width:100%;font-size:14px;" id="pin-pick-toggle">' +
      (state.picking ? 'Cancel — click the map to place your pin' : 'Or pick a spot on the map') + '</button>' +
      (state.pickError ? '<p class="error-text" role="alert">' + esc(state.pickError) + '</p>' : '') +
      '<p id="pin-searching" style="display:none;font-size:12px;color:var(--muted);">Searching…</p>' +
      '<ul id="pin-search-results" class="scroll-thin" style="display:none;max-height:14rem;overflow-y:auto;"></ul>' +
      '<label class="visible-row"><input type="checkbox" id="pin-visible" ' + (visible ? 'checked' : '') + '>' +
      '<span><span class="title">Show my pin publicly</span>' +
      '<span class="sub">Off means only you can see it — it disappears from the map and from your profile.</span></span></label>' +
      '<p id="pin-error" class="error-text" style="display:none;" role="alert"></p>' +
      '<div class="row-btns">' +
      '<button type="button" class="btn btn--primary" id="pin-save" ' + (draft ? '' : 'disabled') + '>' + (myLocation ? 'Move my pin here' : 'Drop my pin') + '</button>' +
      (myLocation ? '<button type="button" class="btn btn--danger" id="pin-remove">Remove</button>' : '') +
      '</div>' +
      '</div>';

    document.getElementById('pin-close').addEventListener('click', closePanel);

    const searchInput = document.getElementById('pin-search');
    const resultsEl = document.getElementById('pin-search-results');
    const searchingEl = document.getElementById('pin-searching');
    let debounceTimer = null;
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();
      clearTimeout(debounceTimer);
      if (q.length < 2) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; searchingEl.style.display = 'none'; return; }
      debounceTimer = setTimeout(async () => {
        if (pinSearchAbort) pinSearchAbort.abort();
        pinSearchAbort = new AbortController();
        searchingEl.style.display = '';
        try {
          const results = await geocode(q, pinSearchAbort.signal);
          searchingEl.style.display = 'none';
          renderPinResults(resultsEl, results);
        } catch (err) {
          if (err.name !== 'AbortError') searchingEl.style.display = 'none';
        }
      }, 450);
    });

    document.getElementById('pin-pick-toggle').addEventListener('click', () => {
      state.pickError = null;
      setPicking(!state.picking);
      renderPanel();
    });

    document.getElementById('pin-visible').addEventListener('change', async (e) => {
      const next = e.target.checked;
      if (!state.session || !myLocation) return;
      try {
        await setMyLocationVisible(state.session.userId, next);
        await refreshAll();
      } catch (err) {
        e.target.checked = !next;
        showPinError(err.message || 'Could not update visibility.');
      }
    });

    document.getElementById('pin-save').addEventListener('click', async () => {
      if (!state.draft) return;
      const saveBtn = document.getElementById('pin-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      try {
        await setMyLocation({
          lat: state.draft.lat, lng: state.draft.lng, label: state.draft.label,
          country: state.draft.country, countryCode: state.draft.countryCode,
        });
        if (state.session && !document.getElementById('pin-visible').checked) {
          await setMyLocationVisible(state.session.userId, false);
        }
        state.draft = null;
        await refreshAll();
      } catch (err) {
        showPinError(err.message || 'Could not save your pin.');
        saveBtn.disabled = false;
        saveBtn.textContent = myLocation ? 'Move my pin here' : 'Drop my pin';
      }
    });

    const removeBtn = document.getElementById('pin-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        if (!state.session) return;
        removeBtn.disabled = true;
        try {
          await removeMyLocation(state.session.userId);
          state.draft = null;
          await refreshAll();
        } catch (err) {
          showPinError(err.message || 'Could not remove your pin.');
          removeBtn.disabled = false;
        }
      });
    }

    function showPinError(msg) {
      const el = document.getElementById('pin-error');
      el.textContent = msg;
      el.style.display = '';
    }
  }

  function renderPinResults(resultsEl, results) {
    if (!results.length) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
    resultsEl.style.display = '';
    resultsEl.innerHTML = results.map((r, i) =>
      '<li><button type="button" data-idx="' + i + '" style="width:100%;text-align:left;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.05);padding:8px 12px;cursor:pointer;color:inherit;font:inherit;margin-bottom:4px;">' +
      '<span class="result-label">' + esc(r.label) + '</span>' +
      '<span class="result-detail">' + esc(r.detail) + '</span></button></li>'
    ).join('');
    resultsEl.querySelectorAll('button[data-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        handleDraftChange(results[Number(btn.dataset.idx)]);
      });
    });
  }

  /* ── Top cities panel ────────────────────────────────────────────────── */
  function renderTopPanel(host) {
    host.innerHTML =
      '<div class="stack">' +
      '<div class="panel-head"><h2>Top cities</h2>' +
      '<button type="button" class="btn btn--ghost" style="padding:4px 12px;font-size:12px;" id="top-close" aria-label="Close">Close</button></div>' +
      '<p id="top-status" style="font-size:14px;color:var(--muted);">Counting trolls…</p>' +
      '<ol id="top-list" class="scroll-thin" style="max-height:50vh;overflow-y:auto;display:none;"></ol>' +
      '</div>';
    document.getElementById('top-close').addEventListener('click', closePanel);

    listTopLocations(12).then((rows) => {
      const statusEl = document.getElementById('top-status');
      const listEl = document.getElementById('top-list');
      if (!statusEl || !listEl) return;
      if (!rows.length) { statusEl.textContent = 'No pins yet. Be the first one on the map.'; return; }
      statusEl.style.display = 'none';
      listEl.style.display = '';
      listEl.innerHTML = rows.map((row, i) =>
        '<li style="margin-bottom:4px;"><button type="button" class="top-row" data-idx="' + i + '">' +
        '<span class="rank">' + (i + 1) + '</span>' +
        '<span class="info"><span class="name">' + esc(row.label) + '</span>' +
        (row.country ? '<span class="country">' + esc(row.country) + '</span>' : '') + '</span>' +
        '<span class="count">' + row.trolls + '</span></button></li>'
      ).join('');
      listEl.querySelectorAll('button[data-idx]').forEach((btn) => {
        btn.addEventListener('click', () => flyTo(rows[Number(btn.dataset.idx)].lat, rows[Number(btn.dataset.idx)].lng, 0.5));
      });
    }).catch((err) => {
      const statusEl = document.getElementById('top-status');
      if (statusEl) statusEl.textContent = err.message || 'Could not load.';
    });
  }

  /* ── Stats + global search + projection toggle ──────────────────────── */
  function renderStats() {
    document.getElementById('pin-count').textContent = String(state.pins.length);
    document.getElementById('pin-count-label').textContent = state.pins.length === 1 ? 'troll on the map' : 'trolls on the map';
    const errEl = document.getElementById('load-error');
    if (state.loadError) { errEl.textContent = state.loadError; errEl.style.display = ''; }
    else errEl.style.display = 'none';
  }

  function initGlobalSearch() {
    const input = document.getElementById('global-search');
    const resultsEl = document.getElementById('global-search-results');
    let abort = null;
    let debounceTimer = null;
    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(debounceTimer);
      if (q.length < 2) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
      debounceTimer = setTimeout(async () => {
        if (abort) abort.abort();
        abort = new AbortController();
        try {
          const results = await geocode(q, abort.signal);
          if (!results.length) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
          resultsEl.style.display = '';
          resultsEl.innerHTML = results.map((r, i) =>
            '<li><button type="button" data-idx="' + i + '">' +
            '<span class="result-label">' + esc(r.label) + '</span>' +
            '<span class="result-detail">' + esc(r.detail) + '</span></button></li>'
          ).join('');
          resultsEl.querySelectorAll('button[data-idx]').forEach((btn) => {
            btn.addEventListener('mousedown', (e) => e.preventDefault());
            btn.addEventListener('click', () => {
              const r = results[Number(btn.dataset.idx)];
              flyTo(r.lat, r.lng, CITY_ZOOM);
              input.value = '';
              resultsEl.style.display = 'none';
              resultsEl.innerHTML = '';
            });
          });
        } catch {}
      }, 450);
    });
    input.addEventListener('blur', () => {
      window.setTimeout(() => { resultsEl.style.display = 'none'; }, 150);
    });
  }

  function initProjectionToggle() {
    document.querySelectorAll('.proj-toggle button').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.mode = btn.dataset.mode;
        document.querySelectorAll('.proj-toggle button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        if (map) {
          const apply = () => map.setProjection({ type: state.mode === '3d' ? 'globe' : 'mercator' });
          if (mapReady) apply(); else map.once('style.load', apply);
        }
      });
    });
  }

  /* ── Boot ────────────────────────────────────────────────────────────── */
  function boot() {
    initMap();
    initGlobalSearch();
    initProjectionToggle();

    document.getElementById('drop-pin-btn').addEventListener('click', openPinPanel);
    document.getElementById('top-cities-btn').addEventListener('click', () => {
      state.panel = state.panel === 'top' ? 'none' : 'top';
      renderPanel();
    });
    document.getElementById('session-btn').addEventListener('click', async () => {
      if (state.session && window.confirm('Log out of ' + state.session.username + '?')) {
        await window.TrollrunnerAccounts.logout();
      }
    });

    refreshSession();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
