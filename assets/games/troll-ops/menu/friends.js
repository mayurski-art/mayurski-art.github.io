/* Troll Warfare's Friends drawer (user, 2026-10-28: "add a friends section
   to the main menu ... the UI should be really good for it").

   A people button in the lobby's top bar (badged with requests waiting)
   opens a glass drawer from the right: add someone by username, requests
   to accept, friends online with what they're playing (Join their public
   room, or Invite them to yours), friends offline, requests you sent, and
   who else is on right now. The empty "+" pads beside your operator open
   it too (lobby.js, the "trollforces:friends" event).

   The friendships are the site's own (assets/js/troll-accounts.js over
   troll_friends.sql: SECURITY DEFINER RPCs, the same list the arcade's
   friend panel shows); who's online is the presence roster (online.js),
   matched by account id. Like lobby-fn.js it imports nothing: menu-bo2.js
   hands it what it needs through mountFriends(). */

const $ = (sel, root = document) => root.querySelector(sel);
const FALLBACK_AVATAR = "assets/images/icons/favicon/grin.png";
const POLL_MS = 30000;        // friends and requests, while the drawer is open
const SEARCH_MS = 250;        // typing settles this long before a lookup

const ICON = {
  people: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.6"/><path d="M2.5 19.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6v.5h-13z"/><circle cx="17" cy="9" r="2.8"/><path d="M16.2 13.6c3 .1 5.3 2.2 5.3 5.4v1h-4.3c0-2.6-.4-4.7-1-6.4z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`,
};

export function mountFriends(api) {
  const { root, getRoster, onlinePlayers, describe, serverList, joinServer, invitePlayer, openProfileCard, openGuestCard, signIn, setStatus } = api;
  const acc = () => window.TrollrunnerAccounts;
  const me = () => acc()?.getCachedProfile?.() || null;
  const myId = () => { const p = me(); return p?.id || p?.userId || null; };

  /* ── The button, in the top bar beside your level ── */
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "to-fn-glass to-fn-ico to-fr-btn";
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-expanded", "false");
  btn.title = "Friends";
  btn.innerHTML = `${ICON.people}<b class="to-fr-badge" hidden></b><i class="to-fr-live" hidden></i>`;
  const meBox = $(".to-fn-me", root);
  if (meBox) meBox.prepend(btn); else root.appendChild(btn);

  /* ── The drawer ── */
  const scrim = document.createElement("div");
  scrim.className = "to-fr-scrim";
  scrim.hidden = true;
  const panel = document.createElement("aside");
  panel.className = "to-fr";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", "to-fr-h");
  panel.hidden = true;
  panel.innerHTML = `
    <header class="to-fr-head">
      <span class="to-fr-head-ico" aria-hidden="true">${ICON.people}</span>
      <div><h2 id="to-fr-h">Friends</h2><small class="to-fr-sum" aria-live="polite"></small></div>
      <button type="button" class="to-fr-x" aria-label="Close friends">${ICON.close}</button>
    </header>
    <form class="to-fr-add" role="search" autocomplete="off">
      <label class="to-fr-search">${ICON.search}
        <input type="search" name="q" placeholder="Add a friend by username" aria-label="Find a player by username" spellcheck="false" maxlength="32">
      </label>
      <ul class="to-fr-results" role="list" aria-label="Players found" hidden></ul>
    </form>
    <p class="to-fr-note" aria-live="polite" hidden></p>
    <div class="to-fr-body"></div>`;
  root.append(scrim, panel);
  const body = $(".to-fr-body", panel);
  const sum = $(".to-fr-sum", panel);
  const note = $(".to-fr-note", panel);
  const form = $(".to-fr-add", panel);
  const input = $("input", form);
  const results = $(".to-fr-results", form);

  /* ── State ── */
  let friends = [], incoming = [], outgoing = [];
  let loaded = false, loading = false, pollT = 0, lastFocus = null;
  let confirmRemove = null;              // a friend's id while "Remove?" is asked
  const busy = new Set();                // ids with a request in flight
  const sent = new Map();                // viewerId -> "Invite sent" line, this visit
  let pendingCount = 0;

  const isOpen = () => !panel.hidden;

  /* Everyone online, by account id and in all (online.js onlinePlayers). */
  function onlineNow() {
    const all = onlinePlayers(getRoster());
    const byUser = new Map();
    for (const o of all) if (o.userId && !byUser.has(o.userId)) byUser.set(o.userId, o);
    return { all, byUser };
  }

  async function load() {
    const a = acc();
    if (!a || !me() || loading) return;
    loading = true;
    try {
      const [f, r] = await Promise.all([a.listFriends(), a.listFriendRequests()]);
      friends = Array.isArray(f) ? f : [];
      incoming = r?.incoming || [];
      outgoing = r?.outgoing || [];
      loaded = true;
      setBadge(incoming.length);
    } catch { /* keep what we had; the next poll tries again */ }
    loading = false;
    render();
  }

  /* ── The button's badge: requests waiting (yellow), friends on (green) ── */
  function setBadge(n) {
    pendingCount = n | 0;
    const b = $(".to-fr-badge", btn);
    b.hidden = !pendingCount;
    b.textContent = pendingCount > 9 ? "9+" : String(pendingCount);
    paintButton();
  }
  function paintButton() {
    const on = friendsOnline().length;
    $(".to-fr-live", btn).hidden = !on || !!pendingCount;
    const bits = ["Friends"];
    if (pendingCount) bits.push(`${pendingCount} request${pendingCount > 1 ? "s" : ""}`);
    if (on) bits.push(`${on} online`);
    btn.setAttribute("aria-label", bits.join(", "));
  }
  const friendsOnline = () => { const { byUser } = onlineNow(); return friends.filter((f) => byUser.has(f.id)); };

  /* ── Rows ── */
  function avatar(url, state) {
    const box = document.createElement("span");
    box.className = `to-fr-av is-${state}`;
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.src = /^https:\/\//.test(url || "") ? url : FALLBACK_AVATAR;
    img.addEventListener("error", () => { img.src = FALLBACK_AVATAR; }, { once: true });
    box.append(img, document.createElement("i"));
    return box;
  }
  function action(label, cls, fn, aria) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `to-fr-act ${cls || ""}`.trim();
    b.textContent = label;
    if (aria) b.setAttribute("aria-label", aria);
    b.addEventListener("click", (e) => { e.stopPropagation(); fn(b); });
    return b;
  }
  /* One person: picture, name and level, a line under it, buttons right.
     The name half opens their profile card. */
  function row({ id, name, level, avatarUrl, state, line, lineCls, actions = [], onOpen }) {
    const li = document.createElement("li");
    li.className = `to-fr-row is-${state}`;
    if (id) li.dataset.id = id;
    const who = document.createElement("button");
    who.type = "button";
    who.className = "to-fr-who";
    who.setAttribute("aria-label", `${name}${level ? `, level ${level}` : ""}. ${line}`);
    const txt = document.createElement("span");
    txt.className = "to-fr-txt";
    const nm = document.createElement("b");
    nm.textContent = name;
    if (level) { const lv = document.createElement("em"); lv.textContent = `LV ${level}`; nm.append(" ", lv); }
    const sub = document.createElement("small");
    sub.textContent = line;
    if (lineCls) sub.className = lineCls;
    txt.append(nm, sub);
    who.append(avatar(avatarUrl, state), txt);
    if (onOpen) who.addEventListener("click", onOpen); else who.disabled = true;
    const acts = document.createElement("span");
    acts.className = "to-fr-acts";
    acts.append(...actions.filter(Boolean));
    li.append(who, acts);
    return li;
  }
  function section(title, items, { count = items.length, cls = "", hint = "" } = {}) {
    if (!items.length && !hint) return null;
    const s = document.createElement("section");
    s.className = `to-fr-sec ${cls}`.trim();
    const h = document.createElement("h3");
    h.innerHTML = `<span></span><b></b>`;
    h.firstChild.textContent = title;
    h.lastChild.textContent = count;
    s.append(h);
    if (items.length) {
      const ul = document.createElement("ul");
      ul.setAttribute("role", "list");
      ul.append(...items);
      s.append(ul);
    } else {
      const p = document.createElement("p");
      p.className = "to-fr-hint";
      p.textContent = hint;
      s.append(p);
    }
    return s;
  }

  function say(msg, bad = false) {
    note.hidden = !msg;
    note.textContent = msg || "";
    note.classList.toggle("is-bad", !!bad);
  }

  /* Run one friends RPC for `id`, then reload. */
  async function act(id, fn, ok) {
    if (busy.has(id)) return;
    busy.add(id);
    render();
    try { await fn(); if (ok) say(ok); }
    catch (err) { say(err?.message || "That didn't go through. Try again.", true); }
    busy.delete(id);
    await load();
  }

  function inviteBtn(o, name) {
    const done = sent.get(o.viewerId);
    const b = action(done ? "Sent" : "Invite", "is-ghost", (el) => {
      const msg = invitePlayer({ viewerId: o.viewerId, name, userId: o.userId }) || "";
      if (/^Invite sent/.test(msg)) { sent.set(o.viewerId, msg); el.textContent = "Sent"; el.disabled = true; }
      say(msg, !/^Invite sent/.test(msg));
    }, done ? `Invite sent to ${name}` : `Invite ${name} to play`);
    b.disabled = !!done;
    return b;
  }
  /* A public room they're in, that we can drop into from here. */
  function joinBtn(o, name) {
    const a = o.activity;
    if (!a?.pub || !a.room) return null;
    const srv = serverList(getRoster()).find((s) => s.room === a.room);
    if (!srv) return null;
    return action("Join", "is-go", () => {
      if (joinServer(srv)) { setStatus?.(`Joining ${name}…`); open(false); }
      else say(`Couldn't join ${name} right now.`, true);
    }, `Join ${name}'s match`);
  }
  const profileOf = (id, name) => () => openProfileCard(id, { name });

  function render() {
    paintButton();
    if (!isOpen()) return;
    const signedIn = !!me();
    form.hidden = !signedIn;
    const { all, byUser } = onlineNow();
    const mine = myId(), myViewer = (() => { try { return localStorage.getItem("trollrunner_viewer_id_v1"); } catch { return null; } })();
    const parts = [];

    if (!signedIn) {
      sum.textContent = "Sign in to keep a friends list";
      const hero = document.createElement("div");
      hero.className = "to-fr-empty is-guest";
      hero.innerHTML = `<img src="${FALLBACK_AVATAR}" alt=""><b>Squad up</b><p>Sign in to add friends, see when they're on and jump straight into their match.</p>`;
      const go = action("Sign in", "is-go is-wide", () => { open(false); signIn(); });
      hero.append(go);
      parts.push(hero);
    } else {
      const onF = [], offF = [];
      for (const f of friends) (byUser.has(f.id) ? onF : offF).push(f);
      // in a match first, then the menu; each by name
      const rank = (f) => { const a = byUser.get(f.id)?.activity; return a?.game === "tf" && a.state !== "menu" ? 0 : 1; };
      onF.sort((x, y) => rank(x) - rank(y) || String(x.username).localeCompare(String(y.username)));
      offF.sort((x, y) => String(x.username).localeCompare(String(y.username)));
      sum.textContent = !loaded ? "Loading…" : `${onF.length} online · ${friends.length} friend${friends.length === 1 ? "" : "s"}`;

      parts.push(section("Requests", incoming.map((r) => row({
        id: r.id, name: r.username || "Someone", level: r.level, avatarUrl: r.avatar_url, state: byUser.has(r.id) ? "on" : "off",
        line: "Wants to be friends", lineCls: "is-ask", onOpen: profileOf(r.id, r.username),
        actions: busy.has(r.id) ? [action("…", "is-ghost", () => {})] : [
          action("Accept", "is-go", () => act(r.id, () => acc().respondFriendRequest(r.id, true), `You and ${r.username} are friends.`), `Accept ${r.username}'s request`),
          action("Decline", "is-ghost", () => act(r.id, () => acc().respondFriendRequest(r.id, false)), `Decline ${r.username}'s request`),
        ],
      })), { cls: "is-req" }));

      parts.push(section("Online", onF.map((f) => {
        const o = byUser.get(f.id);
        const inGame = o.activity?.game === "tf" && o.activity.state !== "menu";
        return row({
          id: f.id, name: f.username, level: o.level || f.level, avatarUrl: f.avatar_url, state: inGame ? "game" : "on",
          line: describe(o.activity, o), onOpen: profileOf(f.id, f.username),
          actions: [joinBtn(o, f.username), inviteBtn(o, f.username)],
        });
      }), { hint: loaded && friends.length ? "None of your friends are on right now." : "" }));

      parts.push(section("Offline", offF.map((f) => row({
        id: f.id, name: f.username, level: f.level, avatarUrl: f.avatar_url, state: "off",
        line: confirmRemove === f.id ? `Remove ${f.username} from your friends?` : "Offline",
        lineCls: confirmRemove === f.id ? "is-ask" : "",
        onOpen: profileOf(f.id, f.username),
        actions: removeActions(f),
      }))));

      parts.push(section("Sent", outgoing.map((r) => row({
        id: r.id, name: r.username || "Someone", level: r.level, avatarUrl: r.avatar_url, state: byUser.has(r.id) ? "on" : "off",
        line: "Request sent", onOpen: profileOf(r.id, r.username),
        actions: [busy.has(r.id) ? action("…", "is-ghost", () => {}) : action("Cancel", "is-ghost", () => act(r.id, () => acc().removeFriend(r.id), "Request cancelled."), `Cancel your request to ${r.username}`)],
      })), { cls: "is-sent" }));

      if (loaded && !friends.length && !incoming.length && !outgoing.length) {
        const e = document.createElement("div");
        e.className = "to-fr-empty";
        e.innerHTML = `<img src="${FALLBACK_AVATAR}" alt=""><b>No friends yet</b><p>Search a username above, or add someone who's on right now.</p>`;
        parts.push(e);
      }
    }

    // Who else is on: not you, not already a friend or a request
    const known = new Set([...friends, ...incoming, ...outgoing].map((f) => f.id));
    const others = all.filter((o) => o.viewerId !== myViewer && !(mine && o.userId === mine) && !(o.userId && known.has(o.userId)));
    parts.push(section("Online now", others.slice(0, 12).map((o) => {
      const add = signedIn && o.userId ? (busy.has(o.userId) ? action("…", "is-ghost", () => {}) : action("Add", "is-add", () => act(o.userId, () => acc().sendFriendRequest(o.userId), `Friend request sent to ${o.name}.`), `Add ${o.name} as a friend`)) : null;
      return row({
        id: o.userId || o.viewerId, name: o.name, level: o.guest ? null : o.level, avatarUrl: null, state: "on",
        line: o.guest ? `Guest · ${describe(o.activity, o)}` : describe(o.activity, o),
        onOpen: o.userId ? profileOf(o.userId, o.name) : () => openGuestCard({ viewerId: o.viewerId, name: o.name }),
        actions: [add, inviteBtn(o, o.name)],
      });
    }), { count: others.length, cls: "is-others", hint: "Nobody else is on right now." }));

    body.replaceChildren(...parts.filter(Boolean));
  }

  function removeActions(f) {
    if (busy.has(f.id)) return [action("…", "is-ghost", () => {})];
    if (confirmRemove === f.id) {
      return [
        action("Remove", "is-bad", () => { confirmRemove = null; act(f.id, () => acc().removeFriend(f.id), `${f.username} removed.`); }, `Yes, remove ${f.username}`),
        action("Keep", "is-ghost", () => { confirmRemove = null; render(); }, `Keep ${f.username}`),
      ];
    }
    const b = action("", "is-ghost is-icon", () => { confirmRemove = f.id; render(); $(`.to-fr-row[data-id="${CSS.escape(f.id)}"] .is-bad`, body)?.focus(); }, `Remove ${f.username}`);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>`;
    b.title = "Remove friend";
    return [b];
  }

  /* ── Search: type a name, add them ── */
  let searchT = 0, searchSeq = 0;
  input.addEventListener("input", () => {
    clearTimeout(searchT);
    const q = input.value.trim();
    if (q.length < 2) { results.hidden = true; results.replaceChildren(); return; }
    searchT = setTimeout(() => search(q), SEARCH_MS);
  });
  async function search(q) {
    const seq = ++searchSeq;
    let found = [];
    try { found = await acc()?.searchUsernames?.(q, { limit: 6, excludeId: myId() }) || []; } catch {}
    if (seq !== searchSeq) return;
    const fr = new Set(friends.map((f) => f.id)), out = new Set(outgoing.map((f) => f.id)), inc = new Set(incoming.map((f) => f.id));
    const { byUser } = onlineNow();
    results.replaceChildren(...(found.length ? found.map((p) => {
      const state = fr.has(p.id) ? "friend" : out.has(p.id) ? "sent" : inc.has(p.id) ? "asks" : "none";
      const acts = state === "friend" ? [tag("Friends")]
        : state === "sent" ? [tag("Sent")]
        : state === "asks" ? [action("Accept", "is-go", () => { clearSearch(); act(p.id, () => acc().respondFriendRequest(p.id, true), `You and ${p.username} are friends.`); }, `Accept ${p.username}'s request`)]
        : [action("Add", "is-add", () => { clearSearch(); act(p.id, () => acc().sendFriendRequest(p.id), `Friend request sent to ${p.username}.`); }, `Add ${p.username} as a friend`)];
      return row({
        id: p.id, name: p.username, level: p.level, avatarUrl: p.avatar_url, state: byUser.has(p.id) ? "on" : "off",
        line: byUser.has(p.id) ? "Online" : "Offline", onOpen: profileOf(p.id, p.username), actions: acts,
      });
    }) : [Object.assign(document.createElement("li"), { className: "to-fr-none", textContent: `No one called "${q}".` })]));
    results.hidden = false;
  }
  function tag(t) { const s = document.createElement("span"); s.className = "to-fr-tag"; s.textContent = t; return s; }
  function clearSearch() { input.value = ""; results.hidden = true; results.replaceChildren(); }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(searchT);
    const q = input.value.trim();
    if (q.length >= 1) search(q);
  });

  /* ── Open and close ── */
  function open(on = true) {
    if (on === isOpen()) return;
    panel.hidden = scrim.hidden = !on;
    btn.setAttribute("aria-expanded", String(on));
    btn.classList.toggle("is-on", on);
    root.classList.toggle("has-friends", on);
    clearInterval(pollT);
    if (on) {
      lastFocus = document.activeElement;
      say("");
      confirmRemove = null;
      render();
      load();
      pollT = setInterval(load, POLL_MS);
      (me() ? input : $(".to-fr-x", panel)).focus({ preventScroll: true });
    } else {
      clearSearch();
      if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true }); else btn.focus({ preventScroll: true });
    }
  }
  btn.addEventListener("click", () => open(!isOpen()));
  scrim.addEventListener("click", () => open(false));
  $(".to-fr-x", panel).addEventListener("click", () => open(false));
  // Esc closes the drawer before the menu sees it (it would go Back)
  addEventListener("keydown", (e) => {
    if (!isOpen() || e.key !== "Escape") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!results.hidden) { clearSearch(); input.focus(); } else open(false);
  }, true);
  addEventListener("trollforces:friends", () => open(true));

  /* ── Keep it current ── */
  addEventListener("trollrunner:friend-requests-changed", (e) => {
    setBadge(e.detail?.count | 0);
    if (isOpen()) load();
  });
  addEventListener("trollrunner:auth-changed", () => {
    friends = []; incoming = []; outgoing = []; loaded = false;
    setBadge(0);
    render();
    if (me()) load();
  });
  if (me()) load();

  return {
    open,
    /* The presence roster changed (menu-bo2.js onSync). */
    update() { render(); },
  };
}
