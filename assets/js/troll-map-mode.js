/* Troll Map mode for the BO2 menus: the backdrop planet (menu-globe.js)
   becomes the live troll map, and the menu gets map screens. Shared by the
   trollrunner.net home and the Troll Forces menu.

   createMapMode({ host, panelClass, getBackdrop, getMenu, getInset })
     host:        element the pin card and city-search panel go into
     panelClass:  the page's own panel class, so the search panel matches
     getInset():  { left } or { bottom } px of screen the menu covers
   -> { screens: { map, top, search }, onScreen(id, screen), setMapMode(on) }

   Screens marked map: true keep the planet live; the page calls
   onScreen() from its menu's onScreen hook. With no WebGL (or before the
   planet loads) Troll Map opens the maps page instead. */

const CSS = `
.tr-pincard{position:absolute;z-index:30;display:flex;align-items:center;gap:12px;min-width:200px;max-width:300px;padding:10px 14px 10px 10px;background:rgba(10,4,2,.86);border:1px solid rgba(255,176,32,.5);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.6);transform:translate(-50%,calc(-100% - 34px));pointer-events:none;color:#f3ece4;font-family:"DM Sans",system-ui,sans-serif}
.tr-pincard[hidden]{display:none}
.tr-pincard img,.tr-pincard .tr-pincard-ph{width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#2a170d;display:flex;align-items:center;justify-content:center;font:600 18px Oswald,sans-serif;color:#ff8a1f}
.tr-pincard b{display:block;font:500 18px/1.2 Oswald,"Arial Narrow",sans-serif;letter-spacing:.03em;color:#ffd27a;white-space:nowrap}
.tr-pincard span{display:block;font-size:13px;color:#e2d6c8}
.tr-citysearch label{display:block;margin:0 0 8px;color:#e2d6c8;font-size:14px}
.tr-citysearch input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid rgba(243,236,228,.16);background:rgba(0,0,0,.45);color:#f3ece4;font:15px "DM Sans",system-ui,sans-serif}
.tr-citysearch input:focus{outline:2px solid #ff8a1f;outline-offset:1px}
.tr-results{display:flex;flex-direction:column;margin-top:10px;color:#c9b8a6;font-size:14px}
.tr-result{display:flex;flex-direction:column;align-items:flex-start;min-height:44px;padding:8px 10px;border:0;border-top:1px solid rgba(243,236,228,.16);background:none;color:#f3ece4;text-align:left;cursor:pointer;font:500 16px Oswald,"Arial Narrow",sans-serif;letter-spacing:.03em}
.tr-result small{font:13px "DM Sans",system-ui,sans-serif;color:#c9b8a6;letter-spacing:0}
.tr-result:hover,.tr-result:focus-visible{background:rgba(255,138,31,.16);outline:none}
`;

const PIN_INTENT_KEY = "trollrunner_maps_pin_intent";   // maps.html opens its pin flow on arrival

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

  function dropPin() {
    try { sessionStorage.setItem(PIN_INTENT_KEY, "1"); } catch {}
    location.href = "maps.html";
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

  function showPinCard(pin, point) {
    if (!pin) { card.hidden = true; return; }
    card.replaceChildren();
    let face;
    if (pin.avatarUrl) { face = document.createElement("img"); face.src = pin.avatarUrl; face.alt = ""; }
    else { face = document.createElement("span"); face.className = "tr-pincard-ph"; face.textContent = (pin.username || "?")[0].toUpperCase(); }
    const txt = document.createElement("div");
    const b = document.createElement("b"); b.textContent = `${pin.username} · LV ${pin.level}`;
    const where = document.createElement("span"); where.textContent = [pin.label, pin.country].filter(Boolean).join(", ");
    txt.append(b, where);
    card.append(face, txt);
    card.style.left = `${point.x}px`;
    card.style.top = `${point.y}px`;
    card.hidden = false;
  }

  async function setMapMode(on) {
    wantMap = on;
    if (!on) card.hidden = true;
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
          btn.addEventListener("click", () => flyTo(Number(pl.lat), Number(pl.lon), 4.5));
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
          { id: "m-pin", label: "Drop my pin", desc: "Put your city on the map. Needs a linked X account; opens the pin flow.", onSelect: dropPin },
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
  };

  function onScreen(id, s) {
    panel.hidden = id !== "search";
    if (id === "top") loadTop();
    if (id === "search") setTimeout(() => input.focus(), 50);
    setMapMode(!!(s && s.map));
  }

  return { screens, onScreen, setMapMode, panel };
}
