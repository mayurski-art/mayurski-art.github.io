// Grin Sabers — a duel: two fighters, first to 2 rounds, 90 s a round.
//
// `kind`: "bot" (you against a DuelBot) or "demo" (bot against bot, for the
// title screen and, later, spectators). The duel runs the round flow and the
// contact checks; everything it wants seen or heard goes out as events.

import { Fighter } from "../combat/fighter.js?v=gs2";
import { resolveFrame, updateClash } from "../combat/resolve.js?v=gs2";
import { DuelBot, TIERS } from "../bots/duel-bot.js?v=gs2";

export const ROUNDS_TO_WIN = 2;
export const ROUND_TIME = 90;
const START_GAP = 2.7;

export class Duel {
  constructor({ scene, arena, ctx, kind = "bot", tier = 1, colour = "#3fa9ff", lights, rnd = Math.random, demoTiers = [2, 3] }) {
    this.scene = scene;
    this.arena = arena;
    this.ctx = ctx;
    this.kind = kind;
    this.rnd = rnd;
    const tA = kind === "demo" ? TIERS[demoTiers[0]] : null;
    const tB = TIERS[kind === "demo" ? demoTiers[1] : tier];
    this.a = new Fighter(scene, { name: kind === "demo" ? tA.name : "You", colour: kind === "demo" ? tA.colour : colour, light: lights[0] });
    this.b = new Fighter(scene, { name: tB.name, colour: tB.colour, isBot: true, light: lights[1] });
    this.bots = [new DuelBot(this.b, kind === "demo" ? demoTiers[1] : tier, rnd)];
    if (kind === "demo") { this.a.isBot = true; this.bots.push(new DuelBot(this.a, demoTiers[0], rnd)); }
    this.a.showTag = kind === "demo";   // your own name over your head just blocks the view
    this.tierIndex = tier;
    this.round = 0;
    this.wins = { a: 0, b: 0 };
    this.clash = null;
    this.over = false;
    this.paused = false;
    this.startRound();
  }

  get me() { return this.a; }
  get them() { return this.b; }

  startRound() {
    this.round++;
    this.phase = "intro";
    this.phaseT = 0;
    this.clock = ROUND_TIME;
    this.clash = null;
    // swap ends every round so the light falls differently
    const ang = this.rnd() * Math.PI * 2;
    const cx = Math.cos(ang) * START_GAP, cz = Math.sin(ang) * START_GAP;
    this.a.reset(-cx, -cz, Math.atan2(-(cx * 2), -(cz * 2)));
    this.b.reset(cx, cz, Math.atan2(cx * 2, cz * 2));
    this.ignited = false;
    this.fought = false;
    this.ctx.emit("roundStart", { duel: this, round: this.round });
  }

  update(dt, now) {
    if (this.over && this.phase === "done") return;
    this.phaseT += dt;
    const { a, b } = this;

    if (this.phase === "intro") {
      if (!this.ignited && this.phaseT > 0.8) { this.ignited = true; a.saber.ignite(); b.saber.ignite(); this.ctx.emit("ignite", this); }
      if (!this.fought && this.phaseT > 1.9) { this.fought = true; this.ctx.emit("fight", this); }
      if (this.phaseT > 2.2) { this.phase = "fight"; this.phaseT = 0; a.frozen = b.frozen = false; }
    } else if (this.phase === "fight") {
      this.clock -= dt;
      if (this.clock <= 0) this.endRound(null, "time");
    } else if (this.phase === "ko") {
      if (this.phaseT > 3.0) this.nextOrEnd();
    }

    for (const bot of this.bots) bot.think(dt, now, bot.f === a ? b : a);
    a.update(dt, now, b, this.arena, this.ctx);
    b.update(dt, now, a, this.arena, this.ctx);

    if (this.phase === "fight") {
      if (a.clash && a.clash === b.clash) {
        updateClash(a.clash, dt, now, this.ctx);
      } else {
        resolveFrame(a, b, now, this.ctx);
      }
      if (!a.alive || !b.alive) this.endRound(a.alive ? a : b.alive ? b : null, "ko");
    }
  }

  endRound(winner, why) {
    if (this.phase !== "fight") return;
    if (why === "time") {
      winner = this.a.hp > this.b.hp ? this.a : this.b.hp > this.a.hp ? this.b : null;
    }
    if (winner === this.a) this.wins.a++;
    else if (winner === this.b) this.wins.b++;
    this.phase = "ko";
    this.phaseT = 0;
    this.roundWinner = winner;
    for (const f of [this.a, this.b]) { f.frozen = true; f.state = f.alive ? "idle" : f.state; f.swing = f.alive ? null : f.swing; }
    const matchOver = this.wins.a >= ROUNDS_TO_WIN || this.wins.b >= ROUNDS_TO_WIN;
    this.ctx.emit("roundEnd", { duel: this, winner, why, matchOver });
  }

  nextOrEnd() {
    if (this.wins.a >= ROUNDS_TO_WIN || this.wins.b >= ROUNDS_TO_WIN) {
      this.over = true;
      this.phase = "done";
      this.ctx.emit("matchEnd", { duel: this, winner: this.wins.a > this.wins.b ? this.a : this.b });
      return;
    }
    this.startRound();
  }

  dispose() {
    this.a.dispose();
    this.b.dispose();
  }
}
