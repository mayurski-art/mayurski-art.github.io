/* Troll Map mode for the BO2 menus: the backdrop planet (menu-globe.js)
   becomes the live troll map, and the menu gets map screens. Shared by the
   trollrunner.net home and the Troll Forces menu.

   createMapMode({ host, panelClass, getBackdrop, getMenu, getInset })
     host:        element the pin card and city-search panel go into
     panelClass:  the page's own panel class, so the search panel matches
     getInset():  { left }, { top } or { bottom } px of screen the menu covers
   -> { screens: { map, top, search, pin, pinsearch }, onScreen(id, screen), setMapMode(on) }

   "Drop my pin" (the pin screen) happens on the planet itself: tap a spot
   or search a town, tick the privacy row, save.

   Screens marked map: true keep the planet live; the page calls
   onScreen() from its menu's onScreen hook. With no WebGL (or before the
   planet loads) Troll Map opens the maps page instead. */

const CSS = `
.tr-pincard{--ax:0px;position:absolute;z-index:30;width:272px;box-sizing:border-box;padding:16px;color:#f3ece4;font-family:"DM Sans",system-ui,sans-serif;
  background:linear-gradient(180deg,rgba(34,14,6,.96),rgba(10,4,2,.96));border:1px solid rgba(255,176,32,.55);border-radius:12px;
  box-shadow:0 18px 40px rgba(0,0,0,.7),0 0 34px rgba(255,110,30,.2);transform:translate(-50%,calc(-100% - 34px));animation:tr-pc-in .18s ease-out}
.tr-pincard.is-below{transform:translate(-50%,34px)}
.tr-pincard[hidden]{display:none}
.tr-pincard.is-away{visibility:hidden}
.tr-pincard::after{content:"";position:absolute;left:calc(50% + var(--ax));bottom:-8px;width:14px;height:14px;margin-left:-7px;transform:rotate(45deg);
  background:rgba(10,4,2,.96);border:solid rgba(255,176,32,.55);border-width:0 1px 1px 0}
.tr-pincard.is-below::after{bottom:auto;top:-8px;background:rgba(34,14,6,.96);border-width:1px 0 0 1px}
@keyframes tr-pc-in{from{opacity:0}to{opacity:1}}
.tr-pc-top{display:flex;align-items:center;gap:14px;padding-right:18px}
.tr-pc-face{position:relative;flex-shrink:0;width:64px;height:64px}
.tr-pc-face img,.tr-pc-face i{display:block;width:100%;height:100%;box-sizing:border-box;border-radius:50%;object-fit:cover;border:2px solid #ffb84a;background:#2a170d;
  box-shadow:0 0 18px 2px rgba(255,120,30,.45)}
.tr-pc-face i{font:600 30px/60px Oswald,"Arial Narrow",sans-serif;font-style:normal;color:#ff8a1f;text-align:center}
.tr-pc-name{margin:0;font:500 24px/1.1 Oswald,"Arial Narrow",sans-serif;letter-spacing:.03em;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px}
.tr-pc-lv{display:inline-block;margin-top:6px;padding:2px 8px;border-radius:6px;background:#ff8a1f;color:#1a0904;font:700 13px/18px Oswald,"Arial Narrow",sans-serif;letter-spacing:.06em}
.tr-pc-where{display:flex;align-items:flex-start;gap:6px;margin:14px 0 0;padding-top:12px;border-top:1px solid rgba(243,236,228,.12);font-size:14px;line-height:1.35;color:#e2d6c8}
.tr-pc-where svg{flex-shrink:0;margin-top:2px;color:#ff8a1f}
.tr-pc-view{display:block;width:100%;min-height:40px;margin-top:12px;border:1px solid rgba(255,138,31,.7);border-radius:8px;background:rgba(255,138,31,.14);color:#ffd2a6;cursor:pointer;
  font:500 16px/1 Oswald,"Arial Narrow",sans-serif;letter-spacing:.08em;text-transform:uppercase}
.tr-pc-view:hover,.tr-pc-view:focus-visible{background:#ff8a1f;color:#1a0904;outline:none}
.tr-pc-x{position:absolute;top:8px;right:8px;width:28px;height:28px;border:0;border-radius:6px;background:none;color:#c9b8a6;font-size:20px;line-height:28px;cursor:pointer}
.tr-pc-x:hover,.tr-pc-x:focus-visible{color:#fff;background:rgba(255,255,255,.08);outline:none}
.tr-citysearch label{display:block;margin:0 0 8px;color:#e2d6c8;font-size:14px}
.tr-citysearch input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid rgba(243,236,228,.16);background:rgba(0,0,0,.45);color:#f3ece4;font:15px "DM Sans",system-ui,sans-serif}
.tr-citysearch input:focus{outline:2px solid #ff8a1f;outline-offset:1px}
.tr-results{display:flex;flex-direction:column;margin-top:10px;color:#c9b8a6;font-size:14px}
.tr-result{display:flex;flex-direction:column;align-items:flex-start;min-height:44px;padding:8px 10px;border:0;border-top:1px solid rgba(243,236,228,.16);background:none;color:#f3ece4;text-align:left;cursor:pointer;font:500 16px Oswald,"Arial Narrow",sans-serif;letter-spacing:.03em}
.tr-result small{font:13px "DM Sans",system-ui,sans-serif;color:#c9b8a6;letter-spacing:0}
.tr-result:hover,.tr-result:focus-visible{background:rgba(255,138,31,.16);outline:none}
`;

