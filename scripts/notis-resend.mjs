#!/usr/bin/env node
/* ============================================================
   TROLL NOTIS — scheduled resend worker (GitHub Actions)
   Fires the queued 8 AM / 5 PM Pacific resends that the admin
   composer scheduled. Runs on a cron (see notis-resend.yml).

   For each due queue entry it appends the alert to `notifs` (so
   every open page picks it up on its next poll and pops the toast
   again) and removes it from the queue. Reads/writes only the
   `__trollrunner_notis_meta__` item inside the shared `main` row,
   leaving all other site state untouched. No npm deps (uses
   Node 20 global fetch).
   ============================================================ */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tjsyhfplxjtakdfkpdtg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3loZnBseGp0YWtkZmtwZHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTc0ODksImV4cCI6MjA5MTk3MzQ4OX0.xLUcPUUguRBQttNwiIRWJHxjJjLqrQDMu4Ubsk5yZoQ';
const SUPABASE_TABLE = 'site_updates';
const ROW_ID = 'main';
const NOTIS_META_ID = '__trollrunner_notis_meta__';
const MAX_STORED = 20;

function headers(extra) {
  return Object.assign({
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
  }, extra || {});
}

async function main() {
  const now = Date.now();

  const qs = new URLSearchParams({ select: 'updates', id: 'eq.' + ROW_ID, limit: '1' });
  const readRes = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?${qs}`, {
    cache: 'no-store',
    headers: headers({ 'Cache-Control': 'no-cache' }),
  });
  if (!readRes.ok) throw new Error(`read failed: HTTP ${readRes.status}`);
  const json = await readRes.json();
  const payload = Array.isArray(json) ? json[0] : json;
  const updates = Array.isArray(payload && payload.updates) ? payload.updates : [];

  const meta = updates.find(u => u && u.id === NOTIS_META_ID);
  if (!meta) { console.log('No notis meta — nothing to do.'); return; }

  const queue = Array.isArray(meta.queue) ? meta.queue : [];
  const due = queue.filter(q => q && Number(q.fireAt) <= now);
  const pending = queue.filter(q => q && Number(q.fireAt) > now);

  if (!due.length) {
    console.log(`No resends due. Pending in queue: ${pending.length}.`);
    return;
  }

  const dueNotifs = due.map(q => q.notif).filter(Boolean);
  const notifs = (Array.isArray(meta.notifs) ? meta.notifs : []).concat(dueNotifs).slice(-MAX_STORED);

  const nextMeta = { ...meta, notifs, queue: pending, createdAt: new Date().toISOString() };
  const nextUpdates = updates.map(u => (u && u.id === NOTIS_META_ID ? nextMeta : u));

  const writeRes = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([{ id: ROW_ID, updates: nextUpdates, updated_at: new Date().toISOString() }]),
  });
  if (!writeRes.ok) throw new Error(`write failed: HTTP ${writeRes.status}`);

  for (const q of due) {
    const n = q.notif || {};
    console.log(`Fired resend: [${n.platform || '?'}] "${String(n.summary || '').slice(0, 60)}" (scheduled ${q.label || new Date(Number(q.fireAt)).toISOString()})`);
  }
  console.log(`Done. Fired ${due.length}, ${pending.length} still pending.`);
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
