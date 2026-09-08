// Troll Ops — PvP networking.
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

export const MAX_PLAYERS = 12;
const STATE_HZ = 15;
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

export class Net {
  constructor(handlers = {}) {
    this.h = handlers;
    this.id = Math.random().toString(36).slice(2, 10);
    this.transport = null;
    this.room = null;
    this.connected = false;
    this.team = null;   // stays unset until chooseTeam, so it can't leak into the handshake
    this.name = "operator";
    this.mapId = "grinsite";
    this.peers = new Map();   // id -> { team, name, last, ... }
    this._acc = 0;
  }

  get active() { return this.connected; }
  get playerCount() { return this.peers.size + 1; }

  async start(room, { name, mapId }) {
    this.stop();
    this.room = String(room).toUpperCase();
    this.name = name || "operator";
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
    this.send({ t: "hello", id: this.id, name: this.name, team: this.team, mapId: this.mapId });

    // Let the handshake settle before anyone picks a side. Choosing the
    // instant the channel subscribes means balancing against a room that
    // still looks empty, and two clients can land on the same team.
    await new Promise((r) => setTimeout(r, HANDSHAKE_SETTLE));
    return t.kind;
  }

  stop() {
    if (this.transport) {
      this.send({ t: "bye", id: this.id });
      this.transport.close();
    }
    this.transport = null;
    this.connected = false;
    this.peers.clear();
  }

  send(msg) { this.transport?.send(msg); }

  /* Join the smaller side. Only peers whose team we actually know are counted —
     counting undecided peers as phantoms made two simultaneous joiners both
     "balance" onto ghost. On a genuine tie (usually because nobody has chosen
     yet) id order decides, so simultaneous joiners split. */
  chooseTeam() {
    let phantom = 0, ghost = 0;
    for (const p of this.peers.values()) {
      if (p.team === "phantom") phantom++;
      else if (p.team === "ghost") ghost++;
    }
    if (phantom !== ghost) {
      this.team = phantom < ghost ? "phantom" : "ghost";
    } else {
      const ids = [this.id, ...this.peers.keys()].sort();
      this.team = ids.indexOf(this.id) % 2 === 0 ? "phantom" : "ghost";
    }
    // Announce it so peers stop seeing us as undecided.
    this.send({ t: "here", id: this.id, name: this.name, team: this.team });
    return this.team;
  }

  peer(id) {
    let p = this.peers.get(id);
    if (!p) {
      // team stays null until they tell us — see chooseTeam
      p = { id, team: null, name: "operator", hp: 100, alive: true, snaps: [] };
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
      case "hello": {
        const p = this.peer(m.id);
        p.name = m.name || p.name;
        p.team = m.team || p.team;
        // answer directly so the newcomer learns about us
        this.send({ t: "here", id: this.id, name: this.name, team: this.team });
        break;
      }
      case "here": {
        const p = this.peer(m.id);
        p.name = m.name || p.name;
        p.team = m.team || p.team;
        break;
      }
      case "state": {
        const p = this.peer(m.id);
        p.team = m.tm || p.team;
        p.name = m.n || p.name;
        p.hp = m.hp;
        p.alive = !!m.a;
        p.weapon = m.w;
        p.kills = m.k | 0;
        // keep a short history so the renderer can interpolate in the past
        p.snaps.push({ t: performance.now(), x: m.x, y: m.y, z: m.z, yaw: m.ry, pitch: m.rp, stance: m.st, moving: !!m.mv });
        if (p.snaps.length > 12) p.snaps.shift();
        break;
      }
      case "shot": {
        this.h.onRemoteShot?.(this.peer(m.id), m);
        break;
      }
      case "hit": {
        // Only the target applies it — to itself, or to a bot it owns.
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
        w: local.weapon, tm: this.team, n: this.name, k: local.kills | 0,
      });
    }
    const now = performance.now();
    for (const [id, p] of this.peers) {
      if (now - p.last > PEER_TIMEOUT) { this.h.onLeave?.(p); this.peers.delete(id); }
    }
  }

  /* Exactly one client simulates the bots: the lowest id in the room. Every
     client computes this from the same set, so they agree without electing. */
  isBotHost() {
    if (!this.connected) return true;
    for (const id of this.peers.keys()) {
      // Bots live in this map too, and their ids would otherwise make the
      // host conclude it isn't the host and drop its own bots.
      if (String(id).startsWith("bot-")) continue;
      if (id < this.id) return false;
    }
    return true;
  }

  /* Broadcast a bot as if it were a player, and mirror it into our own peer
     map so the local renderer treats it like any other operator. */
  publishBot(bot) {
    const snap = {
      t: performance.now(),
      x: bot.pos.x, y: bot.pos.y, z: bot.pos.z,
      yaw: bot.yaw, pitch: bot.pitch, stance: "stand", moving: true,
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
    p.last = performance.now();
    p.snaps.push(snap);
    if (p.snaps.length > 12) p.snaps.shift();

    if (!this.connected) return;
    this.send({
      t: "state", id: bot.id,
      x: round2(bot.pos.x), y: round2(bot.pos.y), z: round2(bot.pos.z),
      ry: round2(bot.yaw), rp: 0, st: "stand", mv: 1,
      hp: Math.round(bot.hp), a: bot.alive ? 1 : 0,
      w: "problem416", tm: bot.team, n: bot.name, k: bot.kills | 0,
    });
  }

  dropBot(botId) {
    const p = this.peers.get(botId);
    if (p) { this.h.onLeave?.(p); this.peers.delete(botId); }
    this.send({ t: "bye", id: botId });
  }

  reportHitAs(fromId, targetId, dmg, isHead, weaponId) {
    this.send({ t: "hit", id: fromId, target: targetId, dmg: Math.round(dmg), hd: isHead ? 1 : 0, w: weaponId });
  }

  reportDeathAs(whoId, byId, weaponId) {
    this.send({ t: "died", id: whoId, by: byId, w: weaponId });
  }

  reportShot(origin, dir, weaponId) {
    this.send({
      t: "shot", id: this.id,
      ox: round2(origin.x), oy: round2(origin.y), oz: round2(origin.z),
      dx: round2(dir.x), dy: round2(dir.y), dz: round2(dir.z),
      w: weaponId,
    });
  }

  reportHit(targetId, dmg, isHead, weaponId) {
    this.send({ t: "hit", id: this.id, target: targetId, dmg: Math.round(dmg), hd: isHead ? 1 : 0, w: weaponId });
  }

  reportDeath(byId, weaponId) {
    this.send({ t: "died", id: this.id, by: byId, w: weaponId });
  }
}

function round2(v) { return Math.round(v * 100) / 100; }