// Set before leaving for X. maps.html stores "1" and opens its own pin flow;
// the menus store their page's path and reopen the pin screen.
const PIN_INTENT_KEY = "trollrunner_maps_pin_intent";

export function createMapMode({ host, panelClass = "", getBackdrop, getMenu, getInset }) {
  if (!document.getElementById("tr-mapmode-css")) {
    const st = document.createElement("style");
    st.id = "tr-mapmode-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const card = document.createElement("div");
  card.className = "tr-pincard";
  card.hidden = true;
  const panel = document.createElement("section");
  panel.className = `${panelClass} tr-citysearch`.trim();
  panel.setAttribute("aria-label", "Find a city");
  panel.hidden = true;
  panel.innerHTML = `<label for="tr-city-q">Search a city or town</label>
    <input id="tr-city-q" type="search" placeholder="e.g. Fontana" autocomplete="off" enterkeyhint="search">
    <div class="tr-results" aria-live="polite"></div>`;
  host.append(panel, card);
  const input = panel.querySelector("input");
  const out = panel.querySelector(".tr-results");

  let topCities = [], topLoading = false, topAt = 0;
  let wantMap = false;
  const backdrop = () => getBackdrop && getBackdrop();
  const menu = () => getMenu && getMenu();
  const trollCount = () => { const b = backdrop(); return b && b.pins.length ? `${b.pins.length} trolls` : ""; };
  const flyTo = (lat, lng, z) => { const b = backdrop(); if (b) b.flyTo(lat, lng, z); };

  /* ── Drop my pin, right on the planet ─────────────────────────────────
     Same rules as maps.html (troll-map.js): an account with X linked,
     the privacy ack, then troll_set_location() is the only way a pin
     moves. Only the town (reverse-geocoded at city zoom) is stored. */
  const A = () => window.TrollrunnerAccounts;
  const pin = { phase: "idle", session: null, my: null, draft: null, consent: false, visible: true, busy: false, msg: "", sure: false };
  const placeLabel = (pl) => { const a = pl.address || {}; return a.city || a.town || a.village || a.municipality || a.county || a.state || pl.name || (pl.display_name || "").split(",")[0]; };
  const where = (p) => [p.label, p.country].filter(Boolean).join(", ");
  const onPinScreen = () => { const m = menu(); return m && (m.current() === "pin" || m.current() === "pinsearch"); };
  const repaint = (hotId) => { const m = menu(); if (m && onPinScreen()) { m.refresh(); if (hotId) m.highlight(hotId); } };

  async function loadPin() {
    const acc = A();
    if (!acc?.getSession) { pin.phase = "error"; repaint(); return; }
    pin.phase = "loading"; pin.msg = ""; pin.sure = false;
    repaint();
    try {
      pin.session = await acc.getSession();
      if (!pin.session) pin.phase = "auth";
      else if (!(await acc.getXIdentity())) pin.phase = "x";
      else {
        const { data } = await acc.getClient().from("troll_locations")
          .select("lat, lng, label, country, country_code, is_visible").eq("user_id", pin.session.userId).maybeSingle();
        pin.my = data ? { lat: data.lat, lng: data.lng, label: data.label, country: data.country, isVisible: data.is_visible } : null;
        pin.visible = pin.my ? pin.my.isVisible !== false : true;
        pin.phase = "ready";
      }
    } catch { pin.phase = "error"; }
    syncPicker();
    // "Checking..." was the only row, so the highlight sat on Back.
    repaint({ auth: "p-xin", x: "p-x", ready: "p-spot", error: "p-retry" }[pin.phase]);
    if (pin.phase === "ready" && pin.my && !pin.draft) flyTo(pin.my.lat, pin.my.lng, 3.5);
  }

  function syncPicker() {
    const b = backdrop();
    if (!b || !b.setPicker) return;
    const on = pin.phase === "ready" && menu()?.current() === "pin";
    b.setPicker(on ? pickSpot : null);
    b.setDraft(onPinScreen() ? pin.draft : null);
  }

  function setDraft(d) {
    pin.draft = d; pin.msg = ""; pin.sure = false;
    const b = backdrop();
    if (b && b.setDraft) b.setDraft(d);
  }

  let pickCtl = null;
  async function pickSpot({ lat, lng }) {
    hideCard();
    setDraft({ lat, lng, label: "Looking it up...", country: "", pending: true });
    repaint("p-spot");
    if (pickCtl) pickCtl.abort();
    pickCtl = new AbortController();
    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.search = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "jsonv2", addressdetails: "1", zoom: "10" });
      const res = await fetch(url, { signal: pickCtl.signal, headers: { Accept: "application/json" } });
      const place = res.ok ? await res.json() : null;
      if (!place || !place.lat) throw new Error("Nothing there. Try a spot closer to a town.");
      const a = place.address || {};
      setDraft({ lat, lng, label: placeLabel(place), country: a.country || "", countryCode: a.country_code ? a.country_code.toUpperCase() : "" });
    } catch (e) {
      if (e.name === "AbortError") return;
      setDraft(null);
      pin.msg = e.message.startsWith("Nothing") ? e.message : "Couldn't look up that spot.";
    }
    repaint("p-spot");
  }

  async function savePin() {
    if (!pin.draft || pin.draft.pending || !pin.consent || pin.busy) return;
    pin.busy = true; repaint("p-save");
    const d = pin.draft;
    try {
      const sb = A().getClient();
      const { data, error } = await sb.rpc("troll_set_location", {
        p_lat: d.lat, p_lng: d.lng, p_label: d.label, p_country: d.country || null, p_country_code: d.countryCode || null,
      });
      if (error) throw new Error(error.message);
      if (data && !data.saved) throw new Error(data.reason === "too_fast" ? "You just moved your pin. Give it half a minute." : "Could not save that pin.");
      if (!pin.visible) await sb.from("troll_locations").update({ is_visible: false }).eq("user_id", pin.session.userId);
      // The server caps 'map_pin' at one award ever, so every save can ask.
      void A().awardXp?.("map_pin", "maps");
      pin.my = { lat: d.lat, lng: d.lng, label: d.label, country: d.country, isVisible: pin.visible };
      setDraft(null);
      pin.consent = false;
      pin.msg = pin.visible ? `Pinned: ${where(pin.my)}. You're on the map.` : `Saved ${where(pin.my)}. Only you can see it.`;
      backdrop()?.refreshPins();
    } catch (e) { pin.msg = e.message || "Could not save your pin."; }
    pin.busy = false;
    repaint("p-save");
  }

  async function setVisible(next) {
    pin.visible = next;
    if (!pin.my || pin.draft) { repaint("p-public"); return; }
    try {
      const { error } = await A().getClient().from("troll_locations").update({ is_visible: next }).eq("user_id", pin.session.userId);
      if (error) throw error;
      pin.my.isVisible = next;
      pin.msg = next ? "Your pin is public again." : "Hidden. Only you can see your pin now.";
      backdrop()?.refreshPins();
    } catch { pin.visible = !next; pin.msg = "Could not update that."; }
    repaint("p-public");
  }

  async function removePin() {
    if (!pin.sure) { pin.sure = true; repaint("p-remove"); return; }
    pin.sure = false;
    try {
      const { error } = await A().getClient().from("troll_locations").delete().eq("user_id", pin.session.userId);
      if (error) throw error;
      pin.my = null; pin.visible = true;
      pin.msg = "Pin removed.";
      backdrop()?.refreshPins();
    } catch { pin.msg = "Could not remove your pin."; }
    repaint(pin.my ? "p-remove" : "p-spot");
  }

  // X sign-in and linking leave the page; this brings the visitor back to
  // the pin screen when they land (troll-map.js reads the same key).
  async function goX(fn) {
    try { sessionStorage.setItem(PIN_INTENT_KEY, location.pathname); } catch {}
    try { await fn(); }
    catch (e) { try { sessionStorage.removeItem(PIN_INTENT_KEY); } catch {} pin.msg = e.message || "Could not reach X."; repaint(); }
  }

  window.addEventListener("trollrunner:auth-changed", () => { if (onPinScreen()) loadPin(); });

  function resumeIntent() {
    let want = null;
    try { want = sessionStorage.getItem(PIN_INTENT_KEY); } catch {}
    // "1" is maps.html's own marker; ours is the page we left from.
    if (!want || want !== location.pathname) return;
    let tries = 0;
    const t = setInterval(() => {
      const b = backdrop(), m = menu();
      if (++tries > 60) { clearInterval(t); return; }
      if (!b || !b.map || !m || !b.map.isStyleLoaded()) return;
      clearInterval(t);
      try { sessionStorage.removeItem(PIN_INTENT_KEY); } catch {}
      const notice = A()?.consumeXSigninNotice?.();
      if (m.current() !== "map") m.go("map");
      m.go("pin");
      if (notice) pin.msg = notice.error || (notice.justCreated ? "Account made from your X. Now pick your town." : "X connected. Now pick your town.");
    }, 500);
  }
  setTimeout(resumeIntent, 0);

  function pinScreen() {
    const back = backRow("Back to the map menu.");
    const say = (d) => pin.msg || d;
    if (pin.phase === "idle" || pin.phase === "loading") return { title: "Drop My Pin", map: true, groups: [[{ id: "p-wait", label: "Checking your account...", desc: "One sec.", disabled: true }], [back]] };
    if (pin.phase === "error") return { title: "Drop My Pin", map: true, groups: [[{ id: "p-retry", label: "Try again", desc: say("Couldn't reach your account. Check your connection."), onSelect: loadPin }], [back]] };
    if (pin.phase === "auth") return {
      title: "Drop My Pin", map: true,
      groups: [
        [
          { id: "p-xin", label: "Continue with X", desc: say("Pins need X connected. If you're new here, it makes you an account on the spot."), onSelect: () => goX(() => A().signInWithX()) },
          { id: "p-login", label: "Log in", desc: "Use your TrollRunner username, then connect X.", onSelect: () => A().openLogin?.("login") },
        ],
        [back],
      ],
    };
    if (pin.phase === "x") return {
      title: "Drop My Pin", map: true,
      groups: [[{ id: "p-x", label: "Connect X", desc: say("Pins are tied to a real X account so the map stays legit. Link yours and you're set."), onSelect: () => goX(() => A().connectX()) }], [back]],
    };
    const d = pin.draft, my = pin.my;
    const ready = d && !d.pending && pin.consent && !pin.busy;
    return {
      title: my ? "Your Pin" : "Drop My Pin", map: true,
      groups: [
        [
          { id: "p-spot", label: d ? "Spot" : (my ? "Your town" : "Pick a spot"), value: d ? where(d) : (my ? where(my) : "tap the planet"),
            desc: say(d ? "Tap somewhere else to change it. Only the town gets stored, never the exact spot." : "Tap the planet where you rep. Only the town gets stored, never the exact spot."),
            onSelect: () => { const p = d || my; if (p) flyTo(p.lat, p.lng, 4.5); } },
          { id: "p-find", label: "Search a city", desc: "Type your town instead of tapping.", go: "pinsearch" },
        ],
        [
          { id: "p-public", label: "Show publicly", value: pin.visible ? "On" : "Off", adjust: () => setVisible(!pin.visible),
            desc: say("Off means only you can see it. It disappears from the map and your profile.") },
          { id: "p-agree", label: "I understand", value: pin.consent ? "Yes" : "No", adjust: () => { pin.consent = !pin.consent; pin.msg = ""; },
            desc: "This marks a general area only. Please don't put it on your exact home address." },
          { id: "p-save", label: pin.busy ? "Saving..." : (my ? "Move my pin here" : "Drop my pin"), disabled: !ready,
            desc: say(!d ? "Pick a spot first." : !pin.consent ? "Tick I understand first." : `Pin ${where(d)}.`), onSelect: savePin },
          my && { id: "p-remove", label: pin.sure ? "Press again to remove" : "Remove my pin", desc: say("Takes your pin off the map."), onSelect: removePin },
        ],
        [back],
      ],
    };
  }

  async function loadTop() {
    if (topLoading || Date.now() - topAt < 60000) return;
    const sb = window.TrollrunnerAccounts?.getClient?.();
    if (!sb) return;
    topLoading = true;
    try {
      const { data } = await sb.rpc("troll_top_locations", { p_limit: 8 });
      topCities = (data || []).map((r) => ({ label: r.label, country: r.country, trolls: Number(r.trolls) || 0, lat: r.lat, lng: r.lng }));
      topAt = Date.now();
    } catch {}
    topLoading = false;
    const m = menu();
    if (m && m.current() === "top") { m.refresh(); if (topCities.length) m.highlight("t-0"); }
  }

  // The player card: who's on that spot. It rides along with the pin as
  // the planet turns and steps aside when the pin goes round the back.
  let cardPin = null, moveHooked = false;
  function hideCard() {
    card.hidden = true;
    cardPin = null;
    backdrop()?.markFace?.(null);
  }
  function placeCard() {
    if (!cardPin) return;
    const b = backdrop();
    const at = b && b.screenPoint ? b.screenPoint(cardPin.lat, cardPin.lng) : null;
    card.classList.toggle("is-away", !at);
    if (!at) return;
    const W = host.clientWidth, half = card.offsetWidth / 2;
    const x = Math.max(half + 8, Math.min(W - half - 8, at.x));
    card.style.left = `${x}px`;
    card.style.top = `${at.y}px`;
    card.style.setProperty("--ax", `${Math.max(-half + 18, Math.min(half - 18, at.x - x))}px`);
    card.classList.toggle("is-below", at.y - card.offsetHeight - 34 < 8);
  }
  function showPinCard(pin) {
    if (!pin) { hideCard(); return; }
    cardPin = pin;
    const face = document.createElement("div");
    face.className = "tr-pc-face";
    const initial = () => { const i = document.createElement("i"); i.textContent = (pin.username || "?")[0].toUpperCase(); return i; };
    let pic = initial();
    if (pin.avatarUrl) {
      const img = document.createElement("img");
      img.alt = "";
      img.addEventListener("error", () => img.replaceWith(initial()), { once: true });
      img.src = pin.avatarUrl;
      pic = img;
    }
    face.appendChild(pic);
    const who = document.createElement("div");
    const name = document.createElement("h2"); name.className = "tr-pc-name"; name.textContent = pin.username;
    const lv = document.createElement("span"); lv.className = "tr-pc-lv"; lv.textContent = `LV ${pin.level}`;
    who.append(name, lv);
    const top = document.createElement("div"); top.className = "tr-pc-top";
    top.append(face, who);
    const where = document.createElement("p"); where.className = "tr-pc-where";
    where.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>';
    where.append(document.createTextNode([pin.label, pin.country].filter(Boolean).join(", ") || "Somewhere on the planet"));
    const x = document.createElement("button");
    x.type = "button"; x.className = "tr-pc-x"; x.setAttribute("aria-label", "Close"); x.textContent = "×";
    x.addEventListener("click", hideCard);
    card.replaceChildren(x, top, where);
    const open = A()?.openProfileCard;
    if (open && pin.userId) {
      const view = document.createElement("button");
      view.type = "button"; view.className = "tr-pc-view"; view.textContent = "View profile";
      view.addEventListener("click", () => open(pin.userId));
      card.appendChild(view);
    }
    card.setAttribute("aria-label", `${pin.username}, level ${pin.level}`);
    card.hidden = false;
    const b = backdrop();
    b?.markFace?.(pin);
    if (b && b.map && !moveHooked) { moveHooked = true; b.map.on("move", placeCard); }
    placeCard();
  }

  async function setMapMode(on) {
    wantMap = on;
    if (!on) hideCard();
    const b = backdrop();
    if (!b || !b.map) {
      if (on) location.href = "maps.html";   // no WebGL, or not loaded yet
      return;
    }
    if (on === b.isMap) return;
    document.body.classList.toggle("is-map", on);
    const done = on ? await b.enterMap({ onPin: showPinCard, inset: getInset ? getInset() : {} }) : await b.exitMap();
    if (done && wantMap !== on) setMapMode(wantMap);   // the user moved on mid-ease
    const m = menu();
    if (on && m && m.current() === "map") m.refresh();  // the troll count arrives
  }

  let ctl = null, timer = 0;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = input.value.trim();
      if (q.length < 2) { out.replaceChildren(); return; }
      if (ctl) ctl.abort();
      ctl = new AbortController();
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.search = new URLSearchParams({ q, format: "jsonv2", addressdetails: "1", limit: "6", featureType: "settlement" });
        const res = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
        const places = res.ok ? await res.json() : [];
        out.replaceChildren(...places.map((pl) => {
          const a = pl.address || {};
          const btn = document.createElement("button");
          btn.type = "button"; btn.className = "tr-result";
          btn.textContent = a.city || a.town || a.village || a.municipality || a.county || pl.name || pl.display_name.split(",")[0];
          const sm = document.createElement("small"); sm.textContent = pl.display_name;
          btn.appendChild(sm);
          btn.addEventListener("click", () => {
            const lat = Number(pl.lat), lng = Number(pl.lon);
            flyTo(lat, lng, 4.5);
            if (menu()?.current() !== "pinsearch") return;
            // Picking your pin's town: take it and go back to the pin screen.
            setDraft({ lat, lng, label: btn.firstChild.textContent, country: a.country || "", countryCode: a.country_code ? a.country_code.toUpperCase() : "" });
            menu().back();
            menu().highlight("p-agree");
          });
          return btn;
        }));
        if (!places.length) out.textContent = "Nothing found.";
      } catch (e) { if (e.name !== "AbortError") out.textContent = "Search is unavailable right now."; }
    }, 450);   // Nominatim asks for under 1 request a second
  });

  const backRow = (desc) => ({ id: "back", label: "Back", desc, onSelect: (_, m) => m.back() });
  const screens = {
    map: () => ({
      title: "Troll Map", map: true,
      groups: [
        [
          { id: "m-top", label: "Top cities", value: trollCount(), desc: "Where the most trolls are from. Pick one to fly there.", go: "top" },
          { id: "m-find", label: "Find a city", desc: "Search any city or town and fly to it.", go: "search" },
        ],
        [
          { id: "m-pin", label: "Drop my pin", desc: "Put your town on the map, right here on the planet. Needs X connected.", go: "pin" },
          { id: "m-full", label: "Full map page", desc: "The flat map, country stats and the rest of the map tools.", href: "maps.html" },
        ],
        [backRow("Drag the planet to spin it, scroll or pinch to zoom, tap a glowing spot to see who is there.")],
      ],
    }),
    top: () => ({
      title: "Top Cities", map: true,
      groups: [
        topCities.length
          ? topCities.map((c, i) => ({ id: `t-${i}`, label: c.label, value: `${c.trolls} troll${c.trolls === 1 ? "" : "s"}`, desc: c.country ? `${c.label}, ${c.country}.` : c.label, onSelect: () => flyTo(c.lat, c.lng, 4) }))
          : [{ id: "t-none", label: topLoading ? "Loading..." : "No pins yet", desc: topLoading ? "Counting trolls." : "Be the first: Drop my pin.", disabled: true }],
        [backRow("Back to the map menu.")],
      ],
    }),
    search: { title: "Find a City", map: true, groups: [[backRow("Back to the map menu.")]] },
    pin: pinScreen,
    pinsearch: { title: "Search a City", map: true, groups: [[backRow("Back to your pin. Pick a result to use that town.")]] },
  };

  let lastId = "";
  function onScreen(id, s) {
    const searching = id === "search" || id === "pinsearch";
    panel.hidden = !searching;
    panel.querySelector("label").textContent = id === "pinsearch" ? "Search for your town" : "Search a city or town";
    if (id === "top") loadTop();
    if (searching && lastId !== id) { input.value = ""; out.replaceChildren(); setTimeout(() => input.focus(), 50); }
    // Entering the pin screen from the map menu re-checks the account;
    // coming back from its own search keeps the picked spot.
    const from = lastId;
    lastId = id;   // before loadPin(): it re-renders, which lands back here
    if (id !== "pin" && id !== "pinsearch") { pin.draft = null; pin.msg = ""; }
    syncPicker();
    if (id === "pin" && from !== "pin" && from !== "pinsearch") { setDraft(null); pin.consent = false; loadPin(); }
    setMapMode(!!(s && s.map));
  }

  return { screens, onScreen, setMapMode, panel };
}
