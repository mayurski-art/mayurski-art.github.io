// Troll Forces — PvP networking.
//
// Client-authoritative, like Phantom Forces itself: each browser simulates its
// own player, broadcasts state ~15×/sec, and the shooter decides whether it
// hit and tells the victim, who applies the damage to itself. There is no
// dedicated server available on a static host, so this is the model — see
// DESIGN-PF.md §3. It is trustful by construction.
//
// Transports match Trollrreria's: Supabase Realtime broadcast for the
// internet, BroadcastChannel as an automatic same-browser fallback.

const SUPABASE_URL = "https://tjsyhfplxjtakdfkpdtg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3loZnBseGp0YWtkZmtwZHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTc0ODksImV4cCI6MjA5MTk3MzQ4OX0.xLUcPUUguRBQttNwiIRWJHxjJjLqrQDMu4Ubsk5yZoQ";

export const MAX_PLAYERS = 20;
export const MAX_PLAYERS_ROYALE = 100;
/* Bot skill tiers on the wire (`bs` on a bot's state): the tier the bot
   host built that bot with, so every client knows the room's bot skill. */
const BOT_SKILLS = ["recruit", "regular", "veteran"];
/* A bot's level for the scoreboard: fixed per bot id (1-69), so a bot
   keeps the same rank all match and every client agrees on it. */
function botLevel(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return 1 + ((h >>> 0) % 69);
}
const STATE_HZ = 15;
// A big bot room (Troll Royale's 100) sends each bot a bit less often; the
// renderer's 110 ms delay still covers a 10 Hz feed.
const BOT_HZ_CROWD = 10;
const CROWD_BOTS = 24;
// Everything sent inside one window goes out as ONE broadcast. Supabase's
// client drops anything past eventsPerSecond (30), and one message per bot
// per tick (plus every bot shot) blew through that long before 100 bots.
const FLUSH_MS = 50;
const BATCH_MAX = 160;
const PEER_TIMEOUT = 5000;
const HANDSHAKE_SETTLE = 700;

class BroadcastTransport {
  constructor() { this.kind = "tabs"; }
  connect(room, onMsg) {
    this.ch = new BroadcastChannel("trollops:" + room);
    this.ch.onmessage = (e) => onMsg(e.data);
    return Promise.resolve(true);
  }
  send(msg) { try { this.ch?.postMessage(msg); } catch { /* payload too big */ } }
  close() { this.ch?.close(); this.ch = null; }
}

class SupabaseTransport {
  constructor() { this.kind = "online"; }
  connect(room, onMsg) {
    return new Promise((resolve) => {
      try {
        if (!window.supabase?.createClient) return resolve(false);
        this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false },
          realtime: { params: { eventsPerSecond: 30 } },
        });
        this.chan = this.client.channel("trollops:" + room, { config: { broadcast: { self: false } } });
        this.chan.on("broadcast", { event: "to" }, (p) => onMsg(p.payload));
        const timeout = setTimeout(() => resolve(false), 6000);
        this.chan.subscribe((status) => {
          if (status === "SUBSCRIBED") { clearTimeout(timeout); resolve(true); }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(timeout); resolve(false); }
        });
      } catch { resolve(false); }
    });
  }
  send(msg) {
    try { this.chan?.send({ type: "broadcast", event: "to", payload: msg }); } catch { /* non-fatal */ }
  }
  close() {
    try { if (this.chan) this.client.removeChannel(this.chan); } catch { /* ignore */ }
    this.chan = null;
  }
}

