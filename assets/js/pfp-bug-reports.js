/* ============================================================================
   PFP STUDIO — bug reports  →  window.TrollPfpBugs

   "Report a bug" button on pfp.html: opens a comment box, submits to a
   dev-only Supabase table (`pfp_bug_reports`). Anyone can file one, including
   a guest with no account — see troll_pfp_bug_reports.sql for the
   insert-open / read-only-to-troll_runner RLS split.

   Same Supabase project the rest of the site already uses (public anon key,
   safe to ship — the RLS policy is the actual boundary).
   ============================================================================ */
(() => {
  "use strict";
  if (window.TrollPfpBugs) return;   // singleton

  const SUPABASE_URL = "https://tjsyhfplxjtakdfkpdtg.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3loZnBseGp0YWtkZmtwZHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTc0ODksImV4cCI6MjA5MTk3MzQ4OX0.xLUcPUUguRBQttNwiIRWJHxjJjLqrQDMu4Ubsk5yZoQ";
  const TABLE = "pfp_bug_reports";
  const MAX_LEN = 500;
  const COOLDOWN_MS = 10 * 60 * 1000;

  // Cooldown is enforced client-side against a localStorage timestamp, keyed
  // to this browser rather than an account — the whole point is it also
  // applies to guests, who have no server-side identity to rate-limit
  // against. A visitor who clears localStorage can bypass it; that's the
  // same trust model the rest of this guest-facing site already runs on
  // (no other anti-abuse infra exists here), not a regression.
  const COOLDOWN_KEY = "trollrunner_pfp_bug_report_cooldown";

  let client = null;
  function getClient() {
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return client;
  }

  // Reuses the troll-accounts session (if signed in) so a report is linked
  // to a reporter_id when possible, without requiring an account.
  function getAccountsClient() {
    if (!window.supabase || !window.supabase.createClient) return null;
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "trollrunner-accounts-auth",
      },
    });
  }

  function msRemaining() {
    try {
      const until = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
      return Math.max(0, until - Date.now());
    } catch { return 0; }
  }

  function startCooldown() {
    try { localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS)); } catch {}
  }

  function formatRemaining(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  }

  async function submit(message) {
    const trimmed = String(message || "").trim();
    if (!trimmed) return { ok: false, reason: "empty", message: "Write what went wrong first." };
    if (trimmed.length > MAX_LEN) return { ok: false, reason: "too_long", message: `Keep it under ${MAX_LEN} characters.` };
    const remaining = msRemaining();
    if (remaining > 0) return { ok: false, reason: "cooldown", message: `You can send another report in ${formatRemaining(remaining)}.` };

    const c = getClient();
    if (!c) return { ok: false, reason: "offline", message: "Report service unavailable — try again in a bit." };

    let reporterId = null;
    try {
      const acc = getAccountsClient();
      if (acc) {
        const { data } = await acc.auth.getSession();
        reporterId = data?.session?.user?.id || null;
      }
    } catch {}

    const record = {
      message: trimmed,
      reporter_id: reporterId,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      build: window.TrollPfpBuild ? window.TrollPfpBuild() : null,
    };

    try {
      const { error } = await c.from(TABLE).insert([record]);   // no .select(): RLS allows insert only for guests
      if (error) return { ok: false, reason: "db", message: error.message };
      startCooldown();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: "network", message: String((e && e.message) || e) };
    }
  }

  // Admin read/resolve — only returns rows at all if the signed-in account's
  // troll_profiles.username is 'troll_runner' (see the RLS policy); anyone
  // else's query just comes back empty rather than erroring.
  async function list() {
    const acc = getAccountsClient();
    if (!acc) return { ok: false, reports: [] };
    const { data, error } = await acc.from(TABLE).select("*").order("created_at", { ascending: false });
    if (error) return { ok: false, reports: [], message: error.message };
    return { ok: true, reports: data || [] };
  }

  async function resolve(id) {
    const acc = getAccountsClient();
    if (!acc) return { ok: false };
    const { error } = await acc.from(TABLE).update({ status: "resolved" }).eq("id", id);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  window.TrollPfpBugs = { submit, list, resolve, msRemaining, formatRemaining, MAX_LEN };
})();
