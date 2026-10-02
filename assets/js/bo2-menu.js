/* A Black Ops 2 style menu: a plain, left-aligned stacked text list in a
   condensed sans, items in small clusters, the highlighted item orange with
   a one-line description under the list, and drill-down screens with Back.
   Shared by the trollrunner.net home and the Troll Forces menu.

   createBo2Menu(nav, { screens, start, keys, onScreen }) -> api
     screens: { id: screen | () => screen }
       screen: { title, groups: [[item, ...], ...], back?: false }
       item:   { id, label, desc, value?, go?: screenId, href?, newTab?,
                 onSelect?(item, api), disabled?, on? (ticked) }
     keys: true to drive it from the keyboard (arrows / W S, Enter, Esc or
       Backspace for Back) while no text field has focus.
   api: go(id), back(), refresh(), current(), highlight(id), destroy()

   Phones have no hover, so the first tap highlights a row and shows its
   description and a second tap opens it. Keyboard users and mice open on
   the first press. */

const CSS = `
.tr-menu{display:flex;flex-direction:column;align-items:flex-start;color:#f3ece4}
.tr-menu-title{margin:0 0 8px;font:600 44px/1 Oswald,"Arial Narrow",sans-serif;letter-spacing:.04em;text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,.85)}
.tr-menu-groups{display:flex;flex-direction:column;align-self:stretch}
.tr-menu-group{display:flex;flex-direction:column;padding-bottom:14px}
.tr-menu-item{display:flex;align-items:baseline;gap:12px;align-self:stretch;min-height:34px;padding:0 14px;margin-left:-14px;border:0;background:none;
  color:inherit;text-align:left;cursor:pointer;font:500 22px/34px Oswald,"Arial Narrow",sans-serif;letter-spacing:.04em;text-transform:uppercase;
  text-shadow:0 1px 6px rgba(0,0,0,.85);-webkit-tap-highlight-color:transparent;text-decoration:none}
.tr-menu-item small{font:500 13px/1 "DM Mono",ui-monospace,monospace;letter-spacing:.04em;color:#c9b8a6;text-transform:none}
.tr-menu-item .tr-menu-tick{color:#ffd9b0;font-size:.8em}
.tr-menu-item.is-hot{color:var(--tr-menu-accent,#ff8a1f);background:linear-gradient(90deg,rgba(255,138,31,.28),rgba(255,138,31,0) 85%)}
.tr-menu-item.is-hot small{color:#ffd2a6}
.tr-menu-item[aria-disabled="true"]{color:#8f7f70;cursor:default}
.tr-menu-item:focus{outline:none}
.tr-menu-item:focus-visible{outline:2px solid var(--tr-menu-accent,#ff8a1f);outline-offset:2px}
.tr-menu-desc{margin:6px 0 0;max-width:400px;min-height:44px;font:15px/1.45 "DM Sans",system-ui,sans-serif;color:#e2d6c8;text-shadow:0 1px 6px rgba(0,0,0,.95)}
.tr-menu-desc:not(:empty)::before{content:"\\25B8\\00a0\\00a0";color:var(--tr-menu-accent,#ff8a1f)}
@media (hover:none),(max-width:600px){
  .tr-menu-title{font-size:34px}
  .tr-menu-item{min-height:44px;line-height:44px;font-size:21px}
  .tr-menu-group{padding-bottom:8px}
  .tr-menu-desc{font-size:14px;min-height:40px}
}
`;

function injectCss() {
  if (document.getElementById("tr-menu-css")) return;
  const st = document.createElement("style");
  st.id = "tr-menu-css";
  st.textContent = CSS;
  document.head.appendChild(st);
}

