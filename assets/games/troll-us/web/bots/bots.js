// Troll Us web: phase 4 bots. Each one walks to a random task pad, stands at it for botTaskTime the way Studio's
// bots do a task, then picks another. The full Studio brain (fixing, venting, killing, voting) is phase 5.
import { resolve, BEAN_RADIUS } from '../core/collide.js?v=tu-4d1';
import { findPath } from './nav.js?v=tu-4d1';

const ARRIVE = 0.6;     // studs from a waypoint that count as there
const TURN_RATE = 10;   // how fast a bean swings round to face where it walks (per second)
const STUCK_TIME = 3;   // seconds without a stud of progress before a bot finds a new path

export function createBot(nav, { x, z, speed, taskTime, rng = Math.random, name = 'Bot' }) {
  const bot = { name, x, z, yaw: 0, speed, taskTime, rng, nav, path: null, wp: 0, goal: null, busy: 0,
    moving: false, stuckClock: 0, stuckFrom: [x, z], stucks: 0, repaths: 0, tasksDone: 0 };
  resolve(nav.shapes, bot, BEAN_RADIUS); // a spot on the ring round the table can land on a stool
  bot.stuckFrom = [bot.x, bot.z];
  return bot;
}

function pickPad(bot, pads) {
  let pad;
  do { pad = pads[Math.floor(bot.rng() * pads.length)]; } while (pads.length > 1 && pad === bot.goal);
  return pad;
}

function aim(bot, x, z) {
  bot.path = findPath(bot.nav, bot.x, bot.z, x, z);
  bot.wp = 0;
  bot.stuckClock = 0; bot.stuckFrom = [bot.x, bot.z];
}

function turnTo(bot, yaw, dt) {
  let d = yaw - bot.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  bot.yaw += d * Math.min(1, dt * TURN_RATE);
}

export function updateBot(bot, dt, pads, shapes) {
  bot.moving = false;
  if (bot.busy > 0) { bot.busy -= dt; return bot; }
  if (!bot.path) {
    bot.goal = pickPad(bot, pads);
    aim(bot, bot.goal.cf[0], bot.goal.cf[2]);
    if (!bot.path) { bot.busy = 1; return bot; } // nowhere to go from here: wait and try another
  }
  const wp = bot.path[bot.wp];
  if (!wp) {
    // at the pad: face it and do the task
    turnTo(bot, Math.atan2(-(bot.goal.cf[0] - bot.x), -(bot.goal.cf[2] - bot.z)), 1);
    bot.busy = bot.taskTime; bot.path = null; bot.tasksDone++;
    return bot;
  }
  const dx = wp[0] - bot.x, dz = wp[1] - bot.z, d = Math.hypot(dx, dz);
  if (d < ARRIVE) { bot.wp++; return bot; }
  const step = Math.min(d, bot.speed * dt);
  bot.x += dx / d * step; bot.z += dz / d * step;
  resolve(shapes, bot, BEAN_RADIUS);
  // a bean faces -Z at yaw 0, so facing (dx, dz) is yaw = atan2(-dx, -dz)
  turnTo(bot, Math.atan2(-dx, -dz), dt);
  bot.moving = true;

  bot.stuckClock += dt;
  if (Math.hypot(bot.x - bot.stuckFrom[0], bot.z - bot.stuckFrom[1]) > 1) { bot.stuckClock = 0; bot.stuckFrom = [bot.x, bot.z]; }
  else if (bot.stuckClock > STUCK_TIME) { bot.stucks++; bot.repaths++; aim(bot, bot.goal.cf[0], bot.goal.cf[2]); }
  return bot;
}