export function makeRoomCode() {
  const abc = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

/* Ids that share the peer map with real operators but aren't people: bots,
   and the scorestreak entities (drones, gunships) that ride the same
   publishBot channel so remote clients render them for free. Anything that
   counts players — host election, map votes, "is anyone human here" — has to
   skip these, and having one predicate means adding a new entity kind can't
   quietly miss one of those call sites. */
export const SYNTHETIC_ID_PREFIXES = ["bot-", "streak-"];

/* Account ids are uuids; anything else off the wire is dropped. */
function accountId(v) {
  const s = String(v || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
}

export function isSyntheticId(id) {
  const s = String(id);
  return SYNTHETIC_ID_PREFIXES.some((p) => s.startsWith(p));
}

export class Net {
  constructor(handlers = {}) {
    this.h = handlers;
    this.id = Math.random().toString(36).slice(2, 10);
    this.transport = null;
    this.room = null;
    this.connected = false;
    this.myVote = null; // our map vote during an intermission
    this.team = null;   // stays unset until chooseTeam, so it can't leak into the handshake
    this.name = "operator";
    this.uid = null;     // the signed-in account id, so others can open our profile
    this.mapId = "grinsite";
    this.peers = new Map();   // id -> { team, name, last, ... }
    this._acc = 0;
    this._out = [];
    this._flushT = null;
    this.botCount = 0;   // bots this client hosts (game.js keeps it current)
    this.since = 0;      // when we joined the room (host election, isBotHost)
    // Socialize rooms: how many times the owner (or a match ending) has
    // switched the room's mode. Rides every room note (`ms`) so a newcomer,
    // or anyone who missed the switch, catches up. game.js keeps it current.
    this.modeSeq = 0;
  }

  get active() { return this.connected; }
  get playerCount() { return this.peers.size + 1; }
  /* Real people only (us included): what a room's player cap is about. */
  get humanCount() {
    let n = 1;
    for (const id of this.peers.keys()) if (!isSyntheticId(id)) n++;
    return n;
  }

  async start(room, { name, mapId, uid }) {
    this.stop();
    this.room = String(room).toUpperCase();
    this.name = name || "operator";
    this.uid = uid || null;
    this.mapId = mapId;

    const onMsg = (m) => this.onMessage(m);
    let t = new SupabaseTransport();
    let ok = await t.connect(this.room, onMsg);
    if (!ok) {
      t = new BroadcastTransport();
      ok = await t.connect(this.room, onMsg);
    }
    if (!ok) return false;

    this.transport = t;
    this.connected = true;
    this.since = Date.now();
    this.send({ t: "hello", id: this.id, name: this.name, u: this.uid || undefined, team: this.team, mapId: this.mapId, js: this.since, lr: 1 });

    // Let the handshake settle before anyone picks a side. Choosing the
    // instant the channel subscribes means balancing against a room that
    // still looks empty, and two clients can land on the same team.
    await new Promise((r) => setTimeout(r, HANDSHAKE_SETTLE));
    return t.kind;
  }

  stop() {
    if (this.transport) {
      this.send({ t: "bye", id: this.id });
      this.flush();
      this.transport.close();
    }
    clearTimeout(this._flushT);
    this._flushT = null;
    this._out.length = 0;
    this.transport = null;
    this.connected = false;
    this.peers.clear();
  }

  send(msg) {
    if (!this.transport) return;
    this._out.push(msg);
    if (this._out.length >= BATCH_MAX) this.flush();
    else if (!this._flushT) this._flushT = setTimeout(() => this.flush(), FLUSH_MS);
  }

  flush() {
    clearTimeout(this._flushT);
    this._flushT = null;
    const out = this._out;
    this._out = [];
    if (!out.length || !this.transport) return;
    this.transport.send(out.length === 1 ? out[0] : { t: "batch", id: this.id, m: out });
  }

  /* One chat line to the room. `teamOnly` marks it for our side only. */
  sendChat(text, teamOnly) {
    const m = { t: "chat", id: this.id, n: this.name, u: this.uid || undefined, tm: this.team, x: String(text).slice(0, 120), tt: teamOnly ? 1 : 0 };
    this.send(m);
    return m;
  }

  /* Join the side with fewer people. Only peers whose team we actually know
     are counted — counting undecided peers as phantoms made two simultaneous
     joiners both "balance" onto ghost. Bots aren't counted either: they pad
     whichever side is short, so counting them put a second human on the
     first one's side about half the time. On a genuine tie (usually because
     nobody has chosen yet) id order decides, so simultaneous joiners split. */
  chooseTeam() {
    let phantom = 0, ghost = 0;
    const humans = [];
    for (const p of this.peers.values()) {
      if (p.isBot || isSyntheticId(p.id)) continue;
      humans.push(p.id);
      if (p.team === "phantom") phantom++;
      else if (p.team === "ghost") ghost++;
    }
    if (phantom !== ghost) {
      this.team = phantom < ghost ? "phantom" : "ghost";
    } else {
      const ids = [this.id, ...humans].sort();
      this.team = ids.indexOf(this.id) % 2 === 0 ? "phantom" : "ghost";
    }
    // Announce it so peers stop seeing us as undecided.
    this.send({ t: "here", id: this.id, name: this.name, u: this.uid || undefined, team: this.team, js: this.since, lr: 1 });
    return this.team;
  }

  /* Switch sides mid-match (Infection) and tell the room right away rather
     than waiting for the next state message. */
  setTeam(team) {
    this.team = team;
    if (this.connected) this.send({ t: "here", id: this.id, name: this.name, u: this.uid || undefined, team, js: this.since, lr: 1 });
  }

  peer(id) {
    let p = this.peers.get(id);
    if (!p) {
      // team stays null until they tell us — see chooseTeam
      p = { id, team: null, name: "operator", hp: 100, alive: true, snaps: [], vote: null };
      this.peers.set(id, p);
      this.h.onJoin?.(p);
    }
    p.last = performance.now();
    return p;
  }

  onMessage(m) {
    if (!m || m.id === this.id) return;
    if (m.to && m.to !== this.id) return;

    switch (m.t) {
      case "batch": {
        if (Array.isArray(m.m)) for (const sub of m.m) this.onMessage(sub);
        break;
      }
      case "hello": {
        const p = this.peer(m.id);
        p.name = m.name || p.name;
        p.uid = accountId(m.u) || p.uid || null;
        p.team = m.team || p.team;
        if (+m.js > 0) p.since = +m.js;
        if (m.lr) p.lr = true;   // speaks "ready" (map loading screen), so worth waiting for
        // answer directly so the newcomer learns about us
        this.send({ t: "here", id: this.id, name: this.name, u: this.uid || undefined, team: this.team, js: this.since, lr: 1 });
        this.h.onHello?.(p);
        break;
      }
      case "here": {
        const p = this.peer(m.id);
        p.name = m.name || p.name;
        p.uid = accountId(m.u) || p.uid || null;
        p.team = m.team || p.team;
        if (+m.js > 0) p.since = +m.js;
        if (m.lr) p.lr = true;
        break;
      }
      /* Finished loading the map (map-load-screen): the host starts the
         countdown once every player who speaks this has sent it. */
      case "ready": {
        const p = this.peer(m.id);
        p.lr = true;
        if (+m.js > 0) p.since = +m.js;
        // `ok` 0 = still loading `map`, 1 = loaded it and waiting.
        p.readyMap = m.ok ? m.map || null : null;
        this.h.onReady?.(p, m);
        break;
      }
      case "state": {
        const p = this.peer(m.id);
        p.team = m.tm || p.team;
        p.name = m.n || p.name;
        p.hp = m.hp;
        p.alive = !!m.a;
        p.weapon = m.w;
        p.skin = m.sk || null;
        p.kills = m.k | 0;
        p.deaths = m.d | 0;
        p.assists = m.as | 0;
        p.emote = m.em | 0;   // 1-based emote index, 0 = none
        p.blocking = !!m.bl;  // Trollsaber guard up
        p.face = m.fc || null;  // cosmetics.js face key ("expression:tint")
        // Rank (prestige phase 2): Troll Forces level, prestige 1-11, owner.
        p.level = m.lv | 0 || null;
        p.prestige = m.pg | 0;
        p.owner = !!m.ow;
        // Profile card (prestige phase 4): clan tag and calling card.
        p.clan = typeof m.cl === "string" ? m.cl.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) : "";
        p.card = typeof m.cc === "string" ? m.cc.slice(0, 32) : null;
        p.swivel = m.sv | 0;
        // Third-person reload: progress and length; the RemotePlayer runs it on.
        p.reload = Math.max(0, Math.min(1, +m.rl || 0));
        p.reloadTime = +m.rt || 2.3;
        p.hero = m.hr || null;
        // Socialize roleplay (saloon-bar.js): what's in their hand, a sip
        // under way, their role ("b" = bartender).
        p.drink = m.dk | 0;
        p.sipping = !!m.ds;
        p.role = m.rr === "b" ? "bartender" : null;
        if (m.bs != null) p.botSkill = BOT_SKILLS[m.bs | 0] || null;   // only bots carry it
        // keep a short history so the renderer can interpolate in the past
        p.snaps.push({ t: performance.now(), x: m.x, y: m.y, z: m.z, yaw: m.ry, pitch: m.rp, stance: m.st, moving: !!m.mv,
          ads: Math.max(0, Math.min(1, +m.ad || 0)), roll: Math.max(0, Math.min(1, +m.ro || 0)), drop: (m.dr | 0) & 3 });
        if (p.snaps.length > 12) p.snaps.shift();
        break;
      }
      case "shot": {
        this.peer(m.id).shotAt = performance.now();   // their body brings the gun up
        this.h.onRemoteShot?.(this.peer(m.id), m);
        break;
      }
      /* Throwables. The thrower's client owns the grenade — it resolves the
         damage and reports hits like any gunfire — and sends `throw` so
         everyone sees it fly and `boom` with where it actually went off, so
         smoke, flashes and fire land in the same spot for the whole room. */
      case "nade": {
        this.h.onNade?.(m);
        break;
      }
      /* A melee swing. Damage already travels as a normal "hit"; this is only
         so everyone else sees the arm come round. Stamped on the peer and
         picked up by its RemotePlayer on the next frame. */
      case "melee": {
        const p = this.peer(m.id);
        p.meleeSeq = (p.meleeSeq | 0) + 1;
        p.meleeKind = m.k | 0;
        p.meleeDef = m.md || "keyboard";
        break;
      }
      /* Their saber batted a round away (the blocker's client decides, like
         any damage it takes): sparks and a clash on everyone's screen, and
         the shooter `by` learns the hit didn't land. */
      case "deflect": {
        this.h.onDeflect?.(this.peer(m.id), m);
        break;
      }
      /* Troll Royale loot: "take" (someone picked item `i` up) or "add"
         (someone dropped `item`). Floor loot itself is never sent. */
      case "loot": {
        this.h.onLoot?.(this.peer(m.id), m);
        break;
      }
      case "hit": {
        // Everyone sees the victim flinch; only the target applies the
        // damage — to itself, or to a bot it owns.
        this.h.onHitSeen?.(m);
        if (m.target === this.id) { this.h.onHitTaken?.(m); break; }
        if (this.h.ownsBot?.(m.target)) this.h.onBotHit?.(m);
        break;
      }
      case "died": {
        const p = this.peer(m.id);
        p.alive = false;
        this.h.onPeerDied?.(p, m);
        break;
      }
      /* The staging countdown is shared state: whoever started the match owns
         the clock and republishes it, so a client joining or reloading mid
         countdown lands on the same number everyone else already sees. */
      case "stage": {
        this.h.onStage?.(m);
        break;
      }
      /* Search & Destroy: bomb state, plant/defuse progress, and round
         transitions. Whoever is holding the interact key owns the progress
         and broadcasts it; the outcome (planted/defused/exploded) is the one
         thing every client must agree on regardless of who reports it. */
      case "bomb": {
        this.h.onBomb?.(m);
        break;
      }
      /* Scorestreaks. Same authority model as the bomb above: whoever earned
         the streak decides everything about it — where the crate lands, what
         is inside, which enemy the drone picks, where the strike falls — and
         broadcasts the decision. Everyone else renders it and never re-rolls
         anything locally, or two clients would disagree about a crate they
         are both looking at. */
      case "streak": {
        this.h.onStreak?.(m);
        break;
      }
      /* Infection: the bot host picks who starts infected and says so. Each
         named player turns itself; bots turn on the host. */
      case "infect": {
        this.h.onInfect?.(m);
        break;
      }
      /* U Mad Bro? hero effects (fling, pin, slam): sent to one target id.
         The target's own client applies it to itself, or the bot host to
         its bot, the same split as hits. */
      case "fx": {
        this.h.onFx?.(m);
        break;
      }
      /* Match chat (chat.js). Nothing is stored: only whoever is in the
         room right now sees it. Team chat is filtered by the receiver. */
      case "chat": {
        this.h.onChat?.(this.peer(m.id), m);
        break;
      }
      /* Duo emotes (emotes.js): "invite" to one teammate, "accept" back with
         the spot both players snap to. Addressed with `to`. */
      case "duo": {
        this.h.onDuo?.(this.peer(m.id), m);
        break;
      }
      /* Socialize roleplay (saloon-bar.js): a drink held out to someone,
         taken, handed over; the bartender's bell. Addressed with `to`
         where it's for one player. */
      case "rp": {
        this.h.onRp?.(this.peer(m.id), m);
        break;
      }
      /* Socialize: the owner switched the room to another mode (or back). */
      case "mode": {
        this.h.onMode?.(this.peer(m.id), m);
        break;
      }
      case "vote": {
        const p = this.peer(m.id);
        p.vote = m.map;
        this.h.onVote?.(p, m.map);
        break;
      }
      case "bye": {
        const p = this.peers.get(m.id);
        if (p) { this.h.onLeave?.(p); this.peers.delete(m.id); }
        break;
      }
    }
  }

  /* Called every frame by the game with the local player's snapshot. */
  update(dt, local) {
    if (!this.connected) return;
    this._acc += dt;
    if (this._acc >= 1 / STATE_HZ) {
      this._acc = 0;
      this.send({
        t: "state", id: this.id,
        x: round2(local.x), y: round2(local.y), z: round2(local.z),
        ry: round2(local.yaw), rp: round2(local.pitch),
        st: local.stance, mv: local.moving ? 1 : 0,
        hp: Math.round(local.hp), a: local.alive ? 1 : 0,
        w: local.weapon, sk: local.skin || undefined, tm: this.team, n: this.name, k: local.kills | 0,
        d: local.deaths | 0, as: local.assists | 0,
        em: local.emote || undefined,
        bl: local.block ? 1 : undefined,
        ad: local.ads > 0.01 ? round2(local.ads) : undefined,   // aiming down sights, 0..1
        rl: local.reload > 0 ? round2(local.reload) : undefined,   // reload progress, 0..1
        rt: local.reload > 0 ? Math.round(local.reloadTime * 10) / 10 : undefined,   // ...and its length, s
        ro: local.roll > 0 ? round2(local.roll) : undefined,    // Royale landing roll, 0..1
        dr: local.drop || undefined,   // Royale drop: 1 bus, 2 freefall, 3 glider
        fc: local.face && local.face !== "grin:og" ? local.face : undefined,   // cosmetics.js face
        sv: local.swivel || undefined,   // swivel: side (sign) * count, a new count = a new spin
        lv: local.level || undefined, pg: local.prestige || undefined, ow: local.owner ? 1 : undefined,   // rank
        cl: local.clan || undefined, cc: local.card && local.card !== "hitman" ? local.card : undefined,   // profile card
        hr: local.hero || undefined,   // U Mad Bro? hero id (+ "!" while the Metamorph is the brute)
        dk: local.drink || undefined, ds: local.sip ? 1 : undefined, rr: local.role || undefined,   // Socialize roleplay
      });
    }
    this.prune();
  }

  /* Drop peers we haven't heard from. update() does this every frame; the
     map loading screen calls it on its own, since it sends no state. */
  prune() {
    const now = performance.now();
    for (const [id, p] of this.peers) {
      if (now - p.last > PEER_TIMEOUT) { this.h.onLeave?.(p); this.peers.delete(id); }
    }
  }

  /* Exactly one client simulates the bots: whoever has been in the room
     longest (join time from hello/here, lowest id breaks a tie). Every client
     computes this from the same set, so they agree without electing. It used
     to be the lowest id alone, so anyone joining mid-match with a lower
     random id took the bots over: the old host's bots timed out and a fresh
     set spawned (in Troll Royale, 99 new bots on the ground mid-match). A
     peer whose join time we haven't heard yet counts as the older one. */
  isBotHost() {
    if (!this.connected) return true;
    for (const [id, p] of this.peers) {
      // Bots live in this map too, and their ids would otherwise make the
      // host conclude it isn't the host and drop its own bots. Scorestreak
      // entities (drones, gunships) ride the same publishBot channel and are
      // simulated by whoever called them, so they are not operators either —
      // miss them here and calling a streak silently flips host election.
      if (isSyntheticId(id)) continue;
      const since = p.since || 0;
      if (since < this.since || (since === this.since && id < this.id)) return false;
    }
    return true;
  }

  /* Broadcast a bot as if it were a player, and mirror it into our own peer
     map so the local renderer treats it like any other operator. */
  publishBot(bot) {
    const snap = {
      t: performance.now(),
      x: bot.pos.x, y: bot.pos.y, z: bot.pos.z,
      yaw: bot.yaw, pitch: bot.pitch, stance: bot.stance || "stand", moving: !!bot.moving, ads: bot.ads || 0, roll: bot.roll || 0, drop: bot.dropCode || 0,
    };
    let p = this.peers.get(bot.id);
    if (!p) {
      p = { id: bot.id, team: bot.team, name: bot.name, hp: bot.hp, alive: bot.alive, snaps: [], isBot: true };
      this.peers.set(bot.id, p);
      this.h.onJoin?.(p);
    }
    p.team = bot.team;
    p.name = bot.name;
    p.hp = bot.hp;
    p.alive = bot.alive;
    p.kills = bot.kills;
    p.deaths = bot.deaths;
    p.botSkill = bot.skill || null;
    p.level = botLevel(bot.id);
    p.reload = bot.reloadProgress?.() || 0;
    p.reloadTime = bot.holdingSecondary ? 1.5 : 2.3;
    p.hero = bot.hero || null;   // U Mad Bro? (the wire carries it as hr below)
    // The wire "state" message sets this on every OTHER client (case "state"
    // above); the bot-hosting client never routes its own bots' state through
    // onMessage, so without this line the host's own view of its bots never
    // learns their weapon and always falls back to the rig's generic gun.
    // An infected bot carries only its sword.
    p.weapon = bot.meleeOnly ? "keyboard" : (bot.holdingSecondary ? bot.secondaryId : bot.weaponId) || "problem416";
    p.last = performance.now();
    p.snaps.push(snap);
    if (p.snaps.length > 12) p.snaps.shift();

    if (!this.connected) return;
    // Bots are simulated locally every frame (60Hz) so the local mirror above
    // stays smooth, but the network send needs the same throttle the human
    // player's own state gets in update() — otherwise every bot broadcasts at
    // full frame rate instead of STATE_HZ, multiplying outbound traffic with
    // bot count and dragging the whole match down.
    const now = snap.t;
    const hz = this.botCount > CROWD_BOTS ? BOT_HZ_CROWD : STATE_HZ;
    if (now - (p.lastSent || 0) < 1000 / hz) return;
    p.lastSent = now;
    this.send({
      t: "state", id: bot.id,
      x: round2(bot.pos.x), y: round2(bot.pos.y), z: round2(bot.pos.z),
      ry: round2(bot.yaw), rp: 0, st: bot.stance || "stand", mv: 1,
      hp: Math.round(bot.hp), a: bot.alive ? 1 : 0,
      w: p.weapon, tm: bot.team, n: bot.name, k: bot.kills | 0, d: bot.deaths | 0,
      ad: bot.ads > 0.01 ? round2(bot.ads) : undefined,
      rl: p.reload > 0 ? round2(p.reload) : undefined,
      rt: p.reload > 0 ? p.reloadTime : undefined,
      ro: bot.roll > 0 ? round2(bot.roll) : undefined,
      dr: bot.dropCode || undefined,
      bs: Math.max(0, BOT_SKILLS.indexOf(bot.skill)),
      lv: botLevel(bot.id),
      hr: bot.hero || undefined,
    });
  }

  dropBot(botId) {
    const p = this.peers.get(botId);
    if (p) { this.h.onLeave?.(p); this.peers.delete(botId); }
    this.send({ t: "bye", id: botId });
  }

  /* Pre-match staging. The client that starts the match owns the clock and
     republishes the remaining seconds, so everyone drops in together and a
     late arrival joins the countdown already in progress rather than
     starting its own. */
  /* `seed`: Troll Royale's match seed (zone + loot), so late joiners agree. */
  publishStage(mapId, modeId, secondsLeft, seed) {
    this.send({
      t: "stage", id: this.id, map: mapId, mode: modeId,
      left: Math.max(0, round2(secondsLeft)),
      ...(seed != null ? { sd: seed } : {}),
      ms: this.modeSeq || undefined,
    });
  }

  /* Troll Royale, to one newcomer: where the match already is (a "stage"
     at 0 carrying the seed, the bus clock and the match clock), so they
     don't sit out a sky lobby of their own while everyone else plays. */
  publishRoyaleCatchUp(to, seed, busT, matchT, live) {
    this.send({ t: "stage", id: this.id, to, left: 0, sd: seed, bt: round2(busT), rt: round2(matchT), lv: live ? 1 : 0 });
  }

  /* To one newcomer: the map and mode the room is playing (a "stage" at 0,
     the match is already on), so they load the host's map, not their own. */
  /* Where this client is on the map loading screen: loading `mapId`, or
     (ok) done and waiting. Resent every second or so, since a broadcast can
     be missed; it also tells the room which map the host is on early. */
  publishReady(mapId, modeId, ok) {
    // `js` too: a loader whose tab froze building the map can time out of
    // our peer list and come back through this message, and without its
    // join time it would count as the room's oldest player and take the
    // host role, leaving the real host and it each waiting on the other.
    this.send({ t: "ready", id: this.id, map: mapId, mode: modeId, ok: ok ? 1 : 0, js: this.since, ms: this.modeSeq || undefined });
  }

  /* To one player who finished loading: come in. `left` is the countdown
     still running (0 = the match is already on). */
  publishGo(to, mapId, modeId, secondsLeft) {
    this.send({ t: "stage", id: this.id, to, map: mapId, mode: modeId, left: Math.max(0, round2(secondsLeft)), go: 1, ms: this.modeSeq || undefined });
  }

  publishRoomMap(to, mapId, modeId) {
    this.send({ t: "stage", id: this.id, to, map: mapId, mode: modeId, left: 0, ms: this.modeSeq || undefined });
  }

  /* Socialize roleplay: { k: "offer"|"take"|"give"|"bell", to?, ... }. */
  publishRp(payload) {
    this.send({ t: "rp", id: this.id, ...payload });
  }

  /* Socialize: switch everyone in the room to `modeId` on `mapId`. `ms` is
     the room's new mode count; anyone behind it follows. */
  publishMode(modeId, mapId, ms) {
    this.send({ t: "mode", id: this.id, mode: modeId, map: mapId || undefined, ms });
  }

  /* Search & Destroy bomb state. `kind` is "action" for a live plant/defuse
     in progress (sent a few times a second by whoever is holding it) or
     "event" for a one-off outcome (planted/defused/exploded/reset) that
     every client applies once and remembers regardless of order. */
  publishBomb(payload) {
    this.send({ t: "bomb", id: this.id, ...payload });
  }

  /* Scorestreak events. `kind` names the streak ("uav", "carepackage",
     "drone", "airstrike", "heli") or "callout" for the match-wide hype
     messages, and `action` its step within that streak's lifecycle. The
     sender is always the client that earned it and is the only one that
     decides anything — see the "streak" case in onMessage. */
  publishStreak(payload) {
    this.send({ t: "streak", id: this.id, ...payload });
  }

  /* Map vote. Peers keep the last vote each id sent, so a late joiner's
     tally still converges on the same answer everyone else has. */
  castVote(mapId) {
    this.myVote = mapId;
    this.send({ t: "vote", id: this.id, map: mapId });
  }

  clearVotes() {
    this.myVote = null;
    for (const p of this.peers.values()) p.vote = null;
  }

  /* Winner of the current vote, or null when nothing has been cast. Ties are
     broken by map id so every client independently agrees, the same trick
     chooseTeam uses for simultaneous joiners. */
  voteWinner() {
    const tally = new Map();
    const add = (m) => { if (m) tally.set(m, (tally.get(m) || 0) + 1); };
    add(this.myVote);
    for (const p of this.peers.values()) {
      if (isSyntheticId(p.id)) continue;   // bots and streak entities don't get a say
      add(p.vote);
    }
    let best = null, bestN = 0;
    for (const [map, n] of [...tally].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
      if (n > bestN) { best = map; bestN = n; }
    }
    return best;
  }

  reportHitAs(fromId, targetId, dmg, isHead, weaponId) {
    this.send({ t: "hit", id: fromId, target: targetId, dmg: Math.round(dmg), hd: isHead ? 1 : 0, w: weaponId });
  }

  /* `streak` is the dying actor's own kill streak. Nobody else tracks it, so
     the killer can only know it ended a run if the victim says so — that's
     what the Shutdown achievement reads. */
  reportDeathAs(whoId, byId, weaponId, isHead, streak = 0) {
    this.send({ t: "died", id: whoId, by: byId, w: weaponId, hd: isHead ? 1 : 0, sk: streak | 0 });
  }

  /* `quiet` is the suppressor: the base weapon id alone can't say whether
     this copy of the gun has one fitted. */
  reportShot(origin, dir, weaponId, quiet = false, charge = 0) {
    this.reportShotAs(this.id, origin, dir, weaponId, quiet, charge);
  }

  /* A bot's shot goes out under the bot's id, so every other client hears
     and sees it — bots used to fire only on the host's screen. */
  /* `charge` 0..1: a charge weapon's shot level (Green Candles), so every
     copy draws the bolt at the size it was fired. */
  reportShotAs(fromId, origin, dir, weaponId, quiet = false, charge = 0) {
    this.send({
      t: "shot", id: fromId,
      ox: round2(origin.x), oy: round2(origin.y), oz: round2(origin.z),
      dx: round2(dir.x), dy: round2(dir.y), dz: round2(dir.z),
      w: weaponId, q: quiet ? 1 : 0,
      ...(charge > 0 ? { c: round2(charge) } : {}),
    });
  }

  /* `kind` is the swing's index parity: 0 = overhead swing, 1 = thrust,
     so the remote arm plays the same attack the swinger sees. */
  publishMelee(kind, meleeId) {
    this.publishMeleeAs(this.id, kind, meleeId);
  }

  publishMeleeAs(fromId, kind, meleeId) {
    this.send({ t: "melee", id: fromId, k: kind & 1, md: meleeId });
  }

  publishLoot(payload) {
    this.send({ t: "loot", id: this.id, ...payload });
  }

  /* kind "fling": { dx, dy, dz } velocity · "pin": { s } seconds. */
  publishFx(targetId, kind, data = {}) {
    this.send({ t: "fx", id: this.id, to: targetId, k: kind, ...data });
  }

  publishDeflect(byId, weaponId) {
    this.send({ t: "deflect", id: this.id, by: byId || undefined, w: weaponId || undefined });
  }

  /* action "throw": { gid, def, ox..dz, fuse } · action "boom": { gid, def, x, y, z } */
  publishNade(payload) {
    this.publishNadeAs(this.id, this.team, payload);
  }

  /* A bot's grenade goes out under the bot's id and side, so a bot's flash
     spares the bot's team on every screen, not the host's. */
  publishNadeAs(fromId, team, payload) {
    this.send({ t: "nade", id: fromId, team, ...payload });
  }

  reportHit(targetId, dmg, isHead, weaponId) {
    this.send({ t: "hit", id: this.id, target: targetId, dmg: Math.round(dmg), hd: isHead ? 1 : 0, w: weaponId });
  }

  reportDeath(byId, weaponId, isHead, streak = 0) {
    this.send({ t: "died", id: this.id, by: byId, w: weaponId, hd: isHead ? 1 : 0, sk: streak | 0 });
  }
}

function round2(v) { return Math.round(v * 100) / 100; }
