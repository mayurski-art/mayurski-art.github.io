// Troll Forces — the season, in one place. The lobby's Play page shows it
// (menu/lobby-fn.js: "Chapter One", its dates and a countdown) and the
// Zombies hub dresses for it (modes/zombies/hub-hall.js: the clock in the
// parlour, the pumpkins, the Halloween run).
//
// Halloween runs as long as Chapter One does (user, 2026-10-30: "the
// halloween theme should be connected to the timer duration of chapter
// one"): from the first of October, when the lobby first went Halloween, to
// the end of 12 November, local time. ?season=halloween or ?season=off
// forces it either way (the tests, the screenshots).

export const SEASON = {
  name: "Chapter One",
  start: new Date(2026, 9, 26),
  end: new Date(2026, 10, 12, 23, 59, 59),
};
const HALLOWEEN_FROM = new Date(2026, 9, 1);

/* "13D 4H left", "5H 20M left", or "Season ended". */
export function seasonLeft(now = Date.now()) {
  const ms = SEASON.end - now;
  if (ms <= 0) return "Season ended";
  const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor(m / 60) % 24;
  return d ? `${d}D ${h}H left` : `${h}H ${m % 60}M left`;
}

export function halloween(now = Date.now()) {
  const force = typeof location !== "undefined" ? new URLSearchParams(location.search).get("season") : null;
  if (force) return force === "halloween";
  return now >= HALLOWEEN_FROM && now <= SEASON.end;
}