const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function createBo2Menu(nav, { screens, start = "main", keys = false, onScreen = null } = {}) {
  injectCss();
  nav.classList.add("tr-menu");
  const title = document.createElement("h1");
  title.className = "tr-menu-title";
  const list = document.createElement("div");
  list.className = "tr-menu-groups";
  const desc = document.createElement("p");
  desc.className = "tr-menu-desc";
  desc.setAttribute("aria-live", "polite");
  nav.replaceChildren(title, list, desc);

  const touch = window.matchMedia("(hover: none)").matches;
  let stack = [];          // screen ids walked through, for Back
  let screenId = start;
  let items = [];          // flat list of the current screen's items
  let buttons = [];
  let hot = 0;
  let armed = -1;          // touch: the row tapped once

  const resolve = (id) => {
    const s = screens[id];
    return typeof s === "function" ? s() : s;
  };

  function paint() {
    buttons.forEach((b, i) => b.classList.toggle("is-hot", i === hot));
    const it = items[hot];
    desc.textContent = it ? (it.desc || "") : "";
  }

  function setHot(i, focus) {
    if (i < 0 || i >= items.length) return;
    hot = i;
    paint();
    if (focus) buttons[i].focus({ preventScroll: true });
  }

  function activate(i) {
    const it = items[i];
    if (!it || it.disabled) return;
    if (it.onSelect) it.onSelect(it, api);
    if (it.go) go(it.go);
    else if (it.href) {
      if (it.newTab) window.open(it.href, "_blank", "noopener");
      else window.location.href = it.href;
    }
  }

  function render(keepId) {
    const s = resolve(screenId) || { title: "", groups: [] };
    title.textContent = s.title || "";
    nav.setAttribute("aria-label", s.title || "Menu");
    list.replaceChildren();
    items = [];
    buttons = [];
    for (const g of s.groups || []) {
      const box = document.createElement("div");
      box.className = "tr-menu-group";
      for (const it of g) {
        if (!it) continue;
        const i = items.length;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tr-menu-item";
        b.dataset.id = it.id || "";
        if (it.disabled) b.setAttribute("aria-disabled", "true");
        const label = document.createElement("span");
        label.textContent = it.label;
        b.appendChild(label);
        if (it.on) b.insertAdjacentHTML("beforeend", '<span class="tr-menu-tick" aria-label="selected">&#10003;</span>');
        const value = typeof it.value === "function" ? it.value() : it.value;
        if (value) { const sm = document.createElement("small"); sm.textContent = value; b.appendChild(sm); }
        if (it.go) b.insertAdjacentHTML("beforeend", '<small aria-hidden="true">&rsaquo;</small>');
        if (it.newTab) b.insertAdjacentHTML("beforeend", '<small>new tab</small>');
        b.addEventListener("mouseenter", () => { if (!touch) setHot(i); });
        b.addEventListener("focus", () => setHot(i));
        b.addEventListener("click", (e) => {
          // A real tap on a phone: highlight first, open on the second tap.
          // Keyboard "clicks" (detail 0) always open.
          if (touch && e.detail !== 0 && armed !== i) { armed = i; setHot(i); return; }
          armed = -1;
          activate(i);
        });
        box.appendChild(b);
        items.push(it);
        buttons.push(b);
      }
      if (box.childElementCount) list.appendChild(box);
    }
    const keep = keepId ? items.findIndex((it) => it.id === keepId) : -1;
    hot = keep >= 0 ? keep : Math.max(0, items.findIndex((it) => !it.disabled));
    armed = -1;
    paint();
    if (onScreen) onScreen(screenId, s, api);
  }

  function go(id, { replace = false } = {}) {
    if (!replace && id !== screenId) stack.push({ id: screenId, hot: items[hot] && items[hot].id });
    screenId = id;
    render();
    if (keys && document.activeElement && nav.contains(document.activeElement)) setHot(hot, true);
  }

  function back() {
    const s = resolve(screenId);
    if (!stack.length || (s && s.back === false)) return false;
    const prev = stack.pop();
    screenId = prev.id;
    render(prev.hot);
    if (keys) setHot(hot, nav.contains(document.activeElement));
    return true;
  }

  function onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || typing(document.activeElement)) return;
    if (!nav.isConnected || nav.offsetParent === null) return;
    const k = e.key;
    const step = (d) => {
      if (!items.length) return;
      let i = hot;
      for (let n = 0; n < items.length; n++) {
        i = (i + d + items.length) % items.length;
        if (!items[i].disabled) break;
      }
      setHot(i, true);
    };
    if (k === "ArrowDown" || k === "s" || k === "S") { e.preventDefault(); step(1); }
    else if (k === "ArrowUp" || k === "w" || k === "W") { e.preventDefault(); step(-1); }
    else if (k === "Enter" && !nav.contains(document.activeElement)) { e.preventDefault(); activate(hot); }
    else if (k === "Escape" || k === "Backspace") { if (back()) e.preventDefault(); }
  }
  if (keys) document.addEventListener("keydown", onKey);

  const api = {
    go, back,
    refresh() { render(items[hot] && items[hot].id); },
    current() { return screenId; },
    depth() { return stack.length; },
    highlight(id) { const i = items.findIndex((it) => it.id === id); if (i >= 0) setHot(i); },
    destroy() { if (keys) document.removeEventListener("keydown", onKey); nav.replaceChildren(); },
  };
  render();
  return api;
}
