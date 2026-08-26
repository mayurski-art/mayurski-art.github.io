/* ============================================================================
   TROLLRUNNER FITNESS — bootstrap module.

   Phase 0 (this file): tab-switching shell + confirming troll-accounts.js
   auth/session works on this page. Later phases hang the real dashboard,
   activity log, training plan, profile stats and coach chat off of this
   same boot() — see fitness.html for the placeholder panels each tab owns.

   Auth flow here is copied down from pfp.html's own sign-in modal (same
   markup ids renamed with the auth- prefix), not reinvented: all real work
   — sessions, passwords, X OAuth — goes through window.TrollrunnerAccounts
   (assets/js/troll-accounts.js), the shared Supabase auth/session module
   every local page (stickers, maps, pfp) and the main site already use.
   ============================================================================ */
(function () {
  'use strict';

  // ── Tabs ──
  function initTabs() {
    const nav = document.getElementById('fit-tabs');
    if (!nav) return;
    const tabs = Array.from(nav.querySelectorAll('.tab'));
    const panels = Array.from(document.querySelectorAll('.tabpanel'));

    function activate(id) {
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
      panels.forEach((p) => {
        const active = p.dataset.tab === id;
        p.dataset.active = active ? 'true' : 'false';
      });
      try { history.replaceState(null, '', `#${id}`); } catch {}
      // Charts drawn while their tab was display:none have 0 width and
      // skipped painting (see fitChartSetupCanvas) — repaint now that the
      // panel is actually laid out. Cheap no-op if fitChartRedrawAll hasn't
      // been defined yet (this can run before Analytics's script section).
      if (typeof fitChartRedrawAll === 'function') requestAnimationFrame(fitChartRedrawAll);
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => activate(tab.dataset.tab));
      tab.addEventListener('keydown', (e) => {
        const i = tabs.indexOf(tab);
        if (e.key === 'ArrowRight') { e.preventDefault(); (tabs[i + 1] || tabs[0]).focus(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); (tabs[i - 1] || tabs[tabs.length - 1]).focus(); }
      });
    });

    // Learn (Phase 8) deep-links as "#learn-<slug>" rather than a bare tab
    // id — split that off so the tab itself still resolves normally, and
    // stash the slug for initLearn() to open once it has built its DOM
    // (initLearn() runs later in boot(), after initTabs()).
    const initial = (location.hash || '').replace('#', '');
    let initialTab = initial;
    if (initial.indexOf('learn-') === 0) {
      initialTab = 'learn';
      window.__fitPendingLearnSlug = initial.slice('learn-'.length);
    }
    activate(tabs.some((t) => t.dataset.tab === initialTab) ? initialTab : 'home');
  }

  // ── Auth (sign in / create account / X) ──
  const el = {};
  let authMode = 'login';
  let authBusy = false;

  function updateAuthUI() {
    const session = window.TrollrunnerAccounts?.getCachedProfile?.() || null;
    if (!el.btnSignin) return;
    el.btnSignin.classList.add('is-visible');
    el.btnSignin.classList.toggle('is-account', !!session);
    el.btnSignin.innerHTML = '';
    if (session) {
      const icon = document.createElement('img');
      icon.src = session.avatarUrl ? String(session.avatarUrl) : 'assets/animations/troll-grin.gif';
      icon.alt = '';
      el.btnSignin.appendChild(icon);
      el.btnSignin.appendChild(document.createTextNode(session.username));
    } else {
      el.btnSignin.textContent = 'Log in';
    }
    const note = document.getElementById('session-note');
    if (note) {
      note.innerHTML = session
        ? `Signed in as <strong>${escapeHtml(session.username)}</strong>. Your Fitness data will live on this account.`
        : 'Not signed in yet — log in to save runs, lifts and coach chats to your account.';
    }
  }

  function authApplyMode() {
    const creating = authMode === 'create';
    el.authModalTitle.textContent = creating ? 'Create account' : 'Sign in';
    el.authIdLabel.textContent = creating ? 'Username' : 'Username or email';
    el.authEmailField.hidden = !creating;
    el.authPw.autocomplete = creating ? 'new-password' : 'current-password';
    el.authSubmit.textContent = creating ? 'Create account' : 'Sign in';
    el.authSwap.textContent = creating ? 'Already have one? Sign in' : 'New here? Create an account';
    el.authForgot.hidden = creating;
    el.authMsg.textContent = '';
    el.authMsg.className = 'share-modal-note';
  }

  function openAuthModal() {
    authMode = 'login';
    authApplyMode();
    el.authModal.hidden = false;
    el.authId.focus();
  }
  function closeAuthModal() {
    el.authModal.hidden = true;
    el.authForm.reset();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function initAuth() {
    el.btnSignin = document.getElementById('btn-signin');
    el.authModal = document.getElementById('authModal');
    el.authModalBackdrop = document.getElementById('authModalBackdrop');
    el.authModalClose = document.getElementById('authModalClose');
    el.authModalTitle = document.getElementById('authModalTitle');
    el.authForm = document.getElementById('authForm');
    el.authId = document.getElementById('authId');
    el.authIdLabel = document.getElementById('authIdLabel');
    el.authEmailField = document.getElementById('authEmailField');
    el.authEmail = document.getElementById('authEmail');
    el.authPw = document.getElementById('authPw');
    el.authMsg = document.getElementById('authMsg');
    el.authSubmit = document.getElementById('authSubmit');
    el.authSwap = document.getElementById('authSwap');
    el.authForgot = document.getElementById('authForgot');
    el.authXSignin = document.getElementById('authXSignin');
    if (!el.btnSignin || !el.authModal) return;

    el.btnSignin.addEventListener('click', () => {
      const session = window.TrollrunnerAccounts?.getCachedProfile?.();
      if (session) window.TrollrunnerAccounts.openProfile();
      else openAuthModal();
    });
    el.authSwap.addEventListener('click', () => {
      authMode = authMode === 'create' ? 'login' : 'create';
      authApplyMode();
    });
    el.authForgot.addEventListener('click', () => { window.TrollrunnerAccounts?.openRecovery?.(); });
    el.authModalClose.addEventListener('click', closeAuthModal);
    el.authModalBackdrop.addEventListener('click', closeAuthModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !el.authModal.hidden) closeAuthModal();
    });

    el.authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (authBusy) return;
      const accounts = window.TrollrunnerAccounts;
      if (!accounts) { el.authMsg.textContent = 'Account service is still loading. Try again in a moment.'; return; }
      const id = el.authId.value.trim();
      const pw = el.authPw.value;
      const email = el.authEmail.value.trim();
      authBusy = true;
      el.authSubmit.disabled = true;
      el.authMsg.textContent = authMode === 'create' ? 'Creating your troll…' : 'Signing in…';
      try {
        if (authMode === 'create') await accounts.register({ username: id, email, password: pw });
        else await accounts.login({ identifier: id, password: pw });
        closeAuthModal();
        updateAuthUI();
      } catch (err) {
        el.authMsg.textContent = err?.message ? String(err.message) : 'That did not work. Try again.';
        el.authMsg.className = 'share-modal-note is-err';
      } finally {
        authBusy = false;
        el.authSubmit.disabled = false;
      }
    });

    el.authXSignin.addEventListener('click', async () => {
      if (authBusy) return;
      const accounts = window.TrollrunnerAccounts;
      if (!accounts) { el.authMsg.textContent = 'Account service is still loading. Try again in a moment.'; return; }
      el.authXSignin.disabled = true;
      el.authMsg.textContent = '';
      try {
        await accounts.signInWithX();
        // Success navigates away to X — nothing left to do on this page load.
      } catch (err) {
        el.authXSignin.disabled = false;
        el.authMsg.textContent = err?.message ? String(err.message) : 'Could not start X sign-in.';
        el.authMsg.className = 'share-modal-note is-err';
      }
    });

    function handleXSigninReturn() {
      const notice = window.TrollrunnerAccounts?.consumeXSigninNotice?.();
      if (!notice) return;
      if (notice.error) {
        openAuthModal();
        el.authMsg.textContent = notice.error;
        el.authMsg.className = 'share-modal-note is-err';
      }
    }
    window.addEventListener('trollrunner:auth-changed', () => { updateAuthUI(); handleXSigninReturn(); });
    handleXSigninReturn();
  }

  /* ==========================================================================
     LOG + TRAINING (Phase 2) — ported from trollrunner-fitness's
     src/app/log/log-client.tsx + src/app/training/training-client.tsx.

     No new Supabase client is created here: every query goes through
     window.TrollrunnerAccounts.getClient() (assets/js/troll-accounts.js),
     the same shared client every local page's auth already uses, against
     the same project fitness.html's CSP connect-src already allows. XP is
     awarded through TrollrunnerAccounts.awardXp(), the same server-guarded
     RPC path games use — no separate XP wiring invented here.

     Tables read/written (fit_activities, fit_strength_sets, fit_onboarding,
     fit_profiles.humor_enabled) are defined in assets/supabase/fit_schema.sql.
     That needs to have been run against the SHARED TrollRunner Supabase
     project for any of this to persist — every query here is wrapped so a
     missing table fails soft (console warning + friendly on-page message)
     instead of breaking the tab.
     ========================================================================== */

  function fitClient() {
    return window.TrollrunnerAccounts && window.TrollrunnerAccounts.getClient
      ? window.TrollrunnerAccounts.getClient()
      : null;
  }
  function fitUser() {
    return window.TrollrunnerAccounts && window.TrollrunnerAccounts.getCachedProfile
      ? window.TrollrunnerAccounts.getCachedProfile()
      : null;
  }

  // ── Static data (ported 1:1 from src/lib/activities/presets.ts) ──
  const RUN_DISTANCE_PRESETS = [
    { label: '1 mi', value: '1' },
    { label: '5K', value: '3.1' },
    { label: '5 mi', value: '5' },
    { label: '10K', value: '6.2' },
    { label: '10 mi', value: '10' },
    { label: 'Half', value: '13.1' },
    { label: 'Marathon', value: '26.2' },
  ];
  const STRENGTH_EXERCISE_PRESETS = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Pull-up', 'Push-up', 'Row', 'Lunge'];
  const EFFORT_LEVELS = [
    { max: 2, emoji: '😴', label: 'Recovery' },
    { max: 4, emoji: '🙂', label: 'Easy' },
    { max: 6, emoji: '😅', label: 'Moderate' },
    { max: 8, emoji: '😤', label: 'Hard' },
    { max: 10, emoji: '🥵', label: 'All-out' },
  ];
  function effortLevelFor(v) { return EFFORT_LEVELS.find((l) => v <= l.max) || EFFORT_LEVELS[EFFORT_LEVELS.length - 1]; }
  const STREAK_MILESTONES = [7, 30, 100];
  const CELEBRATION_MESSAGES = ['Logged. The troll approves.', 'Another one in the books.', 'Future you says thanks.', "That's going in the streak.", 'Nice work out there.'];
  function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ── Strength programs (ported 1:1 from src/lib/strength/programs.ts) ──
  const PROGRAMS = {
    'Full body': {
      split: 'Full body',
      description: '3 sessions/week, every major muscle group each time — great default for beginners.',
      days: [
        { day: 'Day A', focus: 'Full body', exercises: [{ name: 'Squat', sets: 3, reps: '5-8' }, { name: 'Bench Press', sets: 3, reps: '5-8' }, { name: 'Row', sets: 3, reps: '8-12' }, { name: 'Plank', sets: 3, reps: '30-45s' }] },
        { day: 'Day B', focus: 'Full body', exercises: [{ name: 'Deadlift', sets: 3, reps: '5-6' }, { name: 'Overhead Press', sets: 3, reps: '6-10' }, { name: 'Pull-up', sets: 3, reps: '6-10' }, { name: 'Lunge', sets: 3, reps: '10-12' }] },
        { day: 'Day C', focus: 'Full body', exercises: [{ name: 'Squat', sets: 3, reps: '8-10' }, { name: 'Push-up', sets: 3, reps: '10-15' }, { name: 'Row', sets: 3, reps: '10-12' }, { name: 'Plank', sets: 3, reps: '30-45s' }] },
      ],
    },
    'Upper / lower': {
      split: 'Upper / lower',
      description: '4 sessions/week alternating upper and lower body.',
      days: [
        { day: 'Upper A', focus: 'Upper body', exercises: [{ name: 'Bench Press', sets: 4, reps: '6-8' }, { name: 'Row', sets: 4, reps: '8-10' }, { name: 'Overhead Press', sets: 3, reps: '8-10' }, { name: 'Pull-up', sets: 3, reps: '6-10' }] },
        { day: 'Lower A', focus: 'Lower body', exercises: [{ name: 'Squat', sets: 4, reps: '5-8' }, { name: 'Deadlift', sets: 3, reps: '5-6' }, { name: 'Lunge', sets: 3, reps: '10-12' }, { name: 'Plank', sets: 3, reps: '30-45s' }] },
        { day: 'Upper B', focus: 'Upper body', exercises: [{ name: 'Overhead Press', sets: 4, reps: '6-8' }, { name: 'Pull-up', sets: 4, reps: '6-10' }, { name: 'Bench Press', sets: 3, reps: '8-10' }, { name: 'Row', sets: 3, reps: '10-12' }] },
        { day: 'Lower B', focus: 'Lower body', exercises: [{ name: 'Deadlift', sets: 4, reps: '5-6' }, { name: 'Squat', sets: 3, reps: '8-10' }, { name: 'Lunge', sets: 3, reps: '10-12' }] },
      ],
    },
    'Push / pull / legs': {
      split: 'Push / pull / legs',
      description: '3-6 sessions/week rotating push, pull, and legs.',
      days: [
        { day: 'Push', focus: 'Chest, shoulders, triceps', exercises: [{ name: 'Bench Press', sets: 4, reps: '6-10' }, { name: 'Overhead Press', sets: 3, reps: '8-10' }, { name: 'Push-up', sets: 3, reps: '10-15' }] },
        { day: 'Pull', focus: 'Back, biceps', exercises: [{ name: 'Deadlift', sets: 3, reps: '5-6' }, { name: 'Row', sets: 4, reps: '8-10' }, { name: 'Pull-up', sets: 3, reps: '6-10' }] },
        { day: 'Legs', focus: 'Quads, hamstrings, glutes', exercises: [{ name: 'Squat', sets: 4, reps: '6-8' }, { name: 'Lunge', sets: 3, reps: '10-12' }, { name: 'Plank', sets: 3, reps: '30-45s' }] },
      ],
    },
    Powerlifting: {
      split: 'Powerlifting',
      description: '4 sessions/week built around the big three + accessories.',
      days: [
        { day: 'Squat day', focus: 'Squat-focused', exercises: [{ name: 'Squat', sets: 5, reps: '3-5' }, { name: 'Lunge', sets: 3, reps: '8-10' }, { name: 'Plank', sets: 3, reps: '45-60s' }] },
        { day: 'Bench day', focus: 'Bench-focused', exercises: [{ name: 'Bench Press', sets: 5, reps: '3-5' }, { name: 'Overhead Press', sets: 3, reps: '6-8' }, { name: 'Row', sets: 3, reps: '8-10' }] },
        { day: 'Deadlift day', focus: 'Deadlift-focused', exercises: [{ name: 'Deadlift', sets: 5, reps: '3-5' }, { name: 'Row', sets: 3, reps: '8-10' }, { name: 'Pull-up', sets: 3, reps: '6-10' }] },
        { day: 'Accessory day', focus: 'Light technique + accessories', exercises: [{ name: 'Squat', sets: 3, reps: '8-10' }, { name: 'Bench Press', sets: 3, reps: '8-10' }, { name: 'Push-up', sets: 3, reps: '10-15' }] },
      ],
    },
    'Running strength': {
      split: 'Running strength',
      description: '2-3 sessions/week — durability and injury prevention, not hypertrophy.',
      days: [
        { day: 'Day A', focus: 'Posterior chain + core', exercises: [{ name: 'Deadlift', sets: 3, reps: '6-8' }, { name: 'Lunge', sets: 3, reps: '10-12' }, { name: 'Plank', sets: 3, reps: '45-60s' }] },
        { day: 'Day B', focus: 'Upper body + core', exercises: [{ name: 'Push-up', sets: 3, reps: '10-15' }, { name: 'Row', sets: 3, reps: '10-12' }, { name: 'Plank', sets: 3, reps: '45-60s' }] },
      ],
    },
  };
  const AVAILABLE_SPLITS = Object.keys(PROGRAMS);
  function programFor(split) { return PROGRAMS[split] || PROGRAMS['Full body']; }

  // ── Stats / PR math (ported from src/lib/activities/stats.ts + src/lib/strength/prs.ts) ──
  function dayKey(iso) { const d = new Date(iso); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  function currentStreak(activities) {
    if (!activities.length) return 0;
    const days = new Set(activities.map((a) => dayKey(a.occurredAt)));
    const today = new Date();
    const cursor = new Date(today);
    if (!days.has(dayKey(cursor.toISOString()))) {
      cursor.setDate(cursor.getDate() - 1);
      if (!days.has(dayKey(cursor.toISOString()))) return 0;
    }
    let streak = 0;
    while (days.has(dayKey(cursor.toISOString()))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    return streak;
  }
  function estOneRepMax(weightLb, reps) { return weightLb * (1 + reps / 30); }
  function exerciseKey(name) { return String(name || '').trim().toLowerCase(); }
  function computeBests(activities) {
    const bests = new Map();
    for (const a of activities) {
      if (a.type !== 'strength') continue;
      for (const s of a.sets) {
        if (!s.weight_lb || !s.reps) continue;
        const estOneRm = estOneRepMax(s.weight_lb, s.reps);
        const k = exerciseKey(s.exercise);
        const prior = bests.get(k);
        if (!prior || estOneRm > prior.estOneRm) bests.set(k, { exercise: s.exercise, estOneRm, weightLb: s.weight_lb, reps: s.reps });
      }
    }
    return bests;
  }
  function findNewPRs(priorActivities, newSets) {
    const bests = computeBests(priorActivities);
    const bestInBatch = new Map();
    for (const s of newSets) {
      const weightLb = Number(s.weightLb);
      const reps = Number(s.reps);
      if (!String(s.exercise || '').trim() || !weightLb || !reps) continue;
      const estOneRm = estOneRepMax(weightLb, reps);
      const k = exerciseKey(s.exercise);
      const prior = bests.get(k);
      const seenThisBatch = bestInBatch.get(k);
      if ((!prior || estOneRm > prior.estOneRm) && (!seenThisBatch || estOneRm > seenThisBatch.estOneRm)) {
        bestInBatch.set(k, { exercise: String(s.exercise).trim(), estOneRm, weightLb, reps });
      }
    }
    return Array.from(bestInBatch.values());
  }

  // ── Supabase reads/writes (ported from src/lib/activities/api.ts + src/lib/onboarding/api.ts) ──
  function toNumberOrNull(value) {
    const s = String(value == null ? '' : value).trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  function toActivity(row) {
    return {
      id: row.id, type: row.type, title: row.title, notes: row.notes, occurredAt: row.occurred_at,
      distanceMi: row.distance_mi, durationSec: row.duration_sec, elevationFt: row.elevation_ft,
      effort: row.effort, sets: row.fit_strength_sets || [],
    };
  }
  async function listActivities(userId, limit) {
    const sb = fitClient();
    if (!sb) return [];
    const { data, error } = await sb.from('fit_activities')
      .select('id, type, title, notes, occurred_at, distance_mi, duration_sec, elevation_ft, effort, fit_strength_sets(exercise, weight_lb, reps)')
      .eq('user_id', userId).order('occurred_at', { ascending: false }).limit(limit || 30);
    if (error) throw error;
    return (data || []).map(toActivity);
  }
  async function logRun(userId, input) {
    const sb = fitClient();
    if (!sb) throw new Error('Account service unavailable.');
    const durationMin = toNumberOrNull(input.durationMin);
    const { error } = await sb.from('fit_activities').insert({
      user_id: userId, type: 'run', title: input.title || 'Run', notes: input.notes,
      occurred_at: input.occurredAt, distance_mi: toNumberOrNull(input.distanceMi),
      duration_sec: durationMin !== null ? Math.round(durationMin * 60) : null,
      elevation_ft: toNumberOrNull(input.elevationFt), effort: input.effort,
    });
    if (error) throw error;
  }
  async function logStrength(userId, input) {
    const sb = fitClient();
    if (!sb) throw new Error('Account service unavailable.');
    const { data: activity, error: activityError } = await sb.from('fit_activities').insert({
      user_id: userId, type: 'strength', title: input.title || 'Strength workout',
      notes: input.notes, occurred_at: input.occurredAt, effort: input.effort,
    }).select('id').single();
    if (activityError) throw activityError;
    const rows = input.sets.filter((s) => s.exercise.trim()).map((s, i) => ({
      activity_id: activity.id, user_id: userId, set_order: i, exercise: s.exercise.trim(),
      weight_lb: toNumberOrNull(s.weightLb), reps: toNumberOrNull(s.reps),
    }));
    if (rows.length) {
      const { error: setsError } = await sb.from('fit_strength_sets').insert(rows);
      if (setsError) throw setsError;
    }
  }
  async function getHumorEnabled(userId) {
    const sb = fitClient();
    if (!sb) return true;
    try {
      const { data } = await sb.from('fit_profiles').select('humor_enabled').eq('user_id', userId).maybeSingle();
      return data && typeof data.humor_enabled === 'boolean' ? data.humor_enabled : true;
    } catch { return true; }
  }
  async function getStrengthSplit(userId) {
    const sb = fitClient();
    if (!sb) return null;
    try {
      const { data } = await sb.from('fit_onboarding').select('strength').eq('user_id', userId).maybeSingle();
      const split = data && data.strength ? data.strength.split : null;
      return split && split !== 'None yet' ? split : null;
    } catch { return null; }
  }
  async function setStrengthSplit(userId, split) {
    const sb = fitClient();
    if (!sb) return;
    // Preserve any other keys already in the strength JSONB (e.g. from onboarding) —
    // only the split field is meant to change here.
    let existing = {};
    try {
      const { data } = await sb.from('fit_onboarding').select('strength').eq('user_id', userId).maybeSingle();
      existing = (data && data.strength) || {};
    } catch { /* table may not exist yet — insert fresh below */ }
    const { error } = await sb.from('fit_onboarding')
      .upsert({ user_id: userId, strength: Object.assign({}, existing, { split }) }, { onConflict: 'user_id' });
    if (error) throw error;
  }
  function awardActivityXp() {
    if (window.TrollrunnerAccounts && window.TrollrunnerAccounts.awardXp) {
      window.TrollrunnerAccounts.awardXp('game_run', 'fitness').catch(() => {});
    }
  }
  function awardPrXp(exercise) {
    if (window.TrollrunnerAccounts && window.TrollrunnerAccounts.awardXp) {
      window.TrollrunnerAccounts.awardXp('high_score', 'fitness-pr', { exercise }).catch(() => {});
    }
  }

  // ── Log tab ──
  const log = {};
  let logHumor = true;
  let logMode = 'run';
  let restInterval = null;

  function nowLocalIso() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function initLog() {
    log.signedOut = document.getElementById('logSignedOut');
    log.body = document.getElementById('logBody');
    log.signinBtn = document.getElementById('logSigninBtn');
    log.modeToggle = document.getElementById('logModeToggle');
    log.runForm = document.getElementById('runForm');
    log.strengthForm = document.getElementById('strengthForm');
    log.celebration = document.getElementById('celebration');
    if (!log.body) return;

    log.signinBtn.addEventListener('click', () => document.getElementById('btn-signin').click());
    document.getElementById('trainingSigninBtn').addEventListener('click', () => document.getElementById('btn-signin').click());

    log.modeToggle.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => setLogMode(btn.dataset.mode));
    });

    document.getElementById('runWhen').value = nowLocalIso();
    document.getElementById('strengthWhen').value = nowLocalIso();

    const distWrap = document.getElementById('runDistancePresets');
    RUN_DISTANCE_PRESETS.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = p.label;
      b.addEventListener('click', () => {
        document.getElementById('runDistance').value = p.value;
        distWrap.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === b));
      });
      distWrap.appendChild(b);
    });

    const exWrap = document.getElementById('strengthExercisePresets');
    STRENGTH_EXERCISE_PRESETS.forEach((name) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = '+ ' + name;
      b.addEventListener('click', () => addSet(name));
      exWrap.appendChild(b);
    });

    document.getElementById('strengthAddSet').addEventListener('click', () => addSet(''));

    wireEffortSlider('runEffort', 'runEffortEmoji', 'runEffortLabel');
    wireEffortSlider('strengthEffort', 'strengthEffortEmoji', 'strengthEffortLabel');
    initRestTimer();

    log.runForm.addEventListener('submit', handleRunSubmit);
    log.strengthForm.addEventListener('submit', handleStrengthSubmit);

    renderSets([{ exercise: '', weightLb: '', reps: '' }]);
  }

  function setLogMode(mode) {
    logMode = mode;
    log.modeToggle.querySelectorAll('.mode-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    log.runForm.hidden = mode !== 'run';
    log.strengthForm.hidden = mode !== 'strength';
    log.celebration.hidden = true;
    log.runForm.style.display = mode === 'run' ? 'flex' : 'none';
    log.strengthForm.style.display = mode === 'strength' ? 'flex' : 'none';
  }

  function wireEffortSlider(inputId, emojiId, labelId) {
    const input = document.getElementById(inputId);
    const emoji = document.getElementById(emojiId);
    const label = document.getElementById(labelId);
    input.dataset.touched = 'false';
    input.value = 5;
    function render() {
      const touched = input.dataset.touched === 'true';
      const level = effortLevelFor(Number(input.value));
      emoji.textContent = touched ? level.emoji : '🤔';
      label.textContent = touched ? level.label : '';
    }
    input.addEventListener('input', () => { input.dataset.touched = 'true'; render(); });
    render();
  }
  function effortValue(inputId) {
    const input = document.getElementById(inputId);
    return input.dataset.touched === 'true' ? Number(input.value) : null;
  }
  function resetEffortSlider(inputId, emojiId, labelId) {
    const input = document.getElementById(inputId);
    input.value = 5; input.dataset.touched = 'false';
    wireEffortSliderRender(inputId, emojiId, labelId);
  }
  function wireEffortSliderRender(inputId, emojiId, labelId) {
    document.getElementById(emojiId).textContent = '🤔';
    document.getElementById(labelId).textContent = '';
  }

  const REST_PRESETS = [60, 90, 120, 180];
  function initRestTimer() {
    const presetsWrap = document.getElementById('restTimerPresets');
    REST_PRESETS.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = s + 's';
      b.addEventListener('click', () => startRestTimer(s));
      presetsWrap.appendChild(b);
    });
    document.getElementById('restTimerCancel').addEventListener('click', stopRestTimer);
  }
  function startRestTimer(seconds) {
    stopRestTimer();
    let remaining = seconds;
    document.getElementById('restTimerPresets').hidden = true;
    const active = document.getElementById('restTimerActive');
    const ring = document.getElementById('restTimerRing');
    const text = document.getElementById('restTimerText');
    active.hidden = false;
    function paint(done) {
      ring.textContent = done ? '🔔' : String(remaining);
      text.textContent = done ? "Rest's over — go again." : ('Resting… ' + remaining + 's left');
      text.classList.toggle('is-done', done);
    }
    paint(false);
    restInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) { clearInterval(restInterval); restInterval = null; paint(true); return; }
      paint(false);
    }, 1000);
  }
  function stopRestTimer() {
    if (restInterval) { clearInterval(restInterval); restInterval = null; }
    document.getElementById('restTimerPresets').hidden = false;
    document.getElementById('restTimerActive').hidden = true;
  }

  function renderSets(sets) {
    const wrap = document.getElementById('strengthSets');
    wrap.innerHTML = '';
    sets.forEach((s, i) => addSetRow(s.exercise, s.weightLb, s.reps));
  }
  function addSetRow(exercise, weightLb, reps) {
    const wrap = document.getElementById('strengthSets');
    const isFirst = wrap.children.length === 0;
    const row = document.createElement('div');
    row.className = 'set-row';
    row.innerHTML =
      '<div class="fit-field">' + (isFirst ? '<label>Exercise</label>' : '') + '<input class="fit-input set-exercise" type="text"></div>' +
      '<div class="fit-field">' + (isFirst ? '<label>Weight (lb)</label>' : '') + '<input class="fit-input set-weight" type="number" step="0.5" inputmode="decimal"></div>' +
      '<div class="fit-field">' + (isFirst ? '<label>Reps</label>' : '') + '<input class="fit-input set-reps" type="number" step="1" inputmode="numeric"></div>' +
      '<button type="button" class="set-remove" aria-label="Remove this set">✕</button>';
    row.querySelector('.set-exercise').value = exercise || '';
    row.querySelector('.set-weight').value = weightLb || '';
    row.querySelector('.set-reps').value = reps || '';
    row.querySelector('.set-remove').addEventListener('click', () => {
      row.remove();
      if (!wrap.children.length) addSetRow('', '', '');
      relabelFirstSetRow();
    });
    wrap.appendChild(row);
  }
  function relabelFirstSetRow() {
    const wrap = document.getElementById('strengthSets');
    Array.from(wrap.children).forEach((row, i) => {
      const fields = row.querySelectorAll('.fit-field');
      const labels = ['Exercise', 'Weight (lb)', 'Reps'];
      fields.forEach((f, j) => {
        let label = f.querySelector('label');
        if (i === 0 && !label) { label = document.createElement('label'); label.textContent = labels[j]; f.insertBefore(label, f.firstChild); }
        else if (i !== 0 && label) { label.remove(); }
      });
    });
  }
  function addSet(exercise) {
    // Blank leftover row (still empty) gets reused instead of stacking dupes.
    const wrap = document.getElementById('strengthSets');
    const last = wrap.lastElementChild;
    if (last && !last.querySelector('.set-exercise').value.trim() && !exercise) { return; }
    addSetRow(exercise || '', '', '');
    relabelFirstSetRow();
  }
  function readSets() {
    return Array.from(document.getElementById('strengthSets').children).map((row) => ({
      exercise: row.querySelector('.set-exercise').value,
      weightLb: row.querySelector('.set-weight').value,
      reps: row.querySelector('.set-reps').value,
    }));
  }

  function setBusy(formPrefix, busy) {
    document.getElementById(formPrefix + 'Submit').disabled = busy;
    document.getElementById(formPrefix + 'Submit').textContent = busy
      ? 'Saving…'
      : (formPrefix === 'run' ? 'Save run' : 'Save workout');
  }
  function showFormError(id, message) {
    const el = document.getElementById(id);
    if (!message) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false; el.textContent = message;
  }

  async function handleRunSubmit(e) {
    e.preventDefault();
    const user = fitUser();
    if (!user) return;
    setBusy('run', true);
    showFormError('runError', '');
    try {
      await logRun(user.userId, {
        title: document.getElementById('runTitle').value,
        occurredAt: new Date(document.getElementById('runWhen').value).toISOString(),
        distanceMi: document.getElementById('runDistance').value,
        durationMin: document.getElementById('runDuration').value,
        elevationFt: document.getElementById('runElevation').value,
        effort: effortValue('runEffort'),
        notes: document.getElementById('runNotes').value,
      });
      await afterSave(user.userId, [], null);
    } catch (err) {
      showFormError('runError', (err && err.message) ? err.message : 'Could not save the run. Have the fit_activities tables been created yet?');
    } finally {
      setBusy('run', false);
    }
  }

  async function handleStrengthSubmit(e) {
    e.preventDefault();
    const user = fitUser();
    if (!user) return;
    setBusy('strength', true);
    showFormError('strengthError', '');
    try {
      const sets = readSets();
      const priorActivities = await listActivities(user.userId, 200);
      await logStrength(user.userId, {
        title: document.getElementById('strengthTitle').value,
        occurredAt: new Date(document.getElementById('strengthWhen').value).toISOString(),
        effort: effortValue('strengthEffort'),
        notes: document.getElementById('strengthNotes').value,
        sets,
      });
      await afterSave(user.userId, priorActivities, sets);
    } catch (err) {
      showFormError('strengthError', (err && err.message) ? err.message : 'Could not save the workout. Have the fit_activities tables been created yet?');
    } finally {
      setBusy('strength', false);
    }
  }

  async function afterSave(userId, priorActivities, loggedSets) {
    let streak = 0;
    try {
      const rows = await listActivities(userId, 30);
      streak = currentStreak(rows);
    } catch { /* streak just won't show if the tables aren't set up yet */ }
    awardActivityXp();
    let prs = [];
    if (loggedSets) {
      prs = findNewPRs(priorActivities, loggedSets);
      prs.forEach((pr) => awardPrXp(pr.exercise));
    }
    showCelebration(streak, prs);
  }

  function showCelebration(streak, prs) {
    log.runForm.style.display = 'none';
    log.strengthForm.style.display = 'none';
    const isMilestone = STREAK_MILESTONES.indexOf(streak) !== -1;
    const message = logHumor ? pickOne(CELEBRATION_MESSAGES) : 'Activity logged.';
    const emoji = logHumor ? '🎉' : '✅';
    let html = '<p class="cele-emoji" aria-hidden="true">' + emoji + '</p>' +
      '<p class="cele-msg">' + escapeHtml(message) + '</p>';
    if (streak > 1) {
      const streakMsg = isMilestone
        ? (logHumor ? '🔥 ' + streak + '-day streak — genuinely impressive.' : streak + '-day streak milestone reached.')
        : ('🔥 ' + streak + '-day streak — keep it up.');
      html += '<p class="cele-streak">' + escapeHtml(streakMsg) + '</p>';
    }
    if (prs.length) {
      html += '<div class="pr-box"><p class="pr-title">🏆 New PR' + (prs.length > 1 ? 's' : '') + '</p>' +
        prs.map((pr) => '<p>' + escapeHtml(pr.exercise) + ' — ' + escapeHtml(String(pr.weightLb)) + ' lb × ' + escapeHtml(String(pr.reps)) + '</p>').join('') +
        '</div>';
    }
    html += '<button type="button" class="fit-btn fit-btn-primary" id="celeDone" style="max-width:220px;">Log another</button>';
    log.celebration.innerHTML = html;
    log.celebration.hidden = false;
    document.getElementById('celeDone').addEventListener('click', resetLogForms);
  }

  function resetLogForms() {
    log.celebration.hidden = true;
    document.getElementById('runForm').reset();
    document.getElementById('strengthForm').reset();
    document.getElementById('runWhen').value = nowLocalIso();
    document.getElementById('strengthWhen').value = nowLocalIso();
    document.getElementById('runTitle').value = 'Run';
    document.getElementById('strengthTitle').value = 'Strength workout';
    document.getElementById('runDistancePresets').querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
    resetEffortSlider('runEffort', 'runEffortEmoji', 'runEffortLabel');
    resetEffortSlider('strengthEffort', 'strengthEffortEmoji', 'strengthEffortLabel');
    stopRestTimer();
    renderSets([{ exercise: '', weightLb: '', reps: '' }]);
    setLogMode(logMode);
  }

  /** Called from Training's "start this workout" — jumps to Log, strength mode, prefilled. */
  function prefillStrengthFromDay(splitName, dayIndex) {
    const program = programFor(splitName);
    const day = program.days[dayIndex];
    if (!day) return;
    document.getElementById('strengthTitle').value = day.day + ' — ' + program.split;
    const sets = day.exercises.map((ex) => ({ exercise: ex.name, weightLb: '', reps: '' }));
    renderSets(sets);
    setLogMode('strength');
    const tab = document.querySelector('.tab[data-tab="log"]');
    if (tab) tab.click();
  }

  async function refreshLog() {
    const user = fitUser();
    if (!log.body) return;
    if (!user) {
      log.signedOut.hidden = false;
      log.body.hidden = true;
      return;
    }
    log.signedOut.hidden = true;
    log.body.hidden = false;
    try { logHumor = await getHumorEnabled(user.userId); } catch { logHumor = true; }
  }

  // ── Training tab ──
  const training = {};
  let trainingSplit = null;

  function initTraining() {
    training.signedOut = document.getElementById('trainingSignedOut');
    training.body = document.getElementById('trainingBody');
    if (!training.body) return;
    document.getElementById('splitChips').innerHTML = '';
    AVAILABLE_SPLITS.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = s;
      b.addEventListener('click', () => chooseSplit(s));
      document.getElementById('splitChips').appendChild(b);
    });
  }

  async function chooseSplit(split) {
    trainingSplit = split;
    renderTraining(true);
    const user = fitUser();
    if (user) { try { await setStrengthSplit(user.userId, split); } catch { /* best-effort persist */ } }
  }

  function renderTraining(loaded) {
    const program = programFor(trainingSplit);
    document.getElementById('programName').textContent = program.split;
    document.getElementById('programDesc').textContent = program.description;
    const flag = document.getElementById('trainingFlag');
    flag.hidden = !(loaded && !trainingSplit);

    document.getElementById('splitChips').querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('is-active', c.textContent === program.split);
      c.setAttribute('aria-pressed', String(c.textContent === program.split));
    });

    const grid = document.getElementById('dayGrid');
    grid.innerHTML = '';
    program.days.forEach((day, i) => {
      const card = document.createElement('div');
      card.className = 'day-card';
      card.innerHTML =
        '<div class="day-card-head"><h3></h3><span></span></div>' +
        '<ul></ul>' +
        '<button type="button" class="day-start-btn">Start this workout →</button>';
      card.querySelector('h3').textContent = day.day;
      card.querySelector('span').textContent = day.focus;
      const ul = card.querySelector('ul');
      day.exercises.forEach((ex) => {
        const li = document.createElement('li');
        li.textContent = ex.name + ' — ' + ex.sets + ' × ' + ex.reps;
        ul.appendChild(li);
      });
      card.querySelector('.day-start-btn').addEventListener('click', () => prefillStrengthFromDay(program.split, i));
      grid.appendChild(card);
    });
  }

  async function refreshTraining() {
    const user = fitUser();
    if (!training.body) return;
    if (!user) {
      training.signedOut.hidden = false;
      training.body.hidden = true;
      return;
    }
    training.signedOut.hidden = true;
    training.body.hidden = false;
    renderTraining(false);
    try {
      trainingSplit = await getStrengthSplit(user.userId);
    } catch { trainingSplit = null; }
    renderTraining(true);
  }

  /* ==========================================================================
     HOME (Phase 3) — ported from src/app/home-client.tsx + src/lib/coach/
     training-load.ts + plan.ts, src/lib/recovery/*, src/lib/social/* and
     src/lib/activities/trends.ts + stats.ts + the ActivityCard/
     FriendActivityCard render helpers. Same rules as Log/Training above: no
     new Supabase client, fitClient()/fitUser() only, awardActivityXp() (the
     one already defined above for Log) reused for recovery check-ins too —
     the original app awards the SAME "game_run" XP event for a check-in,
     so no new XP wiring needed here.

     Scope notes (all tables below already exist per fit_schema.sql, having
     been run against the shared project — empty rows are the normal case
     for a user who hasn't onboarded/followed anyone yet, not a failure):
       - Onboarding wizard hasn't been ported yet, so getOnboardingWeeklyMileage
         fails soft to 0 and generateWeekPlan falls back to a generic 10mi/wk
         baseline — see baseline fallback in generateWeekPlan().
       - Social (follow/unfollow, find-people) hasn't been ported yet either,
         so getFriendsFeed will legitimately return [] for everyone right now.
         The query/render path is still real (same tables, same joins) so it
         lights up the moment a later phase ships the follow UI.
       - Weekly trend is a lightweight canvas sparkline, not the original's
         full two-chart TrendChart component — that's explicitly Phase 6
         (Analytics) territory per the project plan.
       ========================================================================== */

  const home = {};
  let homeState = null;
  let homeRecoveryEditing = false;

  const GOAL_DISTANCE_MI = {
    'Run first 5K': 3.107,
    'Run first half marathon': 13.109,
    'Run first marathon': 26.219,
    'Boston qualifier': 26.219,
    'Sub-3 marathon': 26.219,
    'Ultra marathon': 31,
  };
  function todayDayLabel() { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()]; }

  // ── Training load (ported from src/lib/coach/training-load.ts) ──
  function sessionDurationMin(a) {
    if (a.durationSec) return a.durationSec / 60;
    if (a.type === 'strength' && a.sets.length) return a.sets.length * 4;
    return 0;
  }
  function sessionLoad(a) { return sessionDurationMin(a) * (a.effort == null ? 5 : a.effort); }
  function loadDayKey(iso) { const d = new Date(iso); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 10); }
  function dailyLoadSeries(activities, days, asOf) {
    const byDay = new Map();
    activities.forEach((a) => { const k = loadDayKey(a.occurredAt); byDay.set(k, (byDay.get(k) || 0) + sessionLoad(a)); });
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(asOf); d.setDate(d.getDate() - i);
      series.push(byDay.get(loadDayKey(d.toISOString())) || 0);
    }
    return series;
  }
  function ewma(series, timeConstantDays) {
    const alpha = 1 / timeConstantDays;
    let value = 0;
    series.forEach((load) => { value = value + (load - value) * alpha; });
    return value;
  }
  function computeTrainingLoad(activities, asOf) {
    asOf = asOf || new Date();
    const series = dailyLoadSeries(activities, 42, asOf);
    const ctl = ewma(series, 42);
    const atl = ewma(series.slice(-14), 7);
    const tsb = ctl - atl;
    const acwr = ctl > 0 ? atl / ctl : 0;
    return { ctl: Math.round(ctl * 10) / 10, atl: Math.round(atl * 10) / 10, tsb: Math.round(tsb * 10) / 10, acwr: Math.round(acwr * 100) / 100 };
  }
  function interpretLoad(load) {
    if (load.ctl === 0) return { label: 'No data yet', why: 'Log a few workouts to start building a fitness trend.' };
    if (load.acwr > 1.5) return { label: 'Overreaching', why: 'Your recent load is ' + load.acwr + 'x your chronic average — the ACWR "danger zone" (>1.5) linked to higher injury risk. Consider an easier week.' };
    if (load.acwr > 1.3) return { label: 'Ramping up fast', why: 'Load is rising quickly (ACWR ' + load.acwr + '). Fine short-term, but don’t stack another big week on top of it.' };
    if (load.tsb < -20) return { label: 'Fatigued', why: 'Form (TSB) is deeply negative — you’re carrying a lot of fatigue relative to fitness.' };
    if (load.tsb > 10) return { label: 'Fresh', why: 'Form (TSB) is positive — good window for a hard effort or race.' };
    return { label: 'On track', why: 'Fitness and fatigue are balanced — steady, sustainable training load.' };
  }

  // ── Weekly plan generator (ported from src/lib/coach/plan.ts) ──
  const PHASE_MULTIPLIER = { base: 1.0, build: 1.15, peak: 1.25, taper: 0.55 };
  function phaseFor(weeksUntilGoal) {
    if (weeksUntilGoal === null) return { phase: 'base', why: 'No target date set — building general aerobic fitness.' };
    if (weeksUntilGoal <= 2) return { phase: 'taper', why: weeksUntilGoal + ' week(s) out — cutting volume so you show up fresh.' };
    if (weeksUntilGoal <= 5) return { phase: 'peak', why: weeksUntilGoal + ' weeks out — highest-volume, race-specific block.' };
    if (weeksUntilGoal <= 10) return { phase: 'build', why: weeksUntilGoal + ' weeks out — adding tempo and interval work on top of base mileage.' };
    return { phase: 'base', why: weeksUntilGoal + ' weeks out — plenty of time, building aerobic base first.' };
  }
  function dayPlansFor(phase, targetMileage) {
    const longRun = Math.round(targetMileage * 0.35 * 10) / 10;
    const remaining = Math.max(targetMileage - longRun, 0);
    const easy = Math.round((remaining / 2) * 10) / 10;
    if (phase === 'taper') return [
      { day: 'Mon', type: 'Rest', detail: 'Full rest.' },
      { day: 'Tue', type: 'Easy', detail: easy + ' mi easy.' },
      { day: 'Wed', type: 'Strides', detail: '20-30 min easy + 4-6 strides.' },
      { day: 'Thu', type: 'Rest', detail: 'Full rest.' },
      { day: 'Fri', type: 'Shakeout', detail: '2-3 mi very easy.' },
      { day: 'Sat', type: 'Rest', detail: 'Full rest — save it for race day.' },
      { day: 'Sun', type: 'Race / long run', detail: longRun + ' mi at goal effort.' },
    ];
    if (phase === 'peak') return [
      { day: 'Mon', type: 'Rest', detail: 'Full rest or cross-train.' },
      { day: 'Tue', type: 'Race-pace intervals', detail: '6-8 x 800m at goal race pace.' },
      { day: 'Wed', type: 'Easy', detail: easy + ' mi easy.' },
      { day: 'Thu', type: 'Tempo', detail: '3-5 mi at comfortably hard effort.' },
      { day: 'Fri', type: 'Rest', detail: 'Full rest.' },
      { day: 'Sat', type: 'Long run', detail: longRun + ' mi, last few at goal pace.' },
      { day: 'Sun', type: 'Easy', detail: easy + ' mi recovery.' },
    ];
    if (phase === 'build') return [
      { day: 'Mon', type: 'Rest', detail: 'Full rest or cross-train.' },
      { day: 'Tue', type: 'Tempo', detail: '3-4 mi comfortably hard.' },
      { day: 'Wed', type: 'Easy', detail: easy + ' mi easy.' },
      { day: 'Thu', type: 'Intervals', detail: '5-6 x 3 min hard, 2 min jog.' },
      { day: 'Fri', type: 'Rest', detail: 'Full rest.' },
      { day: 'Sat', type: 'Long run', detail: longRun + ' mi easy pace.' },
      { day: 'Sun', type: 'Easy', detail: easy + ' mi recovery.' },
    ];
    return [
      { day: 'Mon', type: 'Rest', detail: 'Full rest or cross-train.' },
      { day: 'Tue', type: 'Easy', detail: easy + ' mi easy.' },
      { day: 'Wed', type: 'Strength', detail: 'Full-body strength session.' },
      { day: 'Thu', type: 'Easy', detail: easy + ' mi easy.' },
      { day: 'Fri', type: 'Rest', detail: 'Full rest.' },
      { day: 'Sat', type: 'Long run', detail: longRun + ' mi conversational pace.' },
      { day: 'Sun', type: 'Easy', detail: (easy || 2) + ' mi recovery or cross-train.' },
    ];
  }
  function generateWeekPlan(opts) {
    const targetDate = opts.targetDate;
    const recoveryMultiplier = opts.recoveryMultiplier == null ? 1 : opts.recoveryMultiplier;
    const weeksUntilGoal = targetDate
      ? Math.max(1, Math.ceil((new Date(targetDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
      : null;
    const p = phaseFor(weeksUntilGoal);
    // No onboarding baseline yet (wizard not ported) falls back to a generic 10mi/wk plan.
    const baseline = opts.baselineWeeklyMileage > 0 ? opts.baselineWeeklyMileage : 10;
    const targetMileage = Math.round(baseline * PHASE_MULTIPLIER[p.phase] * recoveryMultiplier * 10) / 10;
    const recoveryNote = recoveryMultiplier < 1
      ? ('Trimmed ' + Math.round((1 - recoveryMultiplier) * 100) + '% for recent low recovery scores.')
      : null;
    return { phase: p.phase, phaseWhy: p.why, targetMileage, weeksUntilGoal, goalLabel: opts.goalLabel, days: dayPlansFor(p.phase, targetMileage), recoveryNote };
  }

  // ── Recovery score (ported from src/lib/recovery/score.ts) ──
  function recoveryScoreFor(log) {
    if (log.sleepHours == null && log.soreness == null && log.stress == null) return null;
    const sleepScore = log.sleepHours != null ? Math.min(log.sleepHours / 8, 1) * 40 : 30;
    const sorenessScore = log.soreness != null ? ((6 - log.soreness) / 5) * 30 : 22;
    const stressScore = log.stress != null ? ((6 - log.stress) / 5) * 30 : 22;
    return Math.round(sleepScore + sorenessScore + stressScore);
  }
  function interpretRecoveryScore(score) {
    if (score === null) return { label: 'No check-in' };
    if (score >= 80) return { label: 'Great' };
    if (score >= 60) return { label: 'Good' };
    if (score >= 40) return { label: 'Fair' };
    return { label: 'Poor' };
  }
  function averageRecentScore(logs, days) {
    days = days || 7;
    const scored = logs.slice(0, days).map(recoveryScoreFor).filter((s) => s !== null);
    if (!scored.length) return null;
    return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
  }
  function recoveryLoadMultiplier(avgScore) {
    if (avgScore === null) return 1;
    if (avgScore < 40) return 0.7;
    if (avgScore < 60) return 0.85;
    return 1;
  }

  // ── Stats / trends (ported from src/lib/activities/stats.ts + trends.ts) ──
  function homeStartOfWeek(now) {
    now = now || new Date();
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }
  function weeklyMileage(activities) {
    const start = homeStartOfWeek();
    return activities.filter((a) => a.type === 'run' && new Date(a.occurredAt) >= start).reduce((s, a) => s + (a.distanceMi || 0), 0);
  }
  function weeklyTrend(activities, weeks) {
    weeks = weeks || 8;
    const thisWeekStart = homeStartOfWeek();
    const buckets = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date(thisWeekStart); weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
      const inWeek = activities.filter((a) => { const t = new Date(a.occurredAt); return t >= weekStart && t < weekEnd; });
      const mileage = inWeek.filter((a) => a.type === 'run').reduce((s, a) => s + (a.distanceMi || 0), 0);
      // volume (lb x reps) added for Phase 6's weekly-strength-volume chart — ported
      // from the original's src/lib/activities/trends.ts weeklyTrend() 1:1.
      const volume = inWeek.filter((a) => a.type === 'strength')
        .reduce((s, a) => s + a.sets.reduce((ss, set) => ss + (set.weight_lb || 0) * (set.reps || 0), 0), 0);
      buckets.push({
        label: weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        mileage: Math.round(mileage * 10) / 10, volume: Math.round(volume),
      });
    }
    return buckets;
  }
  function monthSummary(activities) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const inMonth = activities.filter((a) => new Date(a.occurredAt) >= monthStart);
    const runs = inMonth.filter((a) => a.type === 'run');
    const strength = inMonth.filter((a) => a.type === 'strength');
    return {
      totalMileage: Math.round(runs.reduce((s, a) => s + (a.distanceMi || 0), 0) * 10) / 10,
      runCount: runs.length, strengthCount: strength.length, totalActivities: inMonth.length,
    };
  }

  // ── Activity display helpers (ported from components/activities/activity-card.tsx) ──
  const HOME_EFFORT_EMOJI = { 1: '😴', 2: '😴', 3: '🙂', 4: '🙂', 5: '😅', 6: '😅', 7: '😤', 8: '😤', 9: '🥵', 10: '🥵' };
  function formatPace(distanceMi, durationSec) {
    if (!distanceMi || !durationSec) return null;
    const secPerMi = durationSec / distanceMi;
    const min = Math.floor(secPerMi / 60), sec = Math.round(secPerMi % 60);
    return min + ':' + String(sec).padStart(2, '0') + '/mi';
  }
  function formatDurationMin(durationSec) { return durationSec ? Math.round(durationSec / 60) + ' min' : null; }
  function topSet(activity) {
    if (!activity.sets.length) return null;
    const best = activity.sets.reduce((a, b) => (a.weight_lb || 0) * (a.reps || 0) > (b.weight_lb || 0) * (b.reps || 0) ? a : b);
    if (!best.weight_lb && !best.reps) return null;
    return best.exercise + ' · ' + (best.weight_lb == null ? '—' : best.weight_lb) + ' lb × ' + (best.reps == null ? '—' : best.reps);
  }
  function activityIconFor(a) { return a.type === 'run' ? '🏃' : a.type === 'strength' ? '🏋️' : '⭐'; }
  function activityStatsFor(a) {
    const stats = [];
    if (a.type === 'run') {
      if (a.distanceMi) stats.push(a.distanceMi.toFixed(1) + ' mi');
      const dur = formatDurationMin(a.durationSec); if (dur) stats.push(dur);
      const pace = formatPace(a.distanceMi, a.durationSec); if (pace) stats.push(pace);
      if (a.elevationFt) stats.push(a.elevationFt + ' ft gain');
    } else if (a.type === 'strength') {
      stats.push(a.sets.length + ' set' + (a.sets.length === 1 ? '' : 's'));
      const top = topSet(a); if (top) stats.push(top);
    }
    return stats;
  }
  function activityWhenFor(a) { return new Date(a.occurredAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }

  // ── Supabase reads (ported from src/lib/coach/profile.ts, recovery/api.ts,
  //    social/follows.ts + feed.ts + kudos.ts). Every function fails soft —
  //    same pattern as getStrengthSplit/getHumorEnabled above. ──
  async function getGoals(userId) {
    const sb = fitClient(); if (!sb) return [];
    try {
      const { data, error } = await sb.from('fit_goals').select('goal_key, target_date').eq('user_id', userId);
      if (error) throw error;
      return data || [];
    } catch { return []; }
  }
  function primaryRaceGoal(goals) { return goals.find((g) => g.goal_key in GOAL_DISTANCE_MI) || null; }
  async function getOnboardingWeeklyMileage(userId) {
    const sb = fitClient(); if (!sb) return 0;
    try {
      const { data } = await sb.from('fit_onboarding').select('running').eq('user_id', userId).maybeSingle();
      const raw = data && data.running ? data.running.weeklyMileage : null;
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch { return 0; }
  }

  function homeTodayDate() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function toRecoveryLog(row) { return { logDate: row.log_date, sleepHours: row.sleep_hours, soreness: row.soreness, stress: row.stress, notes: row.notes }; }
  async function listRecentRecovery(userId, days) {
    days = days || 14;
    const sb = fitClient(); if (!sb) return [];
    try {
      const since = new Date(); since.setDate(since.getDate() - days);
      const { data, error } = await sb.from('fit_recovery_logs')
        .select('log_date, sleep_hours, soreness, stress, notes')
        .eq('user_id', userId).gte('log_date', since.toISOString().slice(0, 10))
        .order('log_date', { ascending: false });
      if (error) throw error;
      return (data || []).map(toRecoveryLog);
    } catch { return []; }
  }
  async function getTodayRecovery(userId) {
    const sb = fitClient(); if (!sb) return null;
    try {
      const { data } = await sb.from('fit_recovery_logs')
        .select('log_date, sleep_hours, soreness, stress, notes')
        .eq('user_id', userId).eq('log_date', homeTodayDate()).maybeSingle();
      return data ? toRecoveryLog(data) : null;
    } catch { return null; }
  }
  async function logRecovery(userId, input) {
    const sb = fitClient(); if (!sb) throw new Error('Account service unavailable.');
    const sleepHours = String(input.sleepHours || '').trim() ? Number(input.sleepHours) : null;
    const { error } = await sb.from('fit_recovery_logs').upsert({
      user_id: userId, log_date: homeTodayDate(),
      sleep_hours: Number.isFinite(sleepHours) ? sleepHours : null,
      soreness: input.soreness, stress: input.stress, notes: input.notes || '',
    }, { onConflict: 'user_id,log_date' });
    if (error) throw error;
  }

  async function listFollowingIds(userId) {
    const sb = fitClient(); if (!sb) return [];
    try {
      const { data, error } = await sb.from('fit_follows').select('followed_id').eq('follower_id', userId);
      if (error) throw error;
      return (data || []).map((r) => r.followed_id);
    } catch { return []; }
  }
  async function getFriendsFeed(userId, limit) {
    limit = limit || 20;
    const followingIds = await listFollowingIds(userId);
    if (!followingIds.length) return []; // normal today — follow UI hasn't shipped yet
    const sb = fitClient(); if (!sb) return [];
    try {
      const { data, error } = await sb.from('fit_activities')
        .select('id, user_id, type, title, notes, occurred_at, distance_mi, duration_sec, elevation_ft, effort, fit_strength_sets(exercise, weight_lb, reps)')
        .in('user_id', followingIds).eq('source', 'native').order('occurred_at', { ascending: false }).limit(limit);
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) return [];
      const ownerIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profiles } = await sb.from('troll_profiles').select('id, username, avatar_url').in('id', ownerIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, { id: p.id, username: p.username, avatarUrl: p.avatar_url }]));
      return rows.map((row) => Object.assign(toActivity(row), {
        owner: profileMap.get(row.user_id) || { id: row.user_id, username: 'runner', avatarUrl: null },
      }));
    } catch { return []; }
  }
  async function getKudosInfo(activityIds, currentUserId) {
    const map = new Map();
    if (!activityIds.length) return map;
    const sb = fitClient(); if (!sb) return map;
    try {
      const { data, error } = await sb.from('fit_kudos').select('activity_id, user_id').in('activity_id', activityIds);
      if (error) throw error;
      (data || []).forEach((row) => {
        const entry = map.get(row.activity_id) || { count: 0, givenByMe: false };
        entry.count += 1;
        if (row.user_id === currentUserId) entry.givenByMe = true;
        map.set(row.activity_id, entry);
      });
    } catch { /* kudos just won't show counts if this fails */ }
    return map;
  }
  async function giveKudos(activityId, userId) {
    const sb = fitClient(); if (!sb) return;
    const { error } = await sb.from('fit_kudos').insert({ activity_id: activityId, user_id: userId });
    if (error) throw error;
  }
  async function removeKudos(activityId, userId) {
    const sb = fitClient(); if (!sb) return;
    const { error } = await sb.from('fit_kudos').delete().eq('activity_id', activityId).eq('user_id', userId);
    if (error) throw error;
  }

  // ── Sparkline (lightweight stand-in for Phase 6's real charting) ──
  function drawSparkline(canvas, points) {
    if (!canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!points.length) return;
    const max = Math.max.apply(null, points.map((p) => p.mileage).concat([1]));
    const pad = 10;
    const stepX = (w - pad * 2) / Math.max(points.length - 1, 1);
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (p.mileage / max) * (h - pad * 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#ff5a1f';
    ctx.lineWidth = 2;
    ctx.stroke();
    points.forEach((p, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (p.mileage / max) * (h - pad * 2);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff5a1f';
      ctx.fill();
    });
  }

  /* ==========================================================================
     ANALYTICS CHARTS (Phase 6) — shared canvas chart helper for the You tab's
     real analytics section (ported from src/components/charts/trend-chart.tsx
     + analytics-section.tsx / weekly-trends.tsx). This is deliberately a
     SEPARATE, richer drawing path from drawSparkline() above: Home stays the
     lightweight glance-dashboard it already was (single accent-colored line,
     no legend, no gridlines, no resize plumbing beyond its own requestAnimation
     Frame redraw), while the denser gridlined/legended/resizable charts below
     live only inside #youAnalyticsCard, where a deep-dive is the point. Kept
     as one small shared module (fitChartSetupCanvas/drawBarChart/drawLineChart/
     fitChartObserve/appendChartTable) rather than copy-pasting per-chart draw
     code three times.
     ========================================================================== */

  function getCssVar(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch { return fallback; }
  }
  const FIT_CHART_COLORS = {
    accent: getCssVar('--fit-accent', '#ff5a1f'),
    green: getCssVar('--fit-green', '#34c759'),
    indigo: getCssVar('--fit-indigo', '#5856d6'),
  };
  function fitChartFont() {
    try { return getComputedStyle(document.body).fontFamily || 'sans-serif'; } catch { return 'sans-serif'; }
  }

  /** Sizes a chart canvas's backing store to its CSS box x devicePixelRatio,
   *  so lines/text stay crisp at any width — the CSS box itself (width:100%,
   *  fixed height) is what actually drives layout/resize, this just matches
   *  the drawing surface to it. Returns null if the box isn't laid out yet
   *  (e.g. its tab is currently hidden via display:none). */
  function fitChartSetupCanvas(canvas) {
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (!cssWidth || !cssHeight) return null;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: cssWidth, h: cssHeight };
  }

  function fitChartEmptyState(ctx, w, h, text) {
    ctx.fillStyle = '#9b9ba1';
    ctx.font = '12px ' + fitChartFont();
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, h / 2);
    ctx.textAlign = 'left';
  }

  function fitChartGrid(ctx, padL, padT, plotW, plotH, min, max, lines) {
    ctx.strokeStyle = 'rgba(0,0,0,.08)';
    ctx.lineWidth = 1;
    ctx.font = '10px ' + fitChartFont();
    ctx.fillStyle = '#6e6e73';
    ctx.textAlign = 'left';
    const range = max - min;
    for (let i = 0; i <= lines; i++) {
      const y = padT + plotH - (plotH * i / lines);
      ctx.beginPath(); ctx.moveTo(padL, Math.round(y) + 0.5); ctx.lineTo(padL + plotW, Math.round(y) + 0.5); ctx.stroke();
      const val = Math.round((min + range * i / lines) * 10) / 10;
      ctx.fillText(String(val), 2, y + 3);
    }
  }

  function fitChartXLabels(ctx, points, padL, slotOrStepFn, h) {
    const n = points.length;
    if (!n) return;
    ctx.fillStyle = '#6e6e73';
    ctx.font = '10px ' + fitChartFont();
    ctx.textAlign = 'center';
    const everyN = Math.max(1, Math.ceil(n / 8));
    points.forEach((p, i) => {
      if (n <= 8 || i % everyN === 0 || i === n - 1) {
        ctx.fillText(p.label, slotOrStepFn(i), h - 4);
      }
    });
    ctx.textAlign = 'left';
  }

  function roundRectTop(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h));
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  /** Single-series bar chart — points: [{label, value}]. Mirrors the
   *  original's recharts <BarChart> (rounded top corners, gridlines, an
   *  all-zero/empty "No data logged yet" state). */
  function drawBarChart(canvas, points, opts) {
    opts = opts || {};
    const color = opts.color || FIT_CHART_COLORS.accent;
    function paint() {
      const box = fitChartSetupCanvas(canvas);
      if (!box) return;
      const { ctx, w, h } = box;
      ctx.clearRect(0, 0, w, h);
      const padL = 30, padR = 6, padT = 10, padB = 18;
      const plotW = Math.max(1, w - padL - padR);
      const plotH = Math.max(1, h - padT - padB);
      const values = points.map((p) => p.value);
      const max = Math.max.apply(null, values.concat([0]));
      fitChartGrid(ctx, padL, padT, plotW, plotH, 0, max > 0 ? max : 1, 3);
      if (!points.length || max <= 0) {
        fitChartEmptyState(ctx, w, h, 'No data logged yet');
        return;
      }
      const n = points.length;
      const slot = plotW / n;
      const barW = Math.max(3, Math.min(28, slot * 0.55));
      points.forEach((p, i) => {
        const barH = (p.value / max) * plotH;
        const x = padL + i * slot + (slot - barW) / 2;
        const y = padT + plotH - barH;
        ctx.fillStyle = color;
        roundRectTop(ctx, x, y, barW, Math.max(barH, 1), 4);
        ctx.fill();
      });
      fitChartXLabels(ctx, points, padL, (i) => padL + i * slot + slot / 2, h);
    }
    canvas.__redraw = paint;
    fitChartObserve(canvas);
    paint();
  }

  /** Multi-series line chart — seriesList: [{label, color, points:[{label,value}]}].
   *  All series share one axis (never a dual-axis chart) since CTL/ATL/TSB
   *  are the same training-load unit. Caller is responsible for rendering the
   *  legend as real HTML (see appendChartLegend) — color is never the only
   *  way to tell series apart. */
  function drawLineChart(canvas, seriesList) {
    function paint() {
      const box = fitChartSetupCanvas(canvas);
      if (!box) return;
      const { ctx, w, h } = box;
      ctx.clearRect(0, 0, w, h);
      const padL = 30, padR = 6, padT = 10, padB = 18;
      const plotW = Math.max(1, w - padL - padR);
      const plotH = Math.max(1, h - padT - padB);
      const allValues = [].concat.apply([], seriesList.map((s) => s.points.map((p) => p.value)));
      const hasData = allValues.some((v) => v !== 0);
      const max = Math.max.apply(null, allValues.concat([0]));
      const min = Math.min.apply(null, allValues.concat([0]));
      const range = (max - min) || 1;
      fitChartGrid(ctx, padL, padT, plotW, plotH, min, max, 3);
      if (!hasData) {
        fitChartEmptyState(ctx, w, h, 'No data logged yet');
        return;
      }
      const points0 = seriesList[0].points;
      const n = points0.length;
      const stepX = n > 1 ? plotW / (n - 1) : 0;
      seriesList.forEach((s) => {
        ctx.beginPath();
        s.points.forEach((p, i) => {
          const x = padL + i * stepX;
          const y = padT + plotH - ((p.value - min) / range) * plotH;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
      });
      fitChartXLabels(ctx, points0, padL, (i) => padL + i * stepX, h);
    }
    canvas.__redraw = paint;
    fitChartObserve(canvas);
    paint();
  }

  /** Real HTML legend (never canvas-drawn text) so series identity never
   *  depends on color alone — appended into `container`. */
  function appendChartLegend(container, seriesList) {
    const legend = document.createElement('div');
    legend.className = 'fit-chart-legend';
    seriesList.forEach((s) => {
      const item = document.createElement('span');
      item.className = 'fit-chart-legend-item';
      const dot = document.createElement('span');
      dot.className = 'fit-chart-legend-dot';
      dot.style.background = s.color;
      item.appendChild(dot);
      item.appendChild(document.createTextNode(s.label));
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }

  /** Toggle-able real <table> of a chart's underlying data — the non-mouse,
   *  non-hover-dependent way to get everything the chart shows (canvas has
   *  no text content for a screen reader beyond the aria-label summary). */
  function appendChartTable(container, headers, rows) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'link-accent fit-chart-table-toggle';
    btn.textContent = 'View as table';
    btn.setAttribute('aria-expanded', 'false');
    const table = document.createElement('table');
    table.className = 'fit-chart-table';
    table.hidden = true;
    table.innerHTML =
      '<thead><tr>' + headers.map((hd) => '<th>' + escapeHtml(hd) + '</th>').join('') + '</tr></thead>' +
      '<tbody>' + rows.map((r) => '<tr>' + r.map((c) => '<td>' + escapeHtml(String(c)) + '</td>').join('') + '</tr>').join('') + '</tbody>';
    btn.addEventListener('click', () => {
      const show = table.hidden;
      table.hidden = !show;
      btn.setAttribute('aria-expanded', String(show));
      btn.textContent = show ? 'Hide table' : 'View as table';
    });
    container.appendChild(btn);
    container.appendChild(table);
  }

  // ── Resize plumbing: redraw every mounted chart on container/window
  //    resize, and again on tab-activation (a chart drawn while its tab is
  //    display:none has clientWidth 0 and skips painting — see
  //    fitChartSetupCanvas — so it needs a repaint once it's actually shown;
  //    ResizeObserver firing for a display:none -> block transition isn't
  //    reliable across browsers, so initTabs' activate() also calls this). ──
  let fitChartResizeObserver = null;
  function fitChartRedrawAll() {
    document.querySelectorAll('canvas[data-fit-chart]').forEach((c) => { if (c.__redraw) c.__redraw(); });
  }
  function fitChartObserve(canvas) {
    canvas.setAttribute('data-fit-chart', '1');
    if (window.ResizeObserver) {
      if (!fitChartResizeObserver) {
        fitChartResizeObserver = new ResizeObserver(() => { requestAnimationFrame(fitChartRedrawAll); });
      }
      fitChartResizeObserver.observe(canvas.parentElement);
    } else if (!fitChartObserve._winBound) {
      fitChartObserve._winBound = true;
      window.addEventListener('resize', () => requestAnimationFrame(fitChartRedrawAll));
    }
  }

  // ── Activity list items (own + friends') ──
  function buildActivityItem(a) {
    const item = document.createElement('div');
    item.className = 'activity-item';
    const stats = activityStatsFor(a);
    item.innerHTML =
      '<span class="activity-icon" aria-hidden="true"></span>' +
      '<div class="activity-main">' +
        '<div class="activity-top"><p class="activity-title"></p><p class="activity-when"></p></div>' +
        (stats.length ? '<p class="activity-stats"></p>' : '') +
        (a.notes ? '<p class="activity-notes"></p>' : '') +
      '</div>';
    item.querySelector('.activity-icon').textContent = activityIconFor(a);
    const titleEl = item.querySelector('.activity-title');
    titleEl.textContent = a.title;
    if (a.effort) {
      const span = document.createElement('span');
      span.textContent = ' ' + (HOME_EFFORT_EMOJI[a.effort] || '');
      span.title = 'Effort ' + a.effort + '/10';
      titleEl.appendChild(span);
    }
    item.querySelector('.activity-when').textContent = activityWhenFor(a);
    if (stats.length) item.querySelector('.activity-stats').textContent = stats.join(' · ');
    if (a.notes) item.querySelector('.activity-notes').textContent = a.notes;
    return item;
  }
  function buildFriendActivityItem(a, kudos, currentUserId) {
    const item = document.createElement('div');
    item.className = 'activity-item';
    const stats = activityStatsFor(a);
    item.innerHTML =
      '<span class="activity-icon" aria-hidden="true"></span>' +
      '<div class="activity-main">' +
        '<div class="activity-top"><p class="activity-title"></p><p class="activity-when"></p></div>' +
        (stats.length ? '<p class="activity-stats"></p>' : '') +
        (a.notes ? '<p class="activity-notes"></p>' : '') +
        '<div class="activity-actions"><button type="button" class="kudos-btn"></button><button type="button" class="comment-toggle-btn"></button></div>' +
        '<div class="comment-thread" hidden></div>' +
      '</div>';
    item.querySelector('.activity-icon').textContent = (a.owner.username || '?').charAt(0).toUpperCase();
    item.querySelector('.activity-title').innerHTML =
      '<strong>' + escapeHtml(a.owner.username) + '</strong> · ' + activityIconFor(a) + ' ' + escapeHtml(a.title);
    item.querySelector('.activity-when').textContent = activityWhenFor(a);
    if (stats.length) item.querySelector('.activity-stats').textContent = stats.join(' · ');
    if (a.notes) item.querySelector('.activity-notes').textContent = a.notes;
    let given = kudos ? kudos.givenByMe : false;
    let count = kudos ? kudos.count : 0;
    const btn = item.querySelector('.kudos-btn');
    function paintKudos() {
      btn.classList.toggle('is-given', given);
      btn.textContent = (given ? '🔥 ' : '👊 ') + (count > 0 ? count : 'Kudos');
    }
    paintKudos();
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        if (given) { await removeKudos(a.id, currentUserId); given = false; count = Math.max(0, count - 1); }
        else { await giveKudos(a.id, currentUserId); given = true; count += 1; }
        paintKudos();
      } catch { /* best effort — button just won't reflect the toggle */ }
      finally { btn.disabled = false; }
    });

    // Comments (ported from src/lib/social/comments.ts + friend-activity-card.tsx).
    const commentBtn = item.querySelector('.comment-toggle-btn');
    const threadEl = item.querySelector('.comment-thread');
    let comments = null;
    function paintCommentBtn() { commentBtn.textContent = '💬 ' + (comments && comments.length ? comments.length + ' comments' : 'Comment'); }
    paintCommentBtn();
    function paintThread() {
      threadEl.innerHTML = '';
      (comments || []).forEach((c) => {
        const p = document.createElement('p');
        p.className = 'comment-line';
        const strong = document.createElement('strong');
        strong.textContent = c.author.username;
        p.appendChild(strong);
        p.appendChild(document.createTextNode(' ' + c.body));
        threadEl.appendChild(p);
      });
      const form = document.createElement('form');
      form.className = 'comment-form';
      form.innerHTML = '<input class="fit-input comment-input" type="text" placeholder="Add a comment…" maxlength="500"><button type="submit" class="fit-btn fit-btn-ghost">Post</button>';
      const input = form.querySelector('.comment-input');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = input.value.trim();
        if (!body) return;
        input.disabled = true;
        try {
          await addComment(a.id, currentUserId, body);
          input.value = '';
          comments = await listComments(a.id);
          paintCommentBtn();
          paintThread();
        } catch { /* best effort — comment just won't appear if the write fails */ }
        finally { input.disabled = false; }
      });
      threadEl.appendChild(form);
    }
    commentBtn.addEventListener('click', async () => {
      const opening = threadEl.hidden;
      threadEl.hidden = !opening;
      if (opening && comments === null) {
        threadEl.innerHTML = '<p class="session-note">Loading…</p>';
        comments = await listComments(a.id);
        paintCommentBtn();
        paintThread();
      }
    });
    return item;
  }

  // ── Recovery check-in card ──
  const SORENESS_EMOJI = ['', '💪', '🙂', '😐', '😣', '🤕'];
  const STRESS_EMOJI = ['', '😌', '🙂', '😐', '😰', '🥴'];
  function renderRecoveryCard(today) {
    const card = document.getElementById('recoveryCard');
    if (!homeRecoveryEditing && today) {
      const score = recoveryScoreFor(today);
      const status = interpretRecoveryScore(score);
      card.innerHTML =
        '<div class="recovery-summary"><p class="fit-label">Today’s recovery: ' + escapeHtml(status.label) + '</p>' +
        '<button type="button" class="link-accent" id="recoveryEditBtn">Edit</button></div>' +
        (score !== null ? '<p class="session-note">Score ' + score + '/100</p>' : '');
      document.getElementById('recoveryEditBtn').addEventListener('click', () => { homeRecoveryEditing = true; renderRecoveryCard(today); });
      return;
    }
    card.innerHTML =
      '<form class="recovery-form" id="recoveryForm">' +
      '<p class="fit-label">How are you feeling today?</p>' +
      '<div class="fit-field"><label for="recoverySleep">Sleep (hours)</label><input class="fit-input" id="recoverySleep" type="number" step="0.5" inputmode="decimal"></div>' +
      '<div class="scale-row"><div class="scale-row-head"><span class="fit-label">Soreness</span><span class="scale-emoji" id="recoverySorenessEmoji"></span></div><input type="range" id="recoverySoreness" min="1" max="5" aria-label="Soreness, 1 to 5"></div>' +
      '<div class="scale-row"><div class="scale-row-head"><span class="fit-label">Stress</span><span class="scale-emoji" id="recoveryStressEmoji"></span></div><input type="range" id="recoveryStress" min="1" max="5" aria-label="Stress, 1 to 5"></div>' +
      '<p class="fit-error" id="recoveryError" role="alert" hidden></p>' +
      '<button type="submit" class="fit-btn fit-btn-primary" id="recoverySubmit" style="max-width:220px;">Log check-in</button>' +
      '</form>';
    const sleepEl = document.getElementById('recoverySleep');
    const sorenessEl = document.getElementById('recoverySoreness');
    const stressEl = document.getElementById('recoveryStress');
    sleepEl.value = today && today.sleepHours != null ? today.sleepHours : '';
    sorenessEl.value = today && today.soreness != null ? today.soreness : 3;
    stressEl.value = today && today.stress != null ? today.stress : 3;
    function paintScale(input, emojiEl, arr) { emojiEl.textContent = arr[Number(input.value)]; }
    paintScale(sorenessEl, document.getElementById('recoverySorenessEmoji'), SORENESS_EMOJI);
    paintScale(stressEl, document.getElementById('recoveryStressEmoji'), STRESS_EMOJI);
    sorenessEl.addEventListener('input', () => paintScale(sorenessEl, document.getElementById('recoverySorenessEmoji'), SORENESS_EMOJI));
    stressEl.addEventListener('input', () => paintScale(stressEl, document.getElementById('recoveryStressEmoji'), STRESS_EMOJI));

    document.getElementById('recoveryForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = fitUser(); if (!user) return;
      const btn = document.getElementById('recoverySubmit');
      btn.disabled = true; btn.textContent = 'Saving…';
      showFormError('recoveryError', '');
      try {
        await logRecovery(user.userId, { sleepHours: sleepEl.value, soreness: Number(sorenessEl.value), stress: Number(stressEl.value), notes: '' });
        awardActivityXp(); // same "game_run" event Log uses — the original app awards it here too
        homeRecoveryEditing = false;
        if (homeState) {
          homeState.todayRecovery = await getTodayRecovery(user.userId);
          homeState.recentRecovery = await listRecentRecovery(user.userId, 7);
        }
        renderHome();
      } catch (err) {
        showFormError('recoveryError', (err && err.message) ? err.message : 'Could not save your check-in — try again in a moment.');
        btn.disabled = false; btn.textContent = 'Log check-in';
      }
    });
  }

  /** "Log it →" on today's workout — jumps to Log, prefilled like Training's "start this workout". */
  function handleTodayWorkoutClick() {
    const workout = homeState && homeState.todayWorkout;
    if (!workout) return;
    if (/strength/i.test(workout.type)) {
      document.getElementById('strengthTitle').value = workout.type + ' — today’s plan';
      setLogMode('strength');
    } else {
      document.getElementById('runTitle').value = workout.type;
      const m = /^([\d.]+)\s*mi/.exec(workout.detail || '');
      if (m) document.getElementById('runDistance').value = m[1];
      setLogMode('run');
    }
    const tab = document.querySelector('.tab[data-tab="log"]');
    if (tab) tab.click();
  }

  function initHome() {
    home.signedOut = document.getElementById('homeSignedOut');
    home.body = document.getElementById('homeBody');
    home.signinBtn = document.getElementById('homeSigninBtn');
    if (!home.body) return;
    home.signinBtn.addEventListener('click', () => document.getElementById('btn-signin').click());
    document.getElementById('homeLogLink').addEventListener('click', () => document.querySelector('.tab[data-tab="log"]').click());
    document.getElementById('todayWorkoutBtn').addEventListener('click', handleTodayWorkoutClick);
    document.getElementById('todayFullPlanBtn').addEventListener('click', () => document.querySelector('.tab[data-tab="coach"]').click());
    document.getElementById('homeLearnLink').addEventListener('click', () => document.querySelector('.tab[data-tab="learn"]').click());
  }

  function renderHome() {
    if (!homeState) return;
    const { user, activities, goals, onboardingMileage, onboardingCompleted, recentRecovery, todayRecovery, feed, kudosMap } = homeState;
    document.getElementById('homeOnboardingPrompt').hidden = !!onboardingCompleted;

    const avgScore = averageRecentScore(recentRecovery, 7);
    const load = computeTrainingLoad(activities);
    const loadStatus = interpretLoad(load);
    const mileage = weeklyMileage(activities);
    const streak = currentStreak(activities);
    const recoveryStatus = interpretRecoveryScore(avgScore);

    const stats = [
      { label: 'This week', value: mileage.toFixed(1) + ' mi', note: 'Runs logged this week' },
      { label: 'Streak', value: streak + ' day' + (streak === 1 ? '' : 's'), note: 'Consecutive days logged' },
      { label: 'Fitness score', value: String(load.ctl), note: '42-day training load (CTL)' },
      { label: 'Training status', value: loadStatus.label, note: 'See Coach for why' },
      { label: 'Recovery', value: avgScore !== null ? recoveryStatus.label : '—', note: '7-day average from check-ins' },
    ];
    const statsWrap = document.getElementById('homeStats');
    statsWrap.innerHTML = '';
    stats.forEach((s) => {
      const tile = document.createElement('div');
      tile.className = 'stat-tile';
      tile.innerHTML = '<span class="stat-label"></span><span class="stat-value"></span><span class="stat-note"></span>';
      tile.querySelector('.stat-label').textContent = s.label;
      tile.querySelector('.stat-value').textContent = s.value;
      tile.querySelector('.stat-note').textContent = s.note;
      statsWrap.appendChild(tile);
    });

    renderRecoveryCard(todayRecovery);

    const trendCard = document.getElementById('trendCard');
    trendCard.hidden = activities.length === 0;
    if (activities.length) {
      const weeks = weeklyTrend(activities, 8);
      requestAnimationFrame(() => drawSparkline(document.getElementById('trendSparkline'), weeks));
    }

    const month = monthSummary(activities);
    const monthWrap = document.getElementById('monthStats');
    monthWrap.hidden = activities.length === 0;
    if (activities.length) {
      monthWrap.innerHTML = '';
      [
        ['Mileage this month', month.totalMileage + ' mi'],
        ['Runs', String(month.runCount)],
        ['Strength sessions', String(month.strengthCount)],
        ['Total activities', String(month.totalActivities)],
      ].forEach(([label, value]) => {
        const tile = document.createElement('div');
        tile.className = 'stat-tile';
        tile.innerHTML = '<span class="stat-label"></span><span class="stat-value"></span>';
        tile.querySelector('.stat-label').textContent = label;
        tile.querySelector('.stat-value').textContent = value;
        monthWrap.appendChild(tile);
      });
    }

    const recentWeeks = weeklyTrend(activities, 4);
    const loggedAvg = recentWeeks.reduce((s, w) => s + w.mileage, 0) / (recentWeeks.length || 1);
    const baseline = loggedAvg > 0 ? loggedAvg : onboardingMileage;
    const raceGoal = primaryRaceGoal(goals);
    const plan = generateWeekPlan({
      goalLabel: raceGoal ? raceGoal.goal_key : null,
      targetDate: raceGoal ? raceGoal.target_date : null,
      baselineWeeklyMileage: baseline,
      recoveryMultiplier: recoveryLoadMultiplier(avgScore),
    });
    const todayPlan = plan.days.find((d) => d.day === todayDayLabel());
    homeState.todayWorkout = todayPlan ? { type: todayPlan.type, detail: todayPlan.detail, note: plan.recoveryNote } : null;
    const textEl = document.getElementById('todayWorkoutText');
    const noteEl = document.getElementById('todayWorkoutNote');
    const workoutBtn = document.getElementById('todayWorkoutBtn');
    if (homeState.todayWorkout) {
      textEl.innerHTML = '<strong>' + escapeHtml(homeState.todayWorkout.type) + '</strong> — ' + escapeHtml(homeState.todayWorkout.detail);
      noteEl.hidden = !homeState.todayWorkout.note;
      if (homeState.todayWorkout.note) noteEl.textContent = homeState.todayWorkout.note;
      workoutBtn.hidden = /rest/i.test(homeState.todayWorkout.type);
    } else {
      textEl.textContent = 'Log a few activities to get a personalized plan.';
      noteEl.hidden = true;
      workoutBtn.hidden = true;
    }

    const recentList = document.getElementById('homeRecentList');
    recentList.innerHTML = '';
    if (!activities.length) {
      recentList.innerHTML = '<p class="desc">Nothing logged yet. <button type="button" class="link-accent" id="homeEmptyLogLink">Log your first activity</button>.</p>';
      const link = document.getElementById('homeEmptyLogLink');
      if (link) link.addEventListener('click', () => document.querySelector('.tab[data-tab="log"]').click());
    } else {
      activities.slice(0, 8).forEach((a) => recentList.appendChild(buildActivityItem(a)));
    }

    const friendsList = document.getElementById('homeFriendsList');
    friendsList.innerHTML = '';
    if (!feed.length) {
      friendsList.innerHTML = '<p class="desc">No friends yet — once following people is live, their runs and lifts will show up here.</p>';
    } else {
      feed.forEach((a) => friendsList.appendChild(buildFriendActivityItem(a, kudosMap.get(a.id), user.userId)));
    }
  }

  async function refreshHome() {
    const user = fitUser();
    if (!home.body) return;
    if (!user) {
      home.signedOut.hidden = false;
      home.body.hidden = true;
      return;
    }
    home.signedOut.hidden = true;
    home.body.hidden = false;
    document.getElementById('homeLoadingPill').hidden = false;

    let activities = [], goals = [], onboardingMileage = 0, onboardingCompleted = false, recentRecovery = [], todayRecovery = null, feed = [], kudosMap = new Map();
    try {
      const results = await Promise.all([
        listActivities(user.userId, 200),
        getGoals(user.userId),
        getOnboardingWeeklyMileage(user.userId),
        listRecentRecovery(user.userId, 7),
        getTodayRecovery(user.userId),
        getOnboardingCompleted(user.userId),
      ]);
      activities = results[0]; goals = results[1]; onboardingMileage = results[2]; recentRecovery = results[3]; todayRecovery = results[4]; onboardingCompleted = results[5];
    } catch { /* everything already defaulted above — Home still renders with empty state */ }

    try {
      feed = await getFriendsFeed(user.userId);
      if (feed.length) kudosMap = await getKudosInfo(feed.map((a) => a.id), user.userId);
    } catch { feed = []; }

    homeRecoveryEditing = false;
    homeState = { user, activities, goals, onboardingMileage, onboardingCompleted, recentRecovery, todayRecovery, feed, kudosMap };
    document.getElementById('homeLoadingPill').hidden = true;
    renderHome();
  }

  /* ==========================================================================
     ONBOARDING WIZARD (Phase 4) — ported from trollrunner-fitness's
     src/app/onboarding/onboarding-client.tsx + src/lib/onboarding/api.ts +
     constants.ts + types.ts.

     The original app had no dedicated tab for this either — it was a
     one-time /onboarding route hit before the rest of the app, gating on
     session status. There's no such route here, so it's surfaced as a
     modal wizard instead: launched from a "Complete your profile" card on
     the You tab (which otherwise stays the Phase-later placeholder), and
     from a dismissible-by-completion prompt card on Home that shows only
     until fit_profiles.onboarding_completed_at is set (wired into
     refreshHome/renderHome above).

     Field names inside the fit_onboarding JSONB columns (running/strength/
     equipment/lifestyle/nutrition/medical) and the fit_profiles columns
     match the original exactly — same object shapes, same key casing —
     since Home's getOnboardingWeeklyMileage() (already ported, above)
     reads data.running.weeklyMileage straight off this same table, and
     getStrengthSplit() reads data.strength.split. Values are saved as the
     raw strings out of each input, same as the original (numeric parsing
     only happens for the handful of fit_profiles columns that are actual
     numeric columns, and at read time for weeklyMileage) — not converted
     to numbers here either, to keep the two apps' data byte-for-byte
     compatible.
     ========================================================================== */

  const OB_GOALS = ['Lose weight', 'Gain muscle', 'Body recomposition', 'Hypertrophy', 'Strength', 'General health', 'Run first 5K', 'Run first half marathon', 'Run first marathon', 'Boston qualifier', 'Sub-3 marathon', 'Ultra marathon', 'Ironman', 'Improve VO2 max', 'Increase endurance', 'Improve mobility', 'Longevity'];
  const OB_EXPERIENCE_LEVELS = ['New to training', 'Casual', 'Consistent', 'Competitive', 'Elite'];
  const OB_STRENGTH_SPLITS = ['None yet', 'Full body', 'Upper / lower', 'Push / pull / legs', 'Bro split', 'Powerlifting', 'Olympic weightlifting', 'Running strength'];
  const OB_EQUIPMENT_OPTIONS = ['Commercial gym', 'Home gym', 'Barbell', 'Dumbbells', 'Resistance bands', 'Treadmill', 'Exercise bike', 'Track access', 'Pool', 'Rowing machine', 'None'];
  const OB_DIET_OPTIONS = ['No preference', 'Vegetarian', 'Vegan', 'Mediterranean', 'Keto', 'High protein', 'Halal', 'Kosher'];
  const OB_MEDICAL_CONDITIONS = ['Asthma', 'Diabetes', 'Hypertension', 'Heart disease', 'Joint problems'];
  const OB_STRESS_LEVELS = ['Low', 'Moderate', 'High', 'Very high'];
  const OB_ALCOHOL_LEVELS = ['None', 'Occasional', 'Regular', 'Frequent'];
  const OB_SMOKING_LEVELS = ['Never', 'Former', 'Occasional', 'Regular'];

  function obEmptyDraft() {
    return {
      goals: [], targetDate: '',
      personal: { units: 'imperial', age: '', sex: '', height: '', weight: '', bodyFatPct: '', country: '', occupation: '', experienceLevel: '' },
      running: { longestRunMi: '', weeklyMileage: '', weeklyRuns: '', easyPace: '', fiveKPr: '', tenKPr: '', halfPr: '', marathonPr: '', trailRunning: false, trackExperience: false },
      strength: { yearsLifting: '', split: '', squat: '', bench: '', deadlift: '', overheadPress: '', pullUps: '', pushUps: '', plankSeconds: '', favoriteExercises: '', leastFavoriteExercises: '' },
      equipment: { items: [] },
      lifestyle: { sleepHours: '', stressLevel: '', alcohol: '', smoking: '', dailySteps: '', trainingDaysPerWeek: '', workoutDurationMin: '', recoveryHabits: '' },
      nutrition: { diet: '', allergies: '', preferences: '', calorieTracking: false, macroTracking: false },
      medical: { previousInjuries: '', surgeries: '', conditions: [], medications: '', limitations: '' },
      ethnicity: '',
    };
  }
  function obGet(draft, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), draft); }
  function obSet(draft, path, value) {
    const parts = path.split('.');
    let node = draft;
    for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]];
    node[parts[parts.length - 1]] = value;
  }

  // Step boundaries match the original's STEPS array 1:1: welcome (intro,
  // no fields) + the 9 data groups (goals, personal, running, strength,
  // equipment, lifestyle, nutrition, medical, ethnicity), each grouping
  // several related fields per screen rather than one-field-per-step.
  const OB_STEPS = [
    { key: 'welcome', title: "Let's build the strongest version of you.", quote: 'Every elite athlete started somewhere.', fields: [] },
    { key: 'goals', title: 'What are you chasing?', quote: 'Pick as many as you want — plans adapt as goals change.', fields: [
      { type: 'multiselect', path: 'goals', label: 'Goals', options: OB_GOALS },
      { type: 'date', path: 'targetDate', label: 'Target date (optional)' },
    ] },
    { key: 'personal', title: 'The basics', quote: "Today's effort becomes tomorrow's strength.", fields: [
      { type: 'select', path: 'personal.units', label: 'Units', options: ['imperial', 'metric'] },
      { type: 'number', path: 'personal.age', label: 'Age', group: true },
      { type: 'text', path: 'personal.sex', label: 'Sex', group: true },
      { type: 'number', path: 'personal.height', label: (d) => (d.personal.units === 'imperial' ? 'Height (in)' : 'Height (cm)'), group: true },
      { type: 'number', path: 'personal.weight', label: (d) => (d.personal.units === 'imperial' ? 'Weight (lb)' : 'Weight (kg)'), group: true },
      { type: 'number', path: 'personal.bodyFatPct', label: 'Body fat % (optional)', group: true },
      { type: 'text', path: 'personal.country', label: 'Country', group: true },
      { type: 'text', path: 'personal.occupation', label: 'Occupation' },
      { type: 'select', path: 'personal.experienceLevel', label: 'Fitness experience', options: OB_EXPERIENCE_LEVELS },
    ] },
    { key: 'running', title: 'Running history', quote: "Skip this whole section if running isn't your thing yet.", fields: [
      { type: 'number', path: 'running.longestRunMi', label: 'Longest run (mi)', group: true },
      { type: 'number', path: 'running.weeklyMileage', label: 'Weekly mileage', group: true },
      { type: 'number', path: 'running.weeklyRuns', label: 'Runs per week', group: true },
      { type: 'text', path: 'running.easyPace', label: 'Easy pace (min/mi)', group: true },
      { type: 'text', path: 'running.fiveKPr', label: '5K PR', group: true },
      { type: 'text', path: 'running.tenKPr', label: '10K PR', group: true },
      { type: 'text', path: 'running.halfPr', label: 'Half marathon PR', group: true },
      { type: 'text', path: 'running.marathonPr', label: 'Marathon PR', group: true },
      { type: 'toggle', path: 'running.trailRunning', label: 'I run trails' },
      { type: 'toggle', path: 'running.trackExperience', label: 'I have track experience' },
    ] },
    { key: 'strength', title: 'Strength history', quote: "Numbers rusty or nonexistent? Leave it blank — we'll find out together.", fields: [
      { type: 'number', path: 'strength.yearsLifting', label: 'Years lifting' },
      { type: 'select', path: 'strength.split', label: 'Current split', options: OB_STRENGTH_SPLITS },
      { type: 'text', path: 'strength.squat', label: 'Squat', group: true },
      { type: 'text', path: 'strength.bench', label: 'Bench', group: true },
      { type: 'text', path: 'strength.deadlift', label: 'Deadlift', group: true },
      { type: 'text', path: 'strength.overheadPress', label: 'Overhead press', group: true },
      { type: 'text', path: 'strength.pullUps', label: 'Pull-ups (max reps)', group: true },
      { type: 'text', path: 'strength.pushUps', label: 'Push-ups (max reps)', group: true },
      { type: 'text', path: 'strength.plankSeconds', label: 'Plank (seconds)', group: true },
      { type: 'textarea', path: 'strength.favoriteExercises', label: 'Favorite exercises' },
      { type: 'textarea', path: 'strength.leastFavoriteExercises', label: 'Least favorite exercises' },
    ] },
    { key: 'equipment', title: 'What do you train with?', quote: "We'll only ever suggest workouts you can actually do.", fields: [
      { type: 'multiselect', path: 'equipment.items', label: 'Equipment access', options: OB_EQUIPMENT_OPTIONS },
    ] },
    { key: 'lifestyle', title: 'Life outside the gym', quote: 'Recovery is training too.', fields: [
      { type: 'number', path: 'lifestyle.sleepHours', label: 'Sleep (hrs/night)', group: true },
      { type: 'number', path: 'lifestyle.dailySteps', label: 'Daily steps', group: true },
      { type: 'number', path: 'lifestyle.trainingDaysPerWeek', label: 'Training days/week', group: true },
      { type: 'number', path: 'lifestyle.workoutDurationMin', label: 'Workout duration (min)', group: true },
      { type: 'select', path: 'lifestyle.stressLevel', label: 'Stress level', options: OB_STRESS_LEVELS },
      { type: 'select', path: 'lifestyle.alcohol', label: 'Alcohol', options: OB_ALCOHOL_LEVELS },
      { type: 'select', path: 'lifestyle.smoking', label: 'Smoking', options: OB_SMOKING_LEVELS },
      { type: 'textarea', path: 'lifestyle.recoveryHabits', label: 'Recovery habits (stretching, sauna, massage...)' },
    ] },
    { key: 'nutrition', title: 'Nutrition', quote: 'This shapes your calorie and fueling targets, not a diet lecture.', fields: [
      { type: 'select', path: 'nutrition.diet', label: 'Diet style', options: OB_DIET_OPTIONS },
      { type: 'text', path: 'nutrition.allergies', label: 'Food allergies' },
      { type: 'textarea', path: 'nutrition.preferences', label: 'Food preferences / dislikes' },
      { type: 'toggle', path: 'nutrition.calorieTracking', label: 'I want calorie tracking' },
      { type: 'toggle', path: 'nutrition.macroTracking', label: 'I want macro tracking' },
    ] },
    { key: 'medical', title: 'Health history', quote: 'Educational, not medical advice — this just keeps the engine conservative.', fields: [
      { type: 'multiselect', path: 'medical.conditions', label: 'Any of these apply?', options: OB_MEDICAL_CONDITIONS },
      { type: 'textarea', path: 'medical.previousInjuries', label: 'Previous injuries' },
      { type: 'textarea', path: 'medical.surgeries', label: 'Surgeries' },
      { type: 'textarea', path: 'medical.medications', label: 'Current medications' },
      { type: 'textarea', path: 'medical.limitations', label: 'Any limitations the coach should know about' },
      { type: 'note', text: 'This is educational, not medical advice, and never a substitute for personalized care from a doctor.' },
    ] },
    { key: 'ethnicity', title: 'One optional question', quote: 'Skip this one freely — it changes nothing if left blank.', fields: [
      { type: 'text', path: 'ethnicity', label: 'Ethnic background (optional)' },
      { type: 'note', text: 'Only used to personalize nutrition guidance and surface population-level considerations — your own data, preferences, and goals always come first, and we never make assumptions based on this answer.' },
    ] },
  ];

  const ob = {};
  let obDraft = obEmptyDraft();
  let obStepIndex = 0;
  let obBusy = false;

  function obFieldLabel(field, draft) { return typeof field.label === 'function' ? field.label(draft) : field.label; }

  function obBuildField(field) {
    const wrap = document.createElement('div');
    wrap.className = 'fit-field';
    if (field.group) { wrap.style.flex = '1'; wrap.style.minWidth = '140px'; }
    const label = obFieldLabel(field, obDraft);
    if (field.type === 'text' || field.type === 'number' || field.type === 'date') {
      wrap.innerHTML = '<label></label><input class="fit-input">';
      wrap.querySelector('label').textContent = label;
      const input = wrap.querySelector('input');
      input.type = field.type;
      if (field.type === 'number') input.inputMode = 'decimal';
      input.value = obGet(obDraft, field.path) || '';
      input.addEventListener('input', () => obSet(obDraft, field.path, input.value));
    } else if (field.type === 'textarea') {
      wrap.innerHTML = '<label></label><textarea class="fit-textarea"></textarea>';
      wrap.querySelector('label').textContent = label;
      const ta = wrap.querySelector('textarea');
      ta.value = obGet(obDraft, field.path) || '';
      ta.addEventListener('input', () => obSet(obDraft, field.path, ta.value));
    } else if (field.type === 'select') {
      wrap.innerHTML = '<label></label><select class="fit-input"></select>';
      wrap.querySelector('label').textContent = label;
      const sel = wrap.querySelector('select');
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Select…';
      sel.appendChild(blank);
      field.options.forEach((opt) => {
        const o = document.createElement('option'); o.value = opt; o.textContent = opt;
        sel.appendChild(o);
      });
      sel.value = obGet(obDraft, field.path) || '';
      sel.addEventListener('change', () => {
        obSet(obDraft, field.path, sel.value);
        if (field.path === 'personal.units') renderObStep(); // relabel height/weight for the new units
      });
    } else if (field.type === 'multiselect') {
      wrap.innerHTML = '<p class="fit-label"></p><div class="chip-row"></div>';
      wrap.querySelector('p').textContent = label;
      const row = wrap.querySelector('.chip-row');
      const current = obGet(obDraft, field.path) || [];
      field.options.forEach((opt) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.textContent = opt;
        const active = current.indexOf(opt) !== -1;
        b.setAttribute('aria-pressed', String(active));
        b.classList.toggle('is-active', active);
        b.addEventListener('click', () => {
          const arr = obGet(obDraft, field.path).slice();
          const i = arr.indexOf(opt);
          if (i === -1) arr.push(opt); else arr.splice(i, 1);
          obSet(obDraft, field.path, arr);
          const nowActive = arr.indexOf(opt) !== -1;
          b.setAttribute('aria-pressed', String(nowActive));
          b.classList.toggle('is-active', nowActive);
        });
        row.appendChild(b);
      });
    } else if (field.type === 'toggle') {
      wrap.innerHTML = '<div class="chip-row"><button type="button" class="chip"></button></div>';
      const b = wrap.querySelector('.chip');
      b.textContent = label;
      const val = !!obGet(obDraft, field.path);
      b.setAttribute('aria-pressed', String(val));
      b.classList.toggle('is-active', val);
      b.addEventListener('click', () => {
        const next = !obGet(obDraft, field.path);
        obSet(obDraft, field.path, next);
        b.setAttribute('aria-pressed', String(next));
        b.classList.toggle('is-active', next);
      });
    } else if (field.type === 'note') {
      wrap.className = '';
      wrap.innerHTML = '<p class="session-note"></p>';
      wrap.querySelector('p').textContent = field.text;
    }
    return wrap;
  }

  function renderObStep() {
    const step = OB_STEPS[obStepIndex];
    ob.title.textContent = step.title;
    ob.quote.textContent = step.quote;
    ob.stepCount.textContent = 'Step ' + (obStepIndex + 1) + ' of ' + OB_STEPS.length;
    ob.progressBar.style.width = (((obStepIndex + 1) / OB_STEPS.length) * 100) + '%';
    ob.body.innerHTML = '';
    if (step.key === 'welcome') {
      const p = document.createElement('p');
      p.className = 'desc';
      p.textContent = "A few quick questions — goals, training history, lifestyle, and health — so your coach can build a plan around the real you, not a generic template. Nothing here is required to finish; skip anything you'd rather leave blank.";
      ob.body.appendChild(p);
    } else {
      const groupWrap = document.createElement('div');
      groupWrap.className = 'fit-form';
      let row = null;
      step.fields.forEach((field) => {
        const el = obBuildField(field);
        if (field.group) {
          if (!row) { row = document.createElement('div'); row.className = 'fit-row'; groupWrap.appendChild(row); }
          row.appendChild(el);
        } else {
          row = null;
          groupWrap.appendChild(el);
        }
      });
      ob.body.appendChild(groupWrap);
    }
    ob.back.disabled = obStepIndex === 0;
    ob.back.hidden = false;
    ob.next.disabled = obBusy;
    ob.next.textContent = obBusy ? 'Saving…' : (obStepIndex === OB_STEPS.length - 1 ? 'Finish' : 'Next');
    obShowError('');
  }

  function obShowError(msg) {
    ob.error.hidden = !msg;
    ob.error.textContent = msg || '';
  }

  function openObModal() {
    obDraft = obEmptyDraft();
    obStepIndex = 0;
    obBusy = false;
    ob.modal.hidden = false;
    renderObStep();
  }
  function closeObModal() { ob.modal.hidden = true; }

  /** Ported 1:1 from src/lib/onboarding/api.ts submitOnboarding(). */
  async function obSubmit(userId) {
    const isImperial = obDraft.personal.units === 'imperial';
    const rawHeight = toNumberOrNull(obDraft.personal.height);
    const rawWeight = toNumberOrNull(obDraft.personal.weight);
    const heightCm = rawHeight === null ? null : (isImperial ? rawHeight * 2.54 : rawHeight);
    const weightKg = rawWeight === null ? null : (isImperial ? rawWeight * 0.453592 : rawWeight);
    const sb = fitClient();
    if (!sb) throw new Error('Account service unavailable.');

    const { error: profileError } = await sb.from('fit_profiles').upsert({
      user_id: userId, units: obDraft.personal.units, age: toNumberOrNull(obDraft.personal.age),
      sex: obDraft.personal.sex || null, height_cm: heightCm, weight_kg: weightKg,
      body_fat_pct: toNumberOrNull(obDraft.personal.bodyFatPct), country: obDraft.personal.country || null,
      occupation: obDraft.personal.occupation || null, experience_level: obDraft.personal.experienceLevel || null,
      ethnicity: obDraft.ethnicity || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      onboarding_completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (profileError) throw profileError;

    if (obDraft.goals.length) {
      const rows = obDraft.goals.map((goal_key) => ({ user_id: userId, goal_key, target_date: obDraft.targetDate || null }));
      const { error: goalsError } = await sb.from('fit_goals').upsert(rows, { onConflict: 'user_id,goal_key' });
      if (goalsError) throw goalsError;
    }

    const { error: onboardingError } = await sb.from('fit_onboarding').upsert({
      user_id: userId, running: obDraft.running, strength: obDraft.strength, equipment: obDraft.equipment,
      lifestyle: obDraft.lifestyle, nutrition: obDraft.nutrition, medical: obDraft.medical,
    }, { onConflict: 'user_id' });
    if (onboardingError) throw onboardingError;
  }

  function obShowDone() {
    ob.body.innerHTML = '';
    ob.stepCount.textContent = '';
    ob.progressBar.style.width = '100%';
    ob.title.textContent = "You're all set.";
    ob.quote.textContent = '';
    const p = document.createElement('p');
    p.className = 'desc';
    p.textContent = 'Your coach now knows the real you — head back to Home for a plan built around your numbers.';
    ob.body.appendChild(p);
    ob.back.hidden = true;
    ob.next.disabled = false;
    ob.next.textContent = 'Done';
  }

  async function getOnboardingCompleted(userId) {
    const sb = fitClient(); if (!sb) return false;
    try {
      const { data } = await sb.from('fit_profiles').select('onboarding_completed_at').eq('user_id', userId).maybeSingle();
      return !!(data && data.onboarding_completed_at);
    } catch { return false; }
  }

  /** Coach-profile pill/desc/button inside the You tab's onboarding card — split
   *  out of the old refreshYou() so the Phase 5 rewrite below can call it as
   *  just one piece of a fully signed-in-gated You tab (see refreshYou below). */
  async function refreshYouOnboardingCard(user) {
    const statusEl = document.getElementById('youOnboardingStatus');
    if (!statusEl) return;
    const descEl = document.getElementById('youOnboardingDesc');
    const btn = document.getElementById('youOnboardingBtn');
    statusEl.textContent = 'Checking…';
    const completed = await getOnboardingCompleted(user.userId);
    statusEl.textContent = completed ? 'Complete' : 'Not started';
    descEl.textContent = completed
      ? 'Your coach profile is set. Retake it any time your goals or training history change.'
      : 'Answer a few questions about your goals, training history, equipment, and health basics — this personalizes your weekly plan and the coach.';
    btn.textContent = completed ? 'Update your profile' : 'Complete your profile';
  }

  function initOnboarding() {
    ob.modal = document.getElementById('obModal');
    if (!ob.modal) return;
    ob.backdrop = document.getElementById('obModalBackdrop');
    ob.close = document.getElementById('obModalClose');
    ob.title = document.getElementById('obModalTitle');
    ob.quote = document.getElementById('obQuote');
    ob.stepCount = document.getElementById('obStepCount');
    ob.progressBar = document.getElementById('obProgressBar');
    ob.body = document.getElementById('obStepBody');
    ob.error = document.getElementById('obError');
    ob.back = document.getElementById('obBack');
    ob.next = document.getElementById('obNext');

    ob.close.addEventListener('click', closeObModal);
    ob.backdrop.addEventListener('click', closeObModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ob.modal.hidden) closeObModal(); });
    ob.back.addEventListener('click', () => { if (obStepIndex > 0 && !obBusy) { obStepIndex -= 1; renderObStep(); } });

    ob.next.addEventListener('click', async () => {
      if (obBusy) return;
      if (ob.next.textContent === 'Done') { closeObModal(); refreshHome(); refreshYou(); return; }
      if (obStepIndex < OB_STEPS.length - 1) { obStepIndex += 1; renderObStep(); return; }
      const user = fitUser();
      if (!user) { closeObModal(); document.getElementById('btn-signin').click(); return; }
      obBusy = true; ob.next.disabled = true; ob.next.textContent = 'Saving…'; obShowError('');
      try {
        await obSubmit(user.userId);
        obBusy = false;
        obShowDone();
      } catch (err) {
        obBusy = false;
        ob.next.disabled = false;
        ob.next.textContent = 'Finish';
        obShowError((err && err.message) ? err.message : 'Could not save — try again.');
      }
    });

    function openIfSignedIn() {
      const user = fitUser();
      if (!user) { document.getElementById('btn-signin').click(); return; }
      openObModal();
    }
    document.getElementById('youOnboardingBtn').addEventListener('click', openIfSignedIn);
    const homeBtn = document.getElementById('homeOnboardingBtn');
    if (homeBtn) homeBtn.addEventListener('click', openIfSignedIn);
  }

  /* ==========================================================================
     YOU (Phase 5) — ported from trollrunner-fitness's src/app/you/you-client.tsx
     + src/lib/gamification/badges.ts + humor.ts + src/lib/social/follows.ts +
     leaderboard.ts + comments.ts. Same rules as every other tab above: no new
     Supabase client (fitClient()/fitUser() only), no new XP wiring beyond the
     existing awardActivityXp()/awardPrXp(), fail-soft on missing/empty data.

     Badges are computed CLIENT-SIDE from a fresh fetch of the user's own
     activities (listActivities(), already defined above for Log/Home) — there
     is no badge table, same as the original (a fresh fetch scoped to this tab
     was simpler/more isolated than threading Home's activities array over,
     since You can be opened without ever visiting Home first).

     Find people reuses window.TrollrunnerAccounts.searchUsernames() — the
     same debounced username search troll-accounts.js already exposes for
     Messages/friends elsewhere on the site — instead of inventing a new
     ilike query here. Follow/unfollow themselves go through fit_follows (a
     separate, fitness-specific follow graph from troll-accounts' own
     friend-request system) since that's what Home's already-built friends
     feed and kudos already read from.

     Analytics (src/components/analytics/analytics-section.tsx in the
     original) is explicitly Phase 6 territory per the project plan — this
     tab just points back to Home's existing stats/trend chart plus two
     quick numbers, rather than duplicating real charts here.

     Comments (src/components/social/comments in the original) are wired
     into Home's friend-activity feed items below (buildFriendActivityItem),
     since fit_comments already has RLS policies and the task called this a
     small stretch worth doing alongside the core social/gamification work.
     ========================================================================== */

  // ── Badges (ported 1:1 from src/lib/gamification/badges.ts) ──
  function computePRTimeline(activities) {
    const sorted = activities.slice().sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
    const bests = new Map();
    const timeline = [];
    for (const a of sorted) {
      if (a.type !== 'strength') continue;
      for (const s of a.sets) {
        if (!s.weight_lb || !s.reps) continue;
        const estOneRm = estOneRepMax(s.weight_lb, s.reps);
        const k = exerciseKey(s.exercise);
        const prior = bests.get(k);
        if (!prior || estOneRm > prior.estOneRm) {
          const entry = { exercise: s.exercise, estOneRm, weightLb: s.weight_lb, reps: s.reps };
          bests.set(k, entry);
          timeline.push(Object.assign({ achievedAt: a.occurredAt }, entry));
        }
      }
    }
    return timeline.reverse();
  }
  function computeBadges(activities) {
    const runs = activities.filter((a) => a.type === 'run');
    const runCount = runs.length;
    const strengthCount = activities.filter((a) => a.type === 'strength').length;
    const mileage = runs.reduce((s, a) => s + (a.distanceMi || 0), 0);
    const streak = currentStreak(activities);
    const prCount = computePRTimeline(activities).length;
    const longestRun = Math.max(0, ...runs.map((a) => a.distanceMi || 0));
    return [
      { id: 'first_log', label: 'First activity logged', emoji: '🏅', earned: activities.length >= 1 },
      { id: 'ten_logs', label: '10 activities logged', emoji: '📈', earned: activities.length >= 10 },
      { id: 'fifty_logs', label: '50 activities logged', emoji: '🏅', earned: activities.length >= 50 },
      { id: 'first_run', label: 'First run', emoji: '🏃', earned: runCount >= 1 },
      { id: 'ten_runs', label: '10 runs', emoji: '🏃‍♂️', earned: runCount >= 10 },
      { id: 'hundred_miles', label: '100 total miles', emoji: '💯', earned: mileage >= 100 },
      { id: 'long_run', label: 'Ran 10+ miles in one go', emoji: '🦵', earned: longestRun >= 10 },
      { id: 'first_strength', label: 'First strength workout', emoji: '🏋️', earned: strengthCount >= 1 },
      { id: 'ten_strength', label: '10 strength workouts', emoji: '💪', earned: strengthCount >= 10 },
      { id: 'first_pr', label: 'First PR', emoji: '🏆', earned: prCount >= 1 },
      { id: 'five_prs', label: '5 PRs', emoji: '🥇', earned: prCount >= 5 },
      { id: 'streak_7', label: '7-day streak', emoji: '🔥', earned: streak >= 7 },
      { id: 'streak_30', label: '30-day streak', emoji: '🌋', earned: streak >= 30 },
      { id: 'streak_100', label: '100-day streak', emoji: '👹', earned: streak >= 100 },
    ];
  }

  // ── Humor toggle write (getHumorEnabled already defined above for Log) ──
  async function setHumorEnabled(userId, enabled) {
    const sb = fitClient();
    if (!sb) throw new Error('Account service unavailable.');
    const { error } = await sb.from('fit_profiles').upsert({ user_id: userId, humor_enabled: enabled }, { onConflict: 'user_id' });
    if (error) throw error;
  }

  // ── Follows (ported from src/lib/social/follows.ts; listFollowingIds is
  //    already defined above for Home's friends feed) ──
  async function profilesForIds(ids) {
    if (!ids.length) return [];
    const sb = fitClient(); if (!sb) return [];
    const { data, error } = await sb.from('troll_profiles').select('id, username, avatar_url').in('id', ids);
    if (error) throw error;
    return (data || []).map((p) => ({ id: p.id, username: p.username, avatarUrl: p.avatar_url }));
  }
  async function listFollowingProfiles(userId) { return profilesForIds(await listFollowingIds(userId)); }
  async function listFollowerProfiles(userId) {
    const sb = fitClient(); if (!sb) return [];
    try {
      const { data, error } = await sb.from('fit_follows').select('follower_id').eq('followed_id', userId);
      if (error) throw error;
      return await profilesForIds((data || []).map((r) => r.follower_id));
    } catch { return []; }
  }
  async function followUser(followerId, followedId) {
    const sb = fitClient(); if (!sb) throw new Error('Account service unavailable.');
    const { error } = await sb.from('fit_follows').insert({ follower_id: followerId, followed_id: followedId });
    if (error) throw error;
  }
  async function unfollowUser(followerId, followedId) {
    const sb = fitClient(); if (!sb) throw new Error('Account service unavailable.');
    const { error } = await sb.from('fit_follows').delete().eq('follower_id', followerId).eq('followed_id', followedId);
    if (error) throw error;
  }
  // Reuses troll-accounts.js's shared searchUsernames() — the same debounced
  // lookup Messages/friends already use — instead of a new ilike query.
  async function searchPeople(query, excludeId) {
    if (!window.TrollrunnerAccounts || !window.TrollrunnerAccounts.searchUsernames) return [];
    const rows = await window.TrollrunnerAccounts.searchUsernames(query, { limit: 10, excludeId });
    return (rows || []).map((p) => ({ id: p.id, username: p.username, avatarUrl: p.avatar_url }));
  }

  // ── Weekly leaderboard (ported 1:1 from src/lib/social/leaderboard.ts;
  //    reuses homeStartOfWeek() already defined above for Home's trend). ──
  async function weeklyLeaderboardRows(userId) {
    const followingIds = await listFollowingIds(userId);
    const userIds = Array.from(new Set([userId].concat(followingIds)));
    const sb = fitClient(); if (!sb) return [];
    const since = homeStartOfWeek().toISOString();
    const { data, error } = await sb.from('fit_activities')
      .select('user_id, distance_mi').in('user_id', userIds).eq('type', 'run').eq('source', 'native').gte('occurred_at', since);
    if (error) throw error;
    const mileageByUser = new Map();
    (data || []).forEach((row) => mileageByUser.set(row.user_id, (mileageByUser.get(row.user_id) || 0) + (row.distance_mi || 0)));
    const { data: profiles } = await sb.from('troll_profiles').select('id, username, avatar_url').in('id', userIds);
    return (profiles || [])
      .map((p) => ({
        id: p.id, username: p.username, avatarUrl: p.avatar_url,
        mileage: Math.round((mileageByUser.get(p.id) || 0) * 10) / 10,
        isMe: p.id === userId,
      }))
      .sort((a, b) => b.mileage - a.mileage);
  }

  // ── Comments (ported from src/lib/social/comments.ts) — used by Home's
  //    friend-activity cards, see buildFriendActivityItem above. ──
  async function listComments(activityId) {
    const sb = fitClient(); if (!sb) return [];
    try {
      const { data, error } = await sb.from('fit_comments').select('id, body, created_at, user_id').eq('activity_id', activityId).order('created_at', { ascending: true });
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) return [];
      const authorIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const profileMap = new Map((await profilesForIds(authorIds)).map((p) => [p.id, p]));
      return rows.map((r) => ({ id: r.id, body: r.body, createdAt: r.created_at, author: profileMap.get(r.user_id) || { id: r.user_id, username: 'runner', avatarUrl: null } }));
    } catch { return []; }
  }
  async function addComment(activityId, userId, body) {
    const trimmed = String(body || '').trim();
    if (!trimmed) return;
    const sb = fitClient(); if (!sb) throw new Error('Account service unavailable.');
    const { error } = await sb.from('fit_comments').insert({ activity_id: activityId, user_id: userId, body: trimmed.slice(0, 500) });
    if (error) throw error;
  }

  // ── Render: profile header ──
  function renderYouProfileHeader(user) {
    const card = document.getElementById('youProfileCard');
    const joined = user.joinedAt ? new Date(user.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null;
    card.innerHTML =
      '<div class="you-avatar" id="youAvatar"></div>' +
      '<div><p class="you-profile-name"></p><p class="you-profile-meta"></p></div>';
    const avatar = card.querySelector('#youAvatar');
    if (user.avatarUrl) {
      const img = document.createElement('img'); img.src = user.avatarUrl; img.alt = '';
      avatar.appendChild(img);
    } else {
      avatar.textContent = (user.username || '?').charAt(0).toUpperCase();
    }
    card.querySelector('.you-profile-name').textContent = user.username;
    card.querySelector('.you-profile-meta').textContent =
      'Level ' + (user.level || 1) + ' · ' + (user.xp || 0) + ' XP' + (joined ? ' · joined ' + joined : '');
  }

  // ── Render: badges ──
  function renderBadges(activities) {
    const card = document.getElementById('youBadgesCard');
    const badges = computeBadges(activities);
    const earned = badges.filter((b) => b.earned).length;
    card.innerHTML =
      '<div class="fit-head"><h3>Badges</h3><span class="fit-pill">' + earned + '/' + badges.length + '</span></div>' +
      '<div class="badges-grid"></div>';
    const grid = card.querySelector('.badges-grid');
    badges.forEach((b) => {
      const tile = document.createElement('div');
      tile.className = 'badge-tile' + (b.earned ? ' is-earned' : '');
      tile.title = b.label;
      tile.innerHTML = '<span class="badge-emoji" aria-hidden="true"></span><span class="badge-label"></span>';
      tile.querySelector('.badge-emoji').textContent = b.emoji;
      tile.querySelector('.badge-label').textContent = b.label;
      grid.appendChild(tile);
    });
  }

  // ── Render: humor toggle ──
  async function renderHumorToggle(userId) {
    const card = document.getElementById('youHumorCard');
    card.innerHTML =
      '<div class="humor-row">' +
      '<div><p class="fit-label">Troll humor</p><p class="desc" style="margin-top:2px;">Confetti, one-liners, and extra flair on celebrations. Turn off for a more no-nonsense tool.</p></div>' +
      '<button type="button" class="humor-switch" id="humorSwitch" aria-pressed="false" aria-label="Toggle troll humor"><span class="humor-thumb"></span></button>' +
      '</div>';
    const btn = document.getElementById('humorSwitch');
    let enabled = true;
    try { enabled = await getHumorEnabled(userId); } catch { enabled = true; }
    btn.setAttribute('aria-pressed', String(enabled));
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const next = btn.getAttribute('aria-pressed') !== 'true';
      try {
        await setHumorEnabled(userId, next);
        btn.setAttribute('aria-pressed', String(next));
        logHumor = next; // Log tab's celebration copy reads this same flag
      } catch { /* best effort — switch just won't flip if the write fails */ }
      finally { btn.disabled = false; }
    });
  }

  // ── Render: weekly leaderboard ──
  async function renderLeaderboard(userId) {
    const card = document.getElementById('youLeaderboardCard');
    card.innerHTML = '<p class="fit-label">Weekly leaderboard</p><p class="desc" style="margin-top:2px;">You + people you follow, running mileage this week.</p><div class="activity-list" id="lbRows" style="margin-top:10px;"></div>';
    const rowsWrap = document.getElementById('lbRows');
    let rows = [];
    try { rows = await weeklyLeaderboardRows(userId); } catch { rows = []; }
    if (rows.length <= 1) {
      rowsWrap.innerHTML = '<p class="desc">Follow people below to see a leaderboard here.</p>';
      return;
    }
    rowsWrap.innerHTML = '';
    rows.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row' + (r.isMe ? ' is-me' : '');
      row.innerHTML = '<span class="lb-rank"></span><span class="lb-name"></span><span class="lb-mileage"></span>';
      row.querySelector('.lb-rank').textContent = String(i + 1);
      row.querySelector('.lb-name').textContent = r.isMe ? 'You' : r.username;
      row.querySelector('.lb-mileage').textContent = r.mileage + ' mi';
      rowsWrap.appendChild(row);
    });
  }

  // ── Render: find people (search + following/followers) ──
  function buildPersonRow(person, following, userId, onToggled) {
    const row = document.createElement('div');
    row.className = 'person-row';
    row.innerHTML =
      '<span class="person-id"><span class="person-avatar"></span><span class="person-name"></span></span>' +
      '<button type="button" class="follow-btn"></button>';
    const avatar = row.querySelector('.person-avatar');
    if (person.avatarUrl) { const img = document.createElement('img'); img.src = person.avatarUrl; img.alt = ''; avatar.appendChild(img); }
    else avatar.textContent = (person.username || '?').charAt(0).toUpperCase();
    row.querySelector('.person-name').textContent = person.username || 'runner';
    const btn = row.querySelector('.follow-btn');
    function paint() { btn.classList.toggle('is-following', following); btn.textContent = following ? 'Following' : 'Follow'; }
    paint();
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        if (following) await unfollowUser(userId, person.id);
        else await followUser(userId, person.id);
        following = !following;
        paint();
        if (onToggled) onToggled();
      } catch { /* best effort */ }
      finally { btn.disabled = false; }
    });
    return row;
  }

  let youFollowingIds = new Set();
  async function refreshYouFollowLists(userId) {
    const grid = document.getElementById('youPeopleGrid');
    let following = [], followers = [];
    try { [following, followers] = await Promise.all([listFollowingProfiles(userId), listFollowerProfiles(userId)]); } catch { /* stays empty */ }
    youFollowingIds = new Set(following.map((p) => p.id));
    grid.innerHTML =
      '<div class="fit-card"><p class="fit-label">Following (' + following.length + ')</p><div class="you-people-list" id="youFollowingList" style="margin-top:8px;"></div></div>' +
      '<div class="fit-card"><p class="fit-label">Followers (' + followers.length + ')</p><div class="you-people-list" id="youFollowersList" style="margin-top:8px;"></div></div>';
    const followingWrap = document.getElementById('youFollowingList');
    const followersWrap = document.getElementById('youFollowersList');
    if (!following.length) followingWrap.innerHTML = '<p class="desc">Not following anyone yet.</p>';
    else following.forEach((p) => followingWrap.appendChild(buildPersonRow(p, true, userId, () => refreshYouSocial(userId))));
    if (!followers.length) followersWrap.innerHTML = '<p class="desc">No followers yet.</p>';
    else followers.forEach((p) => followersWrap.appendChild(buildPersonRow(p, youFollowingIds.has(p.id), userId, () => refreshYouSocial(userId))));
  }
  /** Re-paints everything that depends on the follow graph after a follow/unfollow. */
  async function refreshYouSocial(userId) {
    await Promise.all([refreshYouFollowLists(userId), renderLeaderboard(userId)]);
  }

  let youSearchWired = false;
  function wireYouSearch() {
    if (youSearchWired) return;
    youSearchWired = true;
    const input = document.getElementById('youSearchInput');
    const results = document.getElementById('youSearchResults');
    let debounceTimer = null;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = input.value.trim();
      if (!q) { results.innerHTML = ''; return; }
      debounceTimer = setTimeout(async () => {
        const user = fitUser(); if (!user) return;
        let people = [];
        try { people = await searchPeople(q, user.userId); } catch { people = []; }
        if (input.value.trim() !== q) return; // stale response
        results.innerHTML = '';
        if (!people.length) { results.innerHTML = '<p class="desc">No one found.</p>'; return; }
        people.forEach((p) => results.appendChild(buildPersonRow(p, youFollowingIds.has(p.id), user.userId, () => refreshYouSocial(user.userId))));
      }, 250);
    });
  }

  // ── Render: Analytics (Phase 6) — ported from src/components/analytics/
  //    analytics-section.tsx + weekly-trends.tsx. Real charts, not a stub:
  //    weekly mileage + weekly strength volume bars, a training-load (CTL/
  //    ATL/TSB) line trend, a PR history timeline (computePRTimeline is
  //    already ported above for badges), and all-time summary tiles. The
  //    original's week/month/year range toggle + custom date range isn't
  //    ported — a fixed last-8-weeks window covers the same ground without
  //    the extra UI surface; Home still gets the fast single-glance version
  //    (drawSparkline), this is the deep-dive. ──
  function allTimeSummary(activities) {
    const runs = activities.filter((a) => a.type === 'run');
    const strength = activities.filter((a) => a.type === 'strength');
    return {
      totalActivities: activities.length,
      totalMileage: Math.round(runs.reduce((s, a) => s + (a.distanceMi || 0), 0) * 10) / 10,
      runCount: runs.length,
      strengthCount: strength.length,
      longestRunMi: Math.max(0, ...runs.map((a) => a.distanceMi || 0)),
    };
  }
  /** Weekly CTL/ATL/TSB series for the last `weeks` weeks — reuses
   *  computeTrainingLoad(activities, asOf) (already ported for Home) by
   *  evaluating it as-of each week's end date. */
  function computeLoadTrend(activities, weeks) {
    weeks = weeks || 8;
    const thisWeekStart = homeStartOfWeek();
    const ctl = [], atl = [], tsb = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const weekEnd = new Date(thisWeekStart);
      weekEnd.setDate(weekEnd.getDate() - i * 7 + 6);
      const label = weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const load = computeTrainingLoad(activities, weekEnd);
      ctl.push({ label, value: load.ctl });
      atl.push({ label, value: load.atl });
      tsb.push({ label, value: load.tsb });
    }
    return { ctl, atl, tsb };
  }
  function renderPrTimeline(activities) {
    const wrap = document.getElementById('anPrList');
    const timeline = computePRTimeline(activities).slice(0, 15);
    if (!timeline.length) {
      wrap.innerHTML = '<p class="desc">No PRs yet — log strength sets with weight and reps to start tracking records.</p>';
      return;
    }
    const list = document.createElement('div');
    list.className = 'pr-timeline';
    timeline.forEach((pr) => {
      const row = document.createElement('div');
      row.className = 'pr-timeline-row';
      row.innerHTML =
        '<div><p class="pr-timeline-title"></p><p class="pr-timeline-date"></p></div><span class="pr-timeline-1rm"></span>';
      row.querySelector('.pr-timeline-title').textContent = '🏆 ' + pr.exercise + ' — ' + pr.weightLb + ' lb × ' + pr.reps;
      row.querySelector('.pr-timeline-date').textContent = new Date(pr.achievedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      row.querySelector('.pr-timeline-1rm').textContent = '~' + Math.round(pr.estOneRm) + ' lb 1RM';
      list.appendChild(row);
    });
    wrap.innerHTML = '';
    wrap.appendChild(list);
  }
  function renderYouAnalytics(activities) {
    const card = document.getElementById('youAnalyticsCard');
    const weeks = weeklyTrend(activities, 8);
    const summary = allTimeSummary(activities);
    card.innerHTML =
      '<p class="fit-label">Analytics</p>' +
      '<p class="desc" style="margin-top:2px;">Weekly volume, training load, and personal-record history.</p>' +
      '<div class="fit-charts-grid">' +
        '<div class="fit-card"><p class="fit-label">Weekly mileage</p><p class="desc" style="margin-top:2px;">Last 8 weeks, runs only</p>' +
          '<div class="fit-chart-wrap"><canvas class="fit-chart-canvas" id="anMileageChart" role="img" aria-label="Weekly mileage, last 8 weeks"></canvas></div>' +
        '</div>' +
        '<div class="fit-card"><p class="fit-label">Weekly strength volume</p><p class="desc" style="margin-top:2px;">Last 8 weeks, lb × reps</p>' +
          '<div class="fit-chart-wrap"><canvas class="fit-chart-canvas" id="anVolumeChart" role="img" aria-label="Weekly strength volume, last 8 weeks"></canvas></div>' +
        '</div>' +
      '</div>' +
      '<section class="fit-card" id="anLoadCard" style="margin-top:12px;">' +
        '<p class="fit-label">Training load — fitness, fatigue &amp; form</p>' +
        '<p class="desc" style="margin-top:2px;">CTL/ATL/TSB over the last 8 weeks — see Home for what these mean.</p>' +
        '<div class="fit-chart-wrap"><canvas class="fit-chart-canvas" id="anLoadChart" role="img" aria-label="Training load trend, last 8 weeks"></canvas></div>' +
      '</section>' +
      '<section aria-label="PR history" style="width:100%; margin-top:12px;">' +
        '<div class="fit-head"><h3>PR history</h3></div>' +
        '<div id="anPrList"></div>' +
      '</section>' +
      '<div class="stat-grid" style="margin-top:12px;">' +
        '<div class="stat-tile"><span class="stat-label">Total activities</span><span class="stat-value">' + summary.totalActivities + '</span></div>' +
        '<div class="stat-tile"><span class="stat-label">Total mileage</span><span class="stat-value">' + summary.totalMileage + ' mi</span></div>' +
        '<div class="stat-tile"><span class="stat-label">Longest run</span><span class="stat-value">' + summary.longestRunMi.toFixed(1) + ' mi</span></div>' +
        '<div class="stat-tile"><span class="stat-label">Strength sessions</span><span class="stat-value">' + summary.strengthCount + '</span></div>' +
      '</div>';

    const mileagePoints = weeks.map((w) => ({ label: w.label, value: w.mileage }));
    const volumePoints = weeks.map((w) => ({ label: w.label, value: w.volume }));
    const mileageCanvas = document.getElementById('anMileageChart');
    const volumeCanvas = document.getElementById('anVolumeChart');
    drawBarChart(mileageCanvas, mileagePoints, { color: FIT_CHART_COLORS.accent });
    drawBarChart(volumeCanvas, volumePoints, { color: FIT_CHART_COLORS.green });
    appendChartTable(mileageCanvas.closest('.fit-card'), ['Week', 'Mileage (mi)'], mileagePoints.map((p) => [p.label, p.value]));
    appendChartTable(volumeCanvas.closest('.fit-card'), ['Week', 'Volume (lb×reps)'], volumePoints.map((p) => [p.label, p.value]));

    const load = computeLoadTrend(activities, 8);
    const loadSeries = [
      { label: 'Fitness (CTL)', color: FIT_CHART_COLORS.accent, points: load.ctl },
      { label: 'Fatigue (ATL)', color: FIT_CHART_COLORS.indigo, points: load.atl },
      { label: 'Form (TSB)', color: FIT_CHART_COLORS.green, points: load.tsb },
    ];
    const loadCanvas = document.getElementById('anLoadChart');
    drawLineChart(loadCanvas, loadSeries);
    const loadCard = document.getElementById('anLoadCard');
    appendChartLegend(loadCard, loadSeries);
    appendChartTable(loadCard, ['Week', 'Fitness (CTL)', 'Fatigue (ATL)', 'Form (TSB)'],
      load.ctl.map((p, i) => [p.label, load.ctl[i].value, load.atl[i].value, load.tsb[i].value]));

    renderPrTimeline(activities);
  }

  const you = {};
  function initYou() {
    you.signedOut = document.getElementById('youSignedOut');
    you.body = document.getElementById('youBody');
    you.signinBtn = document.getElementById('youSigninBtn');
    if (!you.body) return;
    you.signinBtn.addEventListener('click', () => document.getElementById('btn-signin').click());
    const signoutBtn = document.getElementById('youSignoutBtn');
    if (signoutBtn) signoutBtn.addEventListener('click', () => { window.TrollrunnerAccounts && window.TrollrunnerAccounts.logout && window.TrollrunnerAccounts.logout(); });
    wireYouSearch();
  }

  async function refreshYou() {
    if (!you.body) return;
    const user = fitUser();
    if (!user) {
      you.signedOut.hidden = false;
      you.body.hidden = true;
      return;
    }
    you.signedOut.hidden = true;
    you.body.hidden = false;

    renderYouProfileHeader(user);
    refreshYouOnboardingCard(user).catch(() => {});

    let activities = [];
    try { activities = await listActivities(user.userId, 1000); } catch { activities = []; }
    renderBadges(activities);
    renderYouAnalytics(activities);

    renderHumorToggle(user.userId).catch(() => {});
    await refreshYouFollowLists(user.userId);
    renderLeaderboard(user.userId).catch(() => {});
  }

  /* ==========================================================================
     COACH (Phase 7) — ported from src/app/coach/coach-client.tsx (chat UI
     only — the training-status/predictions/plan/nutrition cards further up
     that file live on Home per Phase 3's own comment, so they're not
     duplicated here), src/components/coach/coach-chat.tsx,
     src/lib/coach-chat/{embeddings,retrieval,answer-library,learned-answers,
     context}.ts, src/lib/coach/race-predictor.ts and src/lib/nutrition/*.

     No server route exists in this static-site port (the original's
     /api/coach-chat/route.ts ran findAnswer() server-side), so all of that
     — building CoachFacts, embedding + matching, queueing unmatched
     questions — runs client-side here instead, through fitClient()/
     fitUser() like everything else, respecting the RLS policies already
     defined in fit_schema.sql §7 (fit_coach_questions, fit_coach_learned_
     answers). Nothing here needed a new Supabase client.
     ========================================================================== */

  // Matches fit_schema.sql §7's hardcoded RLS check (username = 'troll_runner')
  // exactly, rather than reusing index.html's isAdminViewer()/troll_is_admin()
  // RPC — that RPC checks a *different* admin table (troll_admins, see
  // troll_admin_lockdown.sql) that troll_runner is only optionally added to.
  // The actual security boundary for the coach queue is the username check
  // baked into the RLS policies, so the UI gate mirrors that exact check
  // (same as the original app's COACH_ADMIN_USERNAME env var) instead of a
  // different admin flag that could drift out of sync with it.
  const COACH_ADMIN_USERNAME = 'troll_runner';

  // ── Race predictions (ported from src/lib/coach/race-predictor.ts) ──
  const COACH_RACE_DISTANCES = [
    { key: '5K', mi: 3.107 },
    { key: '10K', mi: 6.214 },
    { key: 'Half marathon', mi: 13.109 },
    { key: 'Marathon', mi: 26.219 },
  ];
  function coachRiegel(fromMi, fromSec, toMi) { return fromSec * Math.pow(toMi / fromMi, 1.06); }
  function coachFormatPace(secPerMi) {
    const m = Math.floor(secPerMi / 60), s = Math.round(secPerMi % 60);
    return m + ':' + String(s).padStart(2, '0') + '/mi';
  }
  function coachBestReferenceRun(activities) {
    const cutoff = Date.now() - 120 * 24 * 60 * 60 * 1000;
    const candidates = activities.filter((a) => a.type === 'run' && a.distanceMi && a.distanceMi >= 1 && a.durationSec && new Date(a.occurredAt).getTime() >= cutoff);
    if (!candidates.length) return null;
    const best = candidates.reduce((a, b) => (a.durationSec / a.distanceMi < b.durationSec / b.distanceMi ? a : b));
    return { mi: best.distanceMi, sec: best.durationSec };
  }
  function predictRaceTimes(activities) {
    const ref = coachBestReferenceRun(activities);
    if (!ref) return null;
    return COACH_RACE_DISTANCES.map((d) => {
      const timeSec = coachRiegel(ref.mi, ref.sec, d.mi);
      return { label: d.key, timeSec: Math.round(timeSec), pace: coachFormatPace(timeSec / d.mi) };
    });
  }

  // ── Nutrition (ported from src/lib/nutrition/{targets,profile,education}.ts) ──
  async function getBodyProfile(userId) {
    const empty = { age: null, sex: null, heightCm: null, weightKg: null };
    const sb = fitClient(); if (!sb) return empty;
    try {
      const { data } = await sb.from('fit_profiles').select('age, sex, height_cm, weight_kg').eq('user_id', userId).maybeSingle();
      if (!data) return empty;
      return { age: data.age, sex: data.sex, heightCm: data.height_cm, weightKg: data.weight_kg };
    } catch { return empty; }
  }
  function coachBmr(p) {
    if (!p.age || !p.heightCm || !p.weightKg) return null;
    const male = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + 5;
    const female = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age - 161;
    const s = String(p.sex || '').trim().toLowerCase();
    if (s.indexOf('m') === 0) return male;
    if (s.indexOf('f') === 0) return female;
    return (male + female) / 2;
  }
  function coachActivityMultiplier(sessionsPerWeek) {
    if (sessionsPerWeek >= 6) return 1.725;
    if (sessionsPerWeek >= 4) return 1.55;
    if (sessionsPerWeek >= 2) return 1.375;
    return 1.2;
  }
  const COACH_MUSCLE_GOALS = ['Gain muscle', 'Hypertrophy', 'Strength'];
  const COACH_CUT_GOALS = ['Lose weight', 'Body recomposition'];
  const COACH_ENDURANCE_GOALS = ['Run first 5K', 'Run first half marathon', 'Run first marathon', 'Boston qualifier', 'Sub-3 marathon', 'Ultra marathon', 'Ironman', 'Increase endurance'];
  function computeNutritionTargets(profile, goals, sessionsPerWeek) {
    const base = coachBmr(profile);
    const weightKg = profile.weightKg != null ? profile.weightKg : 70;
    if (base === null) {
      const proteinG = Math.round(weightKg * 1.8);
      return {
        calories: Math.round(weightKg * 30), proteinG,
        carbsG: Math.round((weightKg * 30 * 0.45) / 4), fatG: Math.round((weightKg * 30 * 0.25) / 9),
        waterOz: Math.round((weightKg * 2.2) / 2), hasFullProfile: false,
      };
    }
    const tdee = base * coachActivityMultiplier(sessionsPerWeek);
    let calories = tdee;
    if (goals.some((g) => COACH_CUT_GOALS.indexOf(g) !== -1)) calories -= 500;
    else if (goals.some((g) => COACH_MUSCLE_GOALS.indexOf(g) !== -1)) calories += 300;
    const proteinPerKg = goals.some((g) => COACH_MUSCLE_GOALS.indexOf(g) !== -1 || COACH_CUT_GOALS.indexOf(g) !== -1) ? 2.0
      : goals.some((g) => COACH_ENDURANCE_GOALS.indexOf(g) !== -1) ? 1.4 : 1.6;
    const proteinG = Math.round(weightKg * proteinPerKg);
    const fatG = Math.round((calories * 0.25) / 9);
    const carbCalories = calories - proteinG * 4 - fatG * 9;
    const carbsG = Math.round(Math.max(carbCalories, 0) / 4);
    return { calories: Math.round(calories), proteinG, carbsG, fatG, waterOz: Math.round((weightKg * 2.2) / 2 + sessionsPerWeek * 6), hasFullProfile: true };
  }
  function preWorkoutTips() {
    return [
      'Eat a carb-focused meal 2-3 hours before training, or a small snack 30-60 min before if that\'s all the time you have.',
      'Keep pre-workout food low in fat and fiber to avoid GI issues, especially before running.',
      'Sip water in the hours leading up to training rather than chugging right before.',
    ];
  }
  function postWorkoutTips(workoutType) {
    const common = [
      'Aim for protein + carbs within about 2 hours after training — the exact minute doesn\'t matter as much as getting there.',
      'Rehydrate with water; add electrolytes if the session was long or sweaty.',
    ];
    if (workoutType === 'Long run' || workoutType === 'Race / long run') return ['Long runs deplete glycogen the most — prioritize carbs in the next meal, not just protein.'].concat(common);
    if (workoutType && /rest/i.test(workoutType)) return ['Rest day — eat at your target calories and lean slightly more on protein to support recovery.'];
    return common;
  }
  function raceFuelingTips(raceDistanceMi) {
    if (raceDistanceMi === null) return ['Set a race goal with a target distance (from onboarding or the Coach tab) to get distance-specific fueling guidance here.'];
    if (raceDistanceMi <= 3.2) return ['5K-distance efforts don\'t need mid-race fueling — a light pre-race snack 1-2 hours out is plenty.', 'Don\'t experiment with anything new on race morning.'];
    if (raceDistanceMi <= 6.3) return ['10K is still short enough that fueling during the race is optional for most runners.', 'A carb-focused dinner the night before helps top off glycogen.'];
    if (raceDistanceMi <= 13.2) return ['Consider one gel or carb source around 45-60 minutes in for a half marathon.', 'Practice your exact race-morning breakfast on a long training run first.'];
    return ['Marathon+ distances: plan 30-60g of carbs per hour once you\'re past the first 45 minutes.', 'Carb-load for 1-2 days before the race by shifting toward more carbs, not necessarily more calories.', 'Rehearse your full fueling plan (gels/chews/drink) on at least one long run — race day is not the place to test it.'];
  }
  function supplementNotes() {
    return [
      'Creatine monohydrate (3-5g/day) has the strongest evidence base for strength/power support — consistent daily use matters more than timing.',
      'A protein supplement is just a convenient way to hit your protein target, not a requirement — whole food works the same if you prefer it.',
      'Electrolytes matter most for sessions over ~90 minutes or in heat — plain water is fine for shorter, easier efforts.',
      'This is general education, not a prescription — check with a doctor before starting any supplement, especially with existing medical conditions.',
    ];
  }

  // interpretLoad()/interpretRecoveryScore() above (Home, Phase 3) return
  // {label, why}/{label} without a "tone" — Home's own UI doesn't need one.
  // The ported answer-library render() functions do (rest_day_question), so
  // it's derived here from the same label text rather than editing those
  // Home functions (out of scope for this phase).
  function coachLoadTone(label) {
    if (label === 'Overreaching' || label === 'Fatigued') return 'critical';
    if (label === 'Ramping up fast') return 'warning';
    return 'good';
  }
  function coachRecoveryTone(label) {
    if (label === 'Poor') return 'critical';
    if (label === 'Fair') return 'warning';
    return 'good';
  }

  // ── CoachFacts (ported from src/lib/coach-chat/context.ts buildCoachFacts) ──
  async function buildCoachFacts(userId) {
    const results = await Promise.all([
      listActivities(userId, 200).catch(() => []),
      getGoals(userId),
      getOnboardingWeeklyMileage(userId),
      listRecentRecovery(userId, 7),
      getBodyProfile(userId),
    ]);
    const activities = results[0], goals = results[1], onboardingMileage = results[2], recovery = results[3], bodyProfile = results[4];

    const load = computeTrainingLoad(activities);
    const loadStatusRaw = interpretLoad(load);
    const loadStatus = { label: loadStatusRaw.label, why: loadStatusRaw.why, tone: coachLoadTone(loadStatusRaw.label) };
    const predictions = predictRaceTimes(activities);
    const recoveryScore = averageRecentScore(recovery, 7);
    const recoveryStatusRaw = interpretRecoveryScore(recoveryScore);
    const recoveryStatus = { label: recoveryStatusRaw.label, tone: coachRecoveryTone(recoveryStatusRaw.label) };

    const recentWeeks = weeklyTrend(activities, 4);
    const loggedAvg = recentWeeks.reduce((s, w) => s + w.mileage, 0) / (recentWeeks.length || 1);
    const baseline = loggedAvg > 0 ? loggedAvg : onboardingMileage;
    const raceGoal = primaryRaceGoal(goals);
    const plan = generateWeekPlan({
      goalLabel: raceGoal ? raceGoal.goal_key : null,
      targetDate: raceGoal ? raceGoal.target_date : null,
      baselineWeeklyMileage: baseline,
      recoveryMultiplier: recoveryLoadMultiplier(recoveryScore),
    });
    const raceDistanceMi = raceGoal ? (GOAL_DISTANCE_MI[raceGoal.goal_key] || null) : null;
    const todayPlan = plan.days.find((d) => d.day === todayDayLabel()) || null;

    const sessionsPerWeek = activities.filter((a) => new Date(a.occurredAt).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000).length;
    const nutrition = computeNutritionTargets(bodyProfile, goals.map((g) => g.goal_key), sessionsPerWeek);

    return {
      goals: goals.map((g) => g.goal_key),
      weeklyMileage: weeklyMileage(activities),
      streak: currentStreak(activities),
      load: load, loadStatus: loadStatus, predictions: predictions,
      recoveryScore: recoveryScore, recoveryStatus: recoveryStatus,
      plan: plan, raceDistanceMi: raceDistanceMi,
      todayWorkout: todayPlan ? { type: todayPlan.type, detail: todayPlan.detail } : null,
      nutrition: nutrition,
      recentActivities: activities.slice(0, 8).map((a) => ({ type: a.type, title: a.title, date: new Date(a.occurredAt).toLocaleDateString() })),
    };
  }

  /* ── Client-side embeddings (ported from src/lib/coach-chat/embeddings.ts) ──
     @huggingface/transformers runs the Xenova/all-MiniLM-L6-v2 embedding
     model entirely in-browser via WASM/ONNX — same library the original app
     used, just client-side instead of server-side (there's no server here).
     Loaded lazily via dynamic import() (works fine from this classic
     script — no <script type="module"> conversion needed) only once the
     Coach tab is opened by a signed-in user, and cached: transformers.js
     itself caches downloaded model weights via the browser's Cache API, so
     repeat visits don't re-download. numThreads is forced to 1 because
     multi-threaded WASM needs SharedArrayBuffer, which needs COOP/COEP
     response headers GitHub Pages doesn't send — single-threaded is plenty
     fast for embedding one short sentence at a time. See fitness.html's CSP
     comment for exactly which new hosts this required and why. */
  const COACH_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
  const COACH_TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm';
  let coachExtractorPromise = null;
  let coachModelFailed = false;
  function coachGetExtractor() {
    if (coachModelFailed) return Promise.reject(new Error('Coach model previously failed to load.'));
    if (!coachExtractorPromise) {
      coachExtractorPromise = Promise.resolve()
        .then(() => import(/* webpackIgnore: true */ COACH_TRANSFORMERS_CDN))
        .then((mod) => {
          try { mod.env.backends.onnx.wasm.numThreads = 1; } catch { /* older/newer builds may nest this differently — non-fatal */ }
          return mod.pipeline('feature-extraction', COACH_MODEL_ID);
        })
        .catch((err) => { coachModelFailed = true; coachExtractorPromise = null; throw err; });
    }
    return coachExtractorPromise;
  }
  async function coachEmbedText(text) {
    const extractor = await coachGetExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return output.data;
  }
  function coachCosineSimilarity(a, b) {
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot; // both vectors already normalize:true above, so dot product alone is cosine similarity
  }

  /* ── Answer library (ported 1:1 from src/lib/coach-chat/answer-library.ts).
     tier/sources metadata from the original dropped — nothing in this port's
     UI displays them (the original UI doesn't either; they're bookkeeping
     for whoever maintains the library), so keeping only what retrieval.ts
     and the chat UI actually use: id (unused but kept for readability),
     topic, samples, render. Every render() string is unchanged. ── */
  const COACH_MEDICAL_DISCLAIMER = 'This is educational fitness coaching, not medical advice — if that sounds like pain, an injury, or a health condition, see a doctor rather than pushing through it.';
  const COACH_ANSWER_LIBRARY = [
    { id: 'training_load_status', topic: 'training_load', samples: ['how is my training going', "what's my training status", 'am I overtraining', "how's my fitness right now"],
      render: (f) => `Your training status is "${f.loadStatus.label}". ${f.loadStatus.why} Right now: Fitness (CTL) ${f.load.ctl}, Fatigue (ATL) ${f.load.atl}, Form (TSB) ${f.load.tsb}.` },
    { id: 'training_load_explain', topic: 'training_load', samples: ['what do CTL ATL TSB mean', 'explain fitness fatigue form', 'what is training load'],
      render: (f) => `CTL (Fitness) is your 42-day rolling training load. ATL (Fatigue) is the same idea over 7 days. TSB (Form) is CTL minus ATL: positive means fresh, negative means carrying fatigue. Yours right now: CTL ${f.load.ctl}, ATL ${f.load.atl}, TSB ${f.load.tsb}.` },
    { id: 'recovery_score', topic: 'recovery', samples: ["how's my recovery", 'why is my recovery score low', 'am I recovered'],
      render: (f) => f.recoveryScore !== null ? `Your 7-day recovery average is ${f.recoveryScore}/100 ("${f.recoveryStatus.label}"), built from sleep, soreness, and stress from your daily check-ins.` : "You haven't logged a recovery check-in yet — do one on the Home tab and I can tell you how you're trending." },
    { id: 'plan_this_week', topic: 'plan', samples: ["what's this week's plan", 'what should I do today', "what's my workout"],
      render: (f) => `This week you're in the "${f.plan.phase}" phase, targeting ${f.plan.targetMileage} mi.${f.plan.recoveryNote ? ' ' + f.plan.recoveryNote : ''}${f.todayWorkout ? ' Today: ' + f.todayWorkout.type + ' — ' + f.todayWorkout.detail + '.' : ''}` },
    { id: 'plan_phase_explain', topic: 'plan', samples: ['why am I in this training phase', 'what does base build peak taper mean', 'why does the plan look this way'],
      render: (f) => `${f.plan.phaseWhy} That's why this week targets ${f.plan.targetMileage} mi.` },
    { id: 'race_predictions', topic: 'race', samples: ["what's my race time prediction", 'how fast could I race right now', 'predict my marathon time'],
      render: (f) => f.predictions ? `Based on your recent training: ${f.predictions.map((p) => p.label + ' ~' + p.pace).join(', ')}.` : 'Log a timed run (distance + duration) and I can predict your race times using the Riegel formula.' },
    { id: 'nutrition_targets', topic: 'nutrition_personal', samples: ['what should I eat', 'what are my macros', 'how many calories should I eat'],
      render: (f) => `Your targets: ${f.nutrition.calories} kcal, ${f.nutrition.proteinG}g protein, ${f.nutrition.carbsG}g carbs, ${f.nutrition.fatG}g fat, and about ${f.nutrition.waterOz} oz of water a day.${f.nutrition.hasFullProfile ? '' : ' These are weight-based estimates — add your age, sex, height, and weight in onboarding for more precise numbers.'}` },
    { id: 'plateau_explain', topic: 'training_load', samples: ['why am I plateauing', 'why am I not improving', 'why does my training feel stuck'],
      render: (f) => `Your Form (TSB) is ${f.load.tsb} and status is "${f.loadStatus.label}". ${f.loadStatus.why} A plateau is usually either not enough stimulus (TSB staying high, load flat) or too much fatigue masking fitness gains (TSB very negative) — check which one matches before changing anything drastic.` },
    { id: 'mileage_progress', topic: 'plan', samples: ['how many miles have I run this week', "what's my weekly mileage"],
      render: (f) => `You're at ${f.weeklyMileage.toFixed(1)} mi this week, targeting ${f.plan.targetMileage} mi.` },
    { id: 'streak', topic: 'misc', samples: ["what's my streak", 'how many days have I logged in a row'],
      render: (f) => `You're on a ${f.streak}-day logging streak.` },
    { id: 'goals', topic: 'plan', samples: ['what are my goals', 'what am I training for'],
      render: (f) => f.goals.length ? `Your current goal(s): ${f.goals.join(', ')}.` : 'You haven\'t set a race goal yet — add one in onboarding or your profile to unlock phase-based planning and race predictions.' },
    { id: 'rest_day_question', topic: 'recovery', samples: ['should I take a rest day', "should I skip today's workout", 'am I too tired to train'],
      render: (f) => `Form (TSB) is ${f.load.tsb} and recovery is "${f.recoveryStatus.label}"${f.recoveryScore !== null ? ' (' + f.recoveryScore + '/100)' : ''}. ${(f.loadStatus.tone === 'critical' || f.recoveryStatus.tone === 'critical') ? 'Both signals lean toward taking it easy or resting today.' : 'Nothing here says you need to rest, but listen to how your body actually feels.'}` },
    { id: 'hydration', topic: 'nutrition_general', samples: ['how much water should I drink day to day'],
      render: (f) => `Target about ${f.nutrition.waterOz} oz/day, scaled up on training days.` },
    { id: 'how_to_checkin', topic: 'misc', samples: ['how do I log a check-in', 'where do I log sleep and soreness'],
      render: () => 'Log your daily check-in (sleep, soreness, stress) on the Home tab — it takes a few seconds and unlocks your recovery score here.' },
    { id: 'how_to_log_activity', topic: 'misc', samples: ['how do I log a run', 'where do I log a workout'],
      render: () => 'Log activities from the Log tab — distance, duration, and effort for runs, or sets/reps for strength work.' },
    { id: 'greeting', topic: 'misc', samples: ['hi', 'hello', 'what can you help with', 'what can you do'],
      render: (f) => `Hey${f.goals.length ? '' : ' runner'}! Ask about your training load, recovery, this week's plan, nutrition, race science, or training myths — I'll answer from your data or from sourced research. ${COACH_MEDICAL_DISCLAIMER}` },
    { id: 'polarized_training', topic: 'training_science', samples: ['should I do most of my runs easy', "what's the 80/20 rule", 'how should I split easy vs hard runs'],
      render: () => "Research on 'polarized' training (~80% easy, ~20% hard) generally shows it works well for endurance gains, and elite distance runners tend toward polarized or pyramidal intensity distributions rather than threshold-heavy ones. That said, at least one study found a different, more focused-endurance approach did just as well or better — so treat 80/20 as a solid default, not a rigid law." },
    { id: 'strike_pattern', topic: 'training_science', samples: ['should I switch to forefoot striking', 'is heel striking bad for me', 'what running form is best'],
      render: () => "No strike pattern is universally safer — heel striking shifts load toward the knee, forefoot striking shifts it toward the ankle/Achilles/calf. If you're an uninjured heel striker, there's no proven benefit to switching, and uninformed switches during the adaptation period have been linked to more injuries, not fewer." },
    { id: 'stretching_myth', topic: 'training_science', samples: ['does stretching before a run prevent injury', 'should I stretch before running'],
      render: () => "Static stretching before a run doesn't reduce injury risk in controlled trials, and holding a stretch too long beforehand can temporarily reduce power and speed for up to about an hour. A dynamic warm-up (leg swings, drills) doesn't carry that cost and may help running economy — save static stretching for after." },
    { id: 'strength_running_economy', topic: 'training_science', samples: ['does lifting weights make me a faster runner', 'does strength training help running economy'],
      render: () => 'Yes — a 2024 meta-analysis found strength training (heavy loads, plyometrics, or both), done 2-3x/week for 8-12 weeks, meaningfully improves running economy in middle- and long-distance runners. Plyometrics helped more at slower speeds; heavy/combined lifting helped across a range of speeds.' },
    { id: 'strength_injury_prevention', topic: 'training_science', samples: ['does strength training prevent running injuries', 'will lifting keep me from getting hurt'],
      render: () => "This one's less settled than the running-economy benefit. It's plausible that strengthening tendons/bone reduces overuse injury, but a systematic review of injury-prevention conditioning programs didn't find consistent, clear evidence that it lowers running-injury risk directly. Worth doing for the performance benefit; don't count on it as injury insurance." },
    { id: 'interference_effect', topic: 'training_science', samples: ['will lifting hurt my endurance gains', 'does strength training interfere with running gains'],
      render: () => "Less than commonly believed. Recent meta-analyses (covering 40+ studies) find concurrent strength+endurance training doesn't meaningfully hurt strength or hypertrophy gains — the 'interference effect' shows up mainly in explosive/power output, not general strength. If your goals are strength and endurance together, you can train both without much tradeoff." },
    { id: 'overtraining_signs', topic: 'training_science', samples: ['what are the signs of overtraining', "how do I know if I'm overtraining vs just tired"],
      render: () => "There's no single blood test for overtraining — it's diagnosed by ruling other things out. Watch for a cluster: performance decline despite training, persistent fatigue, elevated resting heart rate, mood changes (irritability, low motivation), disrupted sleep, and getting sick more often. If several show up together over weeks, that's worth backing off for, not pushing through." },
    { id: 'acwr_explain', topic: 'training_science', samples: ['how much can I safely increase my training', "what's a safe way to ramp up mileage"],
      render: () => "Sudden jumps in training load relative to your recent baseline are linked to higher injury risk — that part is well supported. The specific 'ACWR' ratio numbers (like 1.0-1.5) you'll see quoted online are more folklore than precise science; sports scientists have criticized the math behind them. Safer takeaway: avoid big spikes, not a magic ratio." },
    { id: 'ten_percent_rule', topic: 'training_science', samples: ['is the 10 percent rule real', 'how much should I increase my weekly mileage'],
      render: () => "The classic 'never increase weekly mileage more than 10%' rule has no solid evidence behind it — a controlled comparison found no injury-rate difference between runners who followed it and those who didn't. A newer, more specific finding suggests the real risk factor is a big jump in your single longest run, not your weekly total — so be more cautious about sudden long-run jumps than weekly mileage math." },
    { id: 'red_s', topic: 'training_science', samples: ['what is RED-S', 'am I at risk of energy deficiency', 'am I eating enough for how much I train'],
      render: () => 'RED-S (Relative Energy Deficiency in Sport) happens when you eat too little relative to how much you train, and it can affect hormones, bone health, immunity, and mood — not just performance. Endurance athletes and anyone restricting food while training heavily are most at risk. If your periods have changed, you\'re getting sick often, or bone-stress injuries keep happening, that\'s worth discussing with a doctor.' },
    { id: 'injury_stats', topic: 'training_science', samples: ['how common are running injuries', 'is it normal to get injured from running'],
      render: () => 'More common than people assume — roughly 4 in 10 runners experience an injury in a given period, and new runners get hurt more than experienced ones. About 80% of running injuries are overuse (gradual load exceeding what tissue can handle) rather than acute trauma, most often at the knee, lower leg, or ankle/foot. Getting hurt doesn\'t mean you did something uniquely wrong.' },
    { id: 'exercise_mental_health', topic: 'mental_health', samples: ['does running help with anxiety or depression', 'does exercise help my mood'],
      render: () => 'Strongly, yes — one of the best-supported findings in exercise science. A large umbrella review found exercise produces meaningful reductions in depression, anxiety, and psychological distress, matching or exceeding medication/therapy in some comparisons. Group or supervised exercise tends to help depression most; shorter, lower-intensity sessions tend to help anxiety most.' },
    { id: 'exercise_addiction', topic: 'mental_health', samples: ['can you overdo exercise', 'is exercise addiction real', 'am I addicted to training'],
      render: () => "It's a real, documented phenomenon, more common in competitive/endurance athletes than recreational ones — exact prevalence numbers vary a lot by study. Watch for training that continues despite injury or cost to relationships/work, and distress when you can't train. If that sounds familiar, it's worth talking to someone." },
    { id: 'carb_loading', topic: 'nutrition_general', samples: ['should I carb load before a race', 'do I need to load carbs before my marathon'],
      render: () => 'Worth it for events over about 90 minutes — loading up on carbs (roughly 10-12g/kg bodyweight/day) for 36-48 hours before maximizes glycogen stores. For shorter races the benefit is less clear; one study found extra glycogen from loading didn\'t actually improve half-marathon performance.' },
    { id: 'protein_timing_myth', topic: 'nutrition_general', samples: ['do I need to eat protein right after my workout', 'is there an anabolic window'],
      render: () => "The strict 30-60 minute 'anabolic window' is a myth in its common form — a meta-analysis of 65 trials found protein timing didn't matter once total daily protein intake was accounted for. The real window is several hours wide, especially if you ate a meal a few hours before training. Hit your daily protein target; don't stress about the clock." },
    { id: 'hyponatremia', topic: 'nutrition_general', samples: ['how much water should I drink during a long run', 'am I drinking too much water on race day'],
      render: () => 'Overhydration is the underrated danger on race day, not dehydration — drinking beyond thirst has caused fatal cases of hyponatremia (dangerously diluted blood sodium) in marathoners. Drink to thirst rather than a fixed schedule, and add sodium on runs over ~90 minutes.' },
    { id: 'creatine', topic: 'nutrition_general', samples: ['should I take creatine', 'does creatine help running'],
      render: () => "Creatine monohydrate is the most well-evidenced supplement for strength/power and is well established as safe for long-term use. For endurance running specifically, its benefit is most plausible for the high-intensity surges in a race (sprint finishes, hills) rather than steady aerobic pace — that endurance-specific benefit is a newer, smaller evidence base than the strength-sport one." },
    { id: 'bcaa', topic: 'nutrition_general', samples: ['should I take BCAAs'],
      render: () => "Not much benefit if your protein intake is already adequate. Complete-protein supplementation produces roughly double the muscle-building response of BCAAs alone, since BCAAs are missing several essential amino acids. There's modest evidence BCAAs reduce soreness, but that's a smaller effect than just getting enough total protein." },
    { id: 'beet_juice', topic: 'nutrition_general', samples: ['does beet juice make me run faster', 'does nitrate help running performance'],
      render: () => 'Mixed evidence depending on the effort type. Beetroot/nitrate helps some high-intensity, short-effort metrics, but for actual race times the picture is inconsistent — one 10K study found a faster first half but no overall time improvement. Worth experimenting with in training, not something to bank on for a PR.' },
    { id: 'supplements_general', topic: 'nutrition_general', samples: ['should I take supplements', 'what supplements help running'],
      render: () => supplementNotes().join(' ') },
    { id: 'ice_bath', topic: 'recovery_science', samples: ['do ice baths help recovery', 'should I do cold water immersion'],
      render: () => 'Cold water immersion reliably reduces muscle soreness and a blood marker of muscle damage compared to just resting, especially after hard or eccentric-heavy sessions. It doesn\'t do much for strength, and can actually blunt explosive power right afterward — so avoid it right before a power-focused session.' },
    { id: 'foam_rolling', topic: 'recovery_science', samples: ['is foam rolling worth it', 'does foam rolling help performance'],
      render: () => 'It genuinely reduces soreness, especially 2-3 days after a hard session — that part is well supported. Evidence that it improves actual performance (strength, jump, agility) is much weaker. Treat it as a comfort tool, not a performance enhancer.' },
    { id: 'sleep_matters', topic: 'recovery_science', samples: ['does sleep actually matter for training', 'how important is sleep for recovery'],
      render: () => 'One of the most consistently supported recovery factors there is. Insufficient sleep is linked to worse endurance/strength, slower glycogen replenishment, and higher injury risk, while sleep-extension studies have directly improved athletes\' performance metrics. If you\'re optimizing one thing for recovery, sleep is a strong first choice.' },
    { id: 'injury_pain', topic: 'medical', samples: ['my knee hurts', 'I have pain when I run', 'is this injury serious', 'should I run through pain'],
      render: () => `I can't assess pain or injuries — ${COACH_MEDICAL_DISCLAIMER} If it's mild soreness rather than pain, logging it in your daily check-in helps the plan adjust.` },
    { id: 'cardiac_screening', topic: 'medical', samples: ['should I get my heart checked before training hard', 'how do I know if it\'s safe to train intensely', 'what cardiac screening should athletes get'],
      render: () => `Before ramping up serious training, it's worth doing the standard pre-participation check the AHA recommends for every athlete: personal cardiac history, a physical exam (blood pressure, resting heart rate, heart murmur check), and a detailed family history — specifically, has anyone in your family died suddenly and unexpectedly before age 50, or been diagnosed with a heart condition young. Any yes there is worth a conversation with a doctor before pushing hard efforts. ${COACH_MEDICAL_DISCLAIMER}` },
    { id: 'sudden_cardiac_death_context', topic: 'medical', samples: ['how risky is sudden cardiac death for athletes', 'can intense exercise cause a heart attack'],
      render: () => 'In absolute terms it\'s rare — roughly 1-2 per 100,000 athlete-years in young competitive athletes. It\'s the leading cause of death during sport in that age group, which is why the family-history and screening questions matter, but it shouldn\'t be a reason to avoid training for the vast majority of people.' },
    { id: 'sickle_cell_trait', topic: 'medical', samples: ['what is sickle cell trait', 'does sickle cell trait affect exercise', 'am I at risk from sickle cell trait'],
      render: () => `Sickle cell trait is more common in people with ancestry from regions with a history of malaria — parts of Africa, the Mediterranean, the Middle East, and South Asia — but it isn't tied to any single ethnicity, and most carriers train normally without issue. Under extreme, sustained exertion (hard conditioning sessions, heat, altitude) it carries a rare but serious risk, so if you know you carry the trait, pace hard efforts, hydrate, and stop immediately at any unusual cramping or weakness. If you don't know your status and want to, that's a conversation for your doctor, not something this app can determine. ${COACH_MEDICAL_DISCLAIMER}` },
    { id: 'vitamin_d', topic: 'medical', samples: ['should I worry about vitamin D', 'do I need a vitamin D supplement'],
      render: () => 'Skin with more melanin needs more sun exposure to make the same amount of vitamin D, and training mostly indoors, at higher latitudes, or through winter adds to that. Low vitamin D matters for bone health and possibly muscle function. If any of that sounds like you, ask your doctor about a simple blood test before starting a supplement.' },
    { id: 'lactose_sensitivity', topic: 'medical', samples: ['why does dairy bother my stomach after workouts', 'should I avoid dairy for recovery nutrition'],
      render: () => 'Lactase non-persistence (trouble digesting dairy sugar) is genetically more common in people with East Asian, African, Mediterranean, or Jewish ancestry, and less common in those with Northern European ancestry — though plenty of individual variation exists either way. If dairy-heavy recovery shakes/meals give you GI issues, that\'s worth trying lactose-free alternatives rather than pushing through it.' },
    { id: 'aha_activity_guidelines', topic: 'medical', samples: ['how much exercise do I need for heart health', 'am I doing enough cardio for my heart'],
      render: () => "The AHA's baseline is 150+ min/week of moderate cardio (or 75+ min/week vigorous, or a mix), plus muscle-strengthening work 2+ days/week — and 300+ min/week of cardio gives additional benefit on top of that. Most runners training for a race clear this easily; it's a good floor to know if you're ever cutting back." },
    { id: 'aha_warning_signs', topic: 'medical', samples: ['what symptoms during a workout should worry me', 'what are heart attack warning signs while exercising'],
      render: () => `The AHA's heart attack warning signs apply just as much mid-workout as at rest: chest discomfort/pressure that lasts more than a few minutes or comes and goes, discomfort in the arms/back/neck/jaw/stomach, shortness of breath, cold sweat, nausea, or lightheadedness. If any of that shows up during a run, stop — don't push through it to finish a workout. ${COACH_MEDICAL_DISCLAIMER}` },
    { id: 'cardiac_rehab', topic: 'medical', samples: ['can I still run after a heart attack', 'how do I return to training after a cardiac event'],
      render: () => `Return-to-exercise after a cardiac event should go through a structured cardiac rehab program, not self-directed training — a Cochrane review found exercise-based cardiac rehab cuts cardiovascular mortality by roughly 26% and hospital readmissions by 18%. This is one of the best-evidenced interventions in cardiology; if this applies to you, ask your doctor about a referral. ${COACH_MEDICAL_DISCLAIMER}` },
    { id: 'know_your_numbers', topic: 'medical', samples: ['what heart health numbers should I track', 'does family history of heart disease matter for me'],
      render: () => 'Beyond training data, the numbers worth knowing are blood pressure, LDL/HDL cholesterol, and whether a parent or sibling had heart disease young — family history is an independent risk factor on its own, and risk rises with more affected relatives. The AHA estimates over 80% of cardiovascular disease is preventable by managing these, which is as much about a yearly checkup as it is about training.' },
    { id: 'vo2max_heart_health', topic: 'medical', samples: ['does my VO2max matter for long-term health', 'is fitness actually linked to living longer'],
      render: () => "Yes, notably so — the AHA has called cardiorespiratory fitness (essentially VO2max) a 'clinical vital sign' because it predicts mortality more strongly than smoking, blood pressure, cholesterol, or diabetes status individually. Improving it over time is one of the best-evidenced things you can do for long-term heart health, separate from any single workout." },
    { id: 'elite_training_overview', topic: 'elite_training', samples: ['how do elite marathoners train differently', "what does Kipchoge's training look like"],
      render: () => 'Elite marathoners typically run 100-140 miles/week across 11-14 sessions, with 80%+ of that volume at easy effort year-round (not constant hard running) — the same polarized principle recreational plans use, just at much higher volume. Many East African elites also live and train at altitude (2,000-2,500m) year-round rather than doing short altitude camps. The exact mileage figures you\'ll see quoted for specific athletes (e.g. Kipchoge) vary by outlet and aren\'t published training logs — treat specific numbers as estimates, the overall pattern as solid.' },
    { id: 'zone2_myth', topic: 'elite_training', samples: ['is zone 2 training the secret to getting fast', 'should I just do all zone 2 training'],
      render: () => 'Oversimplified. Elites do spend most of their volume at low intensity, which is where this claim comes from, but the science doesn\'t show Zone 2 is uniquely special for fat-burning or mitochondrial adaptation over other easy intensities. Its real value is that it lets you accumulate high weekly volume without excess fatigue, which is what makes the smaller dose of hard training on top of it effective — the volume and the hard sessions both matter, not just the zone.' },
    { id: 'high_mileage_myth', topic: 'elite_training', samples: ['do I need to run 100 miles a week to get fast', 'how much mileage do I need to run a fast marathon'],
      render: () => 'Only true at the elite level. An analysis of over 119,000 amateur marathoners found the fastest finishers averaged around 62 miles/week, not 100+, and most of what separated fast from slow runners was more easy running, not more hard running. Sub-3-hour marathoner training data shows peak weeks closer to 75 miles on average.' },
    { id: 'altitude_training_myth', topic: 'elite_training', samples: ['does altitude training guarantee performance gains', 'should I train at altitude'],
      render: () => "Not guaranteed — this is a real effect on average, but highly variable individually. Some athletes get a solid VO2max/hemoglobin boost from altitude exposure; others show little to no change, with individual factors like iron status playing a role. It can help, but it's not a reliable shortcut for everyone." },
    { id: 'elite_injury_myth', topic: 'elite_training', samples: ['do elite runners never get injured because of their form', 'does good running form make you injury-proof'],
      render: () => "Not supported — elites get injured too, and elite ultra-trail runners in one study actually showed a higher injury rate than typical recreational runners. Certain biomechanical patterns are linked to higher injury odds in research, but no study shows 'good form' makes anyone immune — that's a media narrative, not a finding." },
    { id: 'supershoes', topic: 'elite_training', samples: ['do carbon plate shoes actually make me faster', 'are supershoes worth it', 'how much do vaporfly shoes help'],
      render: () => "The shoe effect itself is well measured: carbon-plated 'supershoes' improve running economy by roughly 3-4% at race pace, worth an estimated 1-3% off marathon finish times. What's genuinely unresolved is how much of the last decade's world-record improvements come from shoes versus better pacing, flatter record courses, and a deeper global talent pool — no single study cleanly separates those factors for any specific record." },
    { id: 'ethnicity_performance_myth', topic: 'medical', samples: ['are certain ethnicities better runners', 'am I not built for running because of my ethnicity', 'is running performance genetic'],
      render: () => "No reliable genetic test or established science ties your ancestry to an athletic performance ceiling. Popular claims about specific ethnicities being 'built for' sprinting or endurance mostly trace back to opinion pieces, not peer-reviewed research — a 2022 review looking specifically at elite East African runners found 'no compelling explanation' linking genetics to their success despite years of searching. Individual variation within any population dwarfs the average differences between populations. Train based on your own data, not your ancestry." },
  ];

  /* ── Retrieval (ported from src/lib/coach-chat/retrieval.ts) ── */
  const COACH_MATCH_THRESHOLD = 0.55;
  const COACH_SINGLE_MATCH_THRESHOLD = 0.72;
  const COACH_MAX_COMPOSED_TOPICS = 3;

  function coachSplitClauses(message) {
    const bySentence = message.split(/[?.!]+/).map((s) => s.trim()).filter(Boolean);
    const clauses = bySentence.reduce((acc, s) => acc.concat(s.split(/\s+and\s+(?=how|what|why|does|is|are|should|can|will|do)/i)), []);
    const trimmed = clauses.map((c) => c.trim()).filter((c) => c.split(/\s+/).length >= 3);
    return trimmed.length > 1 ? trimmed : [message];
  }

  let coachStaticIndexPromise = null;
  function coachBuildStaticIndex() {
    const tasks = [];
    COACH_ANSWER_LIBRARY.forEach((entry) => {
      entry.samples.forEach((sample) => {
        tasks.push(coachEmbedText(sample).then((vector) => ({ vector: vector, topic: entry.topic, render: entry.render })));
      });
    });
    return Promise.all(tasks);
  }
  function coachGetStaticIndex() {
    if (!coachStaticIndexPromise) coachStaticIndexPromise = coachBuildStaticIndex().catch((err) => { coachStaticIndexPromise = null; throw err; });
    return coachStaticIndexPromise;
  }

  function coachBestPerTopic(candidates) {
    const byTopic = new Map();
    candidates.forEach((c) => {
      const existing = byTopic.get(c.topic);
      if (!existing || c.score > existing.score) byTopic.set(c.topic, c);
    });
    return Array.from(byTopic.values()).sort((a, b) => b.score - a.score);
  }

  async function coachCandidatesForClause(clauseVector, facts, learned) {
    const staticIndex = await coachGetStaticIndex();
    const candidates = staticIndex.map((sample) => ({ score: coachCosineSimilarity(clauseVector, sample.vector), topic: sample.topic, reply: sample.render(facts) }));
    for (const entry of learned) {
      const vector = await coachEmbedText(entry.question);
      candidates.push({ score: coachCosineSimilarity(clauseVector, vector), topic: 'learned:' + entry.question, reply: entry.answer });
    }
    return candidates;
  }

  async function coachBestMatchForClause(clause, facts, learned) {
    const queryVector = await coachEmbedText(clause);
    const candidates = await coachCandidatesForClause(queryVector, facts, learned);
    const ranked = coachBestPerTopic(candidates);
    if (!ranked.length || ranked[0].score < COACH_MATCH_THRESHOLD) return null;
    return ranked[0];
  }

  async function coachFindAnswer(message, facts, learned) {
    const clauses = coachSplitClauses(message);

    if (clauses.length === 1) {
      const clauseVector = await coachEmbedText(clauses[0]);
      const candidates = await coachCandidatesForClause(clauseVector, facts, learned);
      const ranked = coachBestPerTopic(candidates);
      if (!ranked.length || ranked[0].score < COACH_MATCH_THRESHOLD) return null;
      if (ranked[0].score >= COACH_SINGLE_MATCH_THRESHOLD) return { reply: ranked[0].reply };
      const relevant = ranked.filter((c) => c.score >= COACH_MATCH_THRESHOLD).slice(0, COACH_MAX_COMPOSED_TOPICS);
      if (relevant.length === 1) return { reply: relevant[0].reply };
      return { reply: relevant.map((c) => c.reply).join('\n\n') };
    }

    const perClause = await Promise.all(clauses.map((c) => coachBestMatchForClause(c, facts, learned)));
    const matched = perClause.filter((c) => c !== null);
    if (!matched.length) return null;
    const deduped = coachBestPerTopic(matched).slice(0, COACH_MAX_COMPOSED_TOPICS);
    if (deduped.length === 1) return { reply: deduped[0].reply };
    return { reply: deduped.map((c) => c.reply).join('\n\n') };
  }

  /* ── Learned-answers queue (ported from src/lib/coach-chat/learned-answers.ts) ── */
  async function coachQueueQuestion(userId, question) {
    const sb = fitClient(); if (!sb) return;
    try { await sb.from('fit_coach_questions').insert({ user_id: userId, question: question }); }
    catch (err) { console.warn('coach: failed to queue question', err); }
  }
  async function coachListLearnedAnswers() {
    const sb = fitClient(); if (!sb) return [];
    try {
      const { data, error } = await sb.from('fit_coach_learned_answers').select('question, answer');
      if (error) throw error;
      return (data || []).map((row) => ({ question: row.question, answer: row.answer }));
    } catch { return []; }
  }
  async function coachListPendingQuestions() {
    const sb = fitClient(); if (!sb) return [];
    const { data, error } = await sb.from('fit_coach_questions').select('id, question, created_at').eq('status', 'pending').order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map((row) => ({ id: row.id, question: row.question, createdAt: row.created_at }));
  }
  async function coachAnswerQuestion(id, question, answer) {
    const sb = fitClient(); if (!sb) throw new Error('Account service unavailable.');
    const upd = await sb.from('fit_coach_questions').update({ status: 'answered', answer: answer, answered_at: new Date().toISOString() }).eq('id', id);
    if (upd.error) throw upd.error;
    const ins = await sb.from('fit_coach_learned_answers').insert({ question: question, answer: answer, source_id: id });
    if (ins.error) throw ins.error;
  }
  async function coachDismissQuestion(id) {
    const sb = fitClient(); if (!sb) throw new Error('Account service unavailable.');
    const { error } = await sb.from('fit_coach_questions').update({ status: 'dismissed' }).eq('id', id);
    if (error) throw error;
  }

  /* ── Chat UI (ported from src/components/coach/coach-chat.tsx +
     src/app/coach/admin/coach-admin-client.tsx, merged into one tab) ── */
  const COACH_NO_MATCH_REPLY = "I don't have a stored answer for that yet — I've sent your question to Troll Runner, and it'll be added here once answered.";
  const coach = { messages: [], busy: false, degraded: false, adminOpen: false, userId: null, facts: null, learned: null };
  let coachWarmed = false;

  function initCoach() {
    coach.signedOut = document.getElementById('coachSignedOut');
    coach.body = document.getElementById('coachBody');
    coach.signinBtn = document.getElementById('coachSigninBtn');
    if (!coach.body) return;
    coach.signinBtn.addEventListener('click', () => document.getElementById('btn-signin').click());
    coach.statusEl = document.getElementById('coachStatus');
    coach.logEl = document.getElementById('coachLog');
    coach.form = document.getElementById('coachForm');
    coach.input = document.getElementById('coachInput');
    coach.adminToggleBtn = document.getElementById('coachAdminToggleBtn');
    coach.adminCard = document.getElementById('coachAdminCard');
    coach.adminList = document.getElementById('coachAdminList');
    coach.form.addEventListener('submit', (e) => { e.preventDefault(); coachHandleSubmit(); });
    coach.adminToggleBtn.addEventListener('click', () => coachToggleAdmin());
  }

  function coachSetStatus(text, isErr) {
    if (!coach.statusEl) return;
    coach.statusEl.textContent = text || '';
    coach.statusEl.classList.toggle('is-err', !!isErr);
  }

  async function coachWarmModel() {
    if (coachWarmed || coachModelFailed) return;
    coachWarmed = true;
    coachSetStatus('Loading coach model… (one-time download, cached after)');
    try {
      await coachGetExtractor();
      coachSetStatus('');
    } catch (err) {
      console.warn('coach: model failed to load, falling back to queue-only mode', err);
      coach.degraded = true;
      coachSetStatus("Running in a limited mode — the coach model couldn't load, so questions go straight to Troll Runner.", true);
    }
  }

  function coachRenderLog() {
    const log = coach.logEl;
    if (!log) return;
    log.innerHTML = '';
    if (!coach.messages.length) {
      const p = document.createElement('p');
      p.className = 'coach-msg coach-msg-empty';
      p.textContent = "Ask about your training load, why the plan looks the way it does, this week's plan, nutrition, race science, or training myths.";
      log.appendChild(p);
    }
    coach.messages.forEach((m) => {
      const div = document.createElement('div');
      div.className = 'coach-msg ' + (m.role === 'user' ? 'coach-msg-user' : 'coach-msg-coach');
      div.textContent = m.text;
      log.appendChild(div);
    });
    if (coach.busy) {
      const div = document.createElement('div');
      div.className = 'coach-msg coach-msg-coach coach-msg-typing';
      div.textContent = 'Thinking…';
      log.appendChild(div);
    }
    log.scrollTop = log.scrollHeight;
  }

  async function coachHandleSubmit() {
    const text = coach.input.value.trim();
    if (!text || coach.busy || !coach.userId) return;
    coach.messages.push({ role: 'user', text: text });
    coach.input.value = '';
    coach.busy = true;
    coachRenderLog();

    let reply;
    try {
      if (coach.degraded) {
        await coachQueueQuestion(coach.userId, text);
        reply = COACH_NO_MATCH_REPLY;
      } else {
        if (!coach.facts) coach.facts = await buildCoachFacts(coach.userId);
        if (!coach.learned) coach.learned = await coachListLearnedAnswers();
        let match = null;
        try {
          match = await coachFindAnswer(text, coach.facts, coach.learned);
        } catch (err) {
          console.warn('coach: retrieval failed, falling back to queue-only mode', err);
          coach.degraded = true;
          coachSetStatus("Running in a limited mode — the coach model couldn't load, so questions go straight to Troll Runner.", true);
        }
        if (match) {
          reply = match.reply;
        } else {
          await coachQueueQuestion(coach.userId, text);
          reply = COACH_NO_MATCH_REPLY;
        }
      }
    } catch (err) {
      console.warn('coach: chat failed', err);
      reply = "Couldn't reach the coach — try again in a moment.";
    }
    coach.messages.push({ role: 'coach', text: reply });
    coach.busy = false;
    coachRenderLog();
  }

  async function coachToggleAdmin() {
    coach.adminOpen = !coach.adminOpen;
    coach.adminCard.hidden = !coach.adminOpen;
    if (coach.adminOpen) await coachRefreshAdminList();
  }

  function coachBuildAdminRow(q) {
    const wrap = document.createElement('div');
    wrap.className = 'coach-admin-item';
    const question = document.createElement('p');
    question.className = 'coach-admin-q';
    question.textContent = q.question;
    const meta = document.createElement('p');
    meta.className = 'coach-admin-meta';
    meta.textContent = 'Asked ' + new Date(q.createdAt).toLocaleString();
    const textarea = document.createElement('textarea');
    textarea.className = 'fit-textarea';
    textarea.placeholder = 'Write the answer…';
    textarea.rows = 3;
    textarea.style.width = '100%';
    const actions = document.createElement('div');
    actions.className = 'coach-admin-actions';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button'; saveBtn.className = 'fit-btn fit-btn-primary'; saveBtn.textContent = 'Save answer'; saveBtn.disabled = true;
    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button'; dismissBtn.className = 'fit-btn fit-btn-ghost'; dismissBtn.textContent = 'Dismiss';
    textarea.addEventListener('input', () => { saveBtn.disabled = !textarea.value.trim(); });
    saveBtn.addEventListener('click', async () => {
      const answer = textarea.value.trim();
      if (!answer) return;
      saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
      try {
        await coachAnswerQuestion(q.id, q.question, answer);
        wrap.remove();
        coach.learned = null; // next question re-fetches the learned-answers library, including this new one
      } catch {
        saveBtn.disabled = false; saveBtn.textContent = 'Save answer';
        meta.textContent = "Couldn't save that answer — try again.";
        meta.classList.add('is-err');
      }
    });
    dismissBtn.addEventListener('click', async () => {
      dismissBtn.disabled = true;
      try { await coachDismissQuestion(q.id); wrap.remove(); }
      catch { dismissBtn.disabled = false; }
    });
    actions.appendChild(saveBtn); actions.appendChild(dismissBtn);
    wrap.appendChild(question); wrap.appendChild(meta); wrap.appendChild(textarea); wrap.appendChild(actions);
    return wrap;
  }

  async function coachRefreshAdminList() {
    coach.adminList.innerHTML = '<p class="desc">Loading…</p>';
    let rows;
    try { rows = await coachListPendingQuestions(); } catch { rows = null; }
    if (rows === null) { coach.adminList.innerHTML = '<p class="desc">Couldn\'t load the queue — try refreshing.</p>'; return; }
    if (!rows.length) { coach.adminList.innerHTML = '<p class="desc">Nothing waiting — the queue is empty.</p>'; return; }
    coach.adminList.innerHTML = '';
    rows.forEach((q) => coach.adminList.appendChild(coachBuildAdminRow(q)));
  }

  async function refreshCoach() {
    if (!coach.body) return;
    const user = fitUser();
    if (!user) {
      coach.signedOut.hidden = false;
      coach.body.hidden = true;
      return;
    }
    coach.signedOut.hidden = true;
    coach.body.hidden = false;
    coach.userId = user.userId;
    coach.messages = [];
    coach.facts = null;
    coach.learned = null;
    coach.adminOpen = false;
    coach.adminCard.hidden = true;
    coach.adminToggleBtn.hidden = user.username !== COACH_ADMIN_USERNAME;
    coachSetStatus('');
    coachRenderLog();
    // Warm the embedding model as soon as a signed-in user has Coach visible,
    // so the first real question doesn't have to wait on the full download.
    coachWarmModel();
  }

  // ── Learn (Phase 8) — static article list ↔ detail, no Supabase/auth.
  //    Content ported verbatim from trollrunner-fitness's
  //    src/lib/education/articles.ts (the ARTICLES array backing its old
  //    /learn and /learn/[slug] server-rendered routes). ──
  const LEARN_ARTICLES = [
    {
      slug: 'running-form',
      title: 'Running Form Basics',
      category: 'Running',
      summary: "The handful of form cues that actually move the needle — and the ones that don't.",
      paragraphs: [
        "Most running-form advice overcorrects. Your body already found an efficient stride through years of walking and running — wholesale rebuilds (forced forefoot striking, exaggerated knee lift) tend to create new problems faster than they fix old ones.",
        "The cues with real evidence behind them: a slightly forward lean from the ankles (not the waist), a cadence in the 170-185 steps/minute range for most runners, and landing with your foot roughly under your center of mass rather than way out in front of you (overstriding). If you're only going to work on one thing, work on cadence — a slightly quicker turnover naturally shortens your stride and reduces braking forces.",
        "Foot strike (heel vs. midfoot vs. forefoot) matters far less than the internet suggests. Elite runners land across the whole spectrum. Chasing a specific foot strike usually isn't worth the injury risk of forcing an unfamiliar pattern.",
        "The best way to improve form without overthinking it: strides (4-6 x 20 seconds at a quick, relaxed pace) once or twice a week. They reinforce good mechanics through speed and relaxation, not conscious micromanagement.",
      ],
    },
    {
      slug: 'heart-rate-zones',
      title: 'Heart Rate Zones & VO2 Max',
      category: 'Training',
      summary: 'What the zones actually mean, and why most of your running should feel embarrassingly easy.',
      paragraphs: [
        "Training zones are typically defined as percentages of max heart rate or heart rate reserve: Zone 1-2 (easy/recovery), Zone 3 (moderate/tempo), Zone 4 (threshold), Zone 5 (VO2 max/anaerobic). The exact percentages vary by method, but the practical takeaway is consistent: most of your weekly volume should sit in Zone 1-2.",
        "This surprises people. The 80/20 principle — roughly 80% of training time easy, 20% moderate-to-hard — shows up again and again in research on endurance athletes. Running everything at a moderate effort (the most common mistake) builds fatigue without building much fitness.",
        "VO2 max — the maximum rate your body can use oxygen — is one input into performance, not the whole story. It responds well to short, hard intervals (Zone 5), but running economy, lactate threshold, and durability matter just as much for race results, and those develop through consistent volume, not just hard efforts.",
        "If you don't have a heart rate monitor, effort-based zones work fine: Zone 2 should let you hold a full conversation; threshold pace is 'comfortably hard' — sustainable for about an hour; VO2 max efforts should feel unsustainable past 3-8 minutes.",
      ],
    },
    {
      slug: 'marathon-training',
      title: 'Marathon Training Basics',
      category: 'Racing',
      summary: "How a training block is actually structured, and why the long run isn't the only thing that matters.",
      paragraphs: [
        "A marathon block typically runs 12-20 weeks and moves through phases: base (building aerobic volume), build (adding tempo and threshold work on top of that base), peak (highest combined volume and intensity), and taper (a planned 2-3 week volume cut so you race fresh).",
        "The long run gets outsized attention, but it's one piece. What matters more than any single run is consistent weekly mileage over months — the aerobic system adapts to accumulated stress, not to any one heroic effort. A runner who logs 30 consistent miles/week for 16 weeks will usually out-race someone chasing 20-mile long runs on an inconsistent 20 miles/week base.",
        "Race-pace practice matters specifically for the marathon because the distance is long enough that pacing errors compound brutally. Some long runs should include miles at or near goal marathon pace, not just easy effort — this trains both the legs and the pacing discipline.",
        "The taper is not optional and it is not laziness. Cutting volume 40-60% over the final 2-3 weeks while keeping some intensity lets your body absorb months of training and show up fresh. Runners who skip the taper because they feel undertrained almost always race worse, not better.",
      ],
    },
    {
      slug: 'recovery-and-sleep',
      title: 'Recovery & Sleep',
      category: 'Recovery',
      summary: 'Why recovery is where the actual fitness gains happen — and what wrecks it.',
      paragraphs: [
        "Training is the stimulus; recovery is where adaptation happens. Skip recovery and you're just accumulating fatigue without the fitness gain that's supposed to come with it — this is the mechanism behind overtraining and burnout.",
        "Sleep is the single highest-leverage recovery tool available, and it's free. Most adults need 7-9 hours; athletes in heavy training blocks often need the higher end of that range. Sleep debt measurably impairs glycogen replenishment, muscle repair, and reaction time — all things that directly affect training quality the next day.",
        "Rest days aren't wasted days. Easy or complete rest days allow microscopic muscle damage to repair and glycogen stores to refill. Training hard every day without any easy days is one of the most common ways runners plateau or get hurt.",
        "Simple recovery signals worth tracking: resting heart rate trending up, sleep quality dropping, and persistent soreness that doesn't ease with an easy day are all signs to back off before a small dip becomes an injury or illness.",
      ],
    },
    {
      slug: 'strength-for-runners',
      title: 'Strength Training for Runners',
      category: 'Strength',
      summary: 'Why lifting makes you a better runner, not just a stronger one.',
      paragraphs: [
        "Strength training improves running economy — how much energy you burn at a given pace — even though it doesn't directly train the aerobic system. Stronger tendons and muscles store and return more elastic energy with each stride, which is part of why efficient strength work translates to faster times without more mileage.",
        "It's also one of the best tools for injury prevention. Many common running injuries (IT band syndrome, patellofemoral pain, Achilles issues) are linked to weakness in the hips, glutes, and calves rather than to running itself. Two strength sessions a week addressing these areas meaningfully lowers injury risk.",
        "You don't need a bodybuilding program. Compound lower-body movements (squats, deadlifts, lunges, calf raises) at moderate-to-heavy loads and low-to-moderate reps (roughly 4-8) build the kind of strength that transfers to running, without adding so much muscle mass that it becomes extra weight to carry.",
        "Timing matters less than consistency. Lifting the day before a hard run isn't ideal, but lifting twice a week on non-key-workout days, year-round, beats an inconsistent 'strength phase' squeezed in once a year.",
      ],
    },
    {
      slug: 'injury-prevention',
      title: 'Injury Prevention',
      category: 'Recovery',
      summary: 'The 10% rule, the most common running injuries, and how to actually avoid them.',
      paragraphs: [
        "The most common cause of running injuries isn't bad form or bad shoes — it's doing too much, too soon. The classic guideline is to increase weekly mileage by no more than about 10% per week, though the real principle is broader: any sudden spike in volume or intensity is when injuries happen.",
        "The most frequent running injuries — runner's knee, IT band syndrome, shin splints, plantar fasciitis, Achilles tendinopathy — are almost all overuse injuries tied to a training-load spike, not a single bad step. That's good news: they're largely preventable through smart progression.",
        "Pain that's sharp, one-sided, or gets worse during a run is a stop signal, not a push-through signal. Dull, general soreness that eases as you warm up is usually fine. Learning that distinction early saves months of downtime later.",
        "The best injury-prevention toolkit is unglamorous: gradual mileage progression, 1-2 strength sessions a week, adequate sleep, and taking easy days genuinely easy. None of it is exciting, all of it works.",
      ],
    },
    {
      slug: 'race-day-nutrition',
      title: 'Race-Day Nutrition',
      category: 'Nutrition',
      summary: 'What to eat before and during a race, by distance — and why race day is the wrong time to experiment.',
      paragraphs: [
        "The single most important rule of race nutrition: never try anything new on race day. Whatever you eat before and during the race should be something you've already tested on a long training run, because gut tolerance for food and gels under race-pace stress is highly individual.",
        "For races under about 90 minutes (5K, 10K, most half marathons for faster runners), a light, carb-focused meal 2-3 hours before is usually enough — mid-race fueling is optional. For marathons and slower half marathons, plan on 30-60g of carbohydrate per hour once you're past the first 45 minutes, via gels, chews, or sports drink.",
        "Hydration needs vary enormously by sweat rate, temperature, and pace — there's no single number that applies to everyone. A reasonable starting point is drinking to thirst rather than forcing a fixed volume, and adding electrolytes for anything over about 90 minutes or in hot conditions.",
        "Carb-loading — shifting toward more carbohydrate for 1-2 days before a marathon — helps top off glycogen stores, but it means changing the ratio of what you eat, not simply eating more overall. Overeating in the name of carb-loading just leaves you sluggish on race morning.",
      ],
    },
    {
      slug: 'mental-performance',
      title: 'Mental Performance',
      category: 'Racing',
      summary: 'Pacing discipline, self-talk, and the mental skills that separate good races from bad ones.',
      paragraphs: [
        "The single biggest mental-performance mistake in racing is going out too fast. Adrenaline and a fresh crowd make the first mile feel deceptively easy — a controlled, even-paced (or slightly negative-split) race almost always beats one that starts fast and fades.",
        "Breaking a race into segments — the next mile, the next aid station, the next landmark — is a well-established way to make a daunting distance feel manageable. Thinking about 26.2 miles as one unbroken effort is a good way to psych yourself out before the start line.",
        "Self-talk has a measurable effect on perceived effort. Athletes who use short, practiced positive or instructional cues ('smooth,' 'relax the shoulders,' 'strong legs') tend to sustain effort better late in a race than those who ruminate on how much it hurts.",
        "Confidence is built in training, not manufactured on race day. The mental toughness that shows up at mile 20 of a marathon is mostly a memory of every hard workout you've already survived — which is one more reason consistent training matters more than any single race-week trick.",
      ],
    },
  ];

  function learnGetArticle(slug) {
    return LEARN_ARTICLES.find((a) => a.slug === slug) || null;
  }

  const learn = {};

  function learnRenderList() {
    const grid = document.getElementById('learnGrid');
    grid.innerHTML = '';
    LEARN_ARTICLES.forEach((a) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'learn-card';
      card.setAttribute('aria-label', a.title + ' — ' + a.category);
      card.innerHTML = '<span class="learn-cat"></span><span class="learn-title"></span><span class="learn-summary"></span>';
      card.querySelector('.learn-cat').textContent = a.category;
      card.querySelector('.learn-title').textContent = a.title;
      card.querySelector('.learn-summary').textContent = a.summary;
      card.addEventListener('click', () => learnOpenArticle(a.slug));
      grid.appendChild(card);
    });
    const count = LEARN_ARTICLES.length;
    document.getElementById('learnGuideCount').textContent = count + (count === 1 ? ' guide' : ' guides');
  }

  function learnOpenArticle(slug) {
    const article = learnGetArticle(slug);
    if (!article) return;
    document.getElementById('learnDetailCat').textContent = article.category;
    document.getElementById('learnDetailTitle').textContent = article.title;
    document.getElementById('learnDetailSummary').textContent = article.summary;
    const body = document.getElementById('learnDetailBody');
    body.innerHTML = '';
    article.paragraphs.forEach((text) => {
      const p = document.createElement('p');
      p.textContent = text;
      body.appendChild(p);
    });
    learn.listView.hidden = true;
    learn.detailView.hidden = false;
    try { history.replaceState(null, '', `#learn-${slug}`); } catch {}
  }

  function learnShowList() {
    learn.detailView.hidden = true;
    learn.listView.hidden = false;
    // Only rewrite the hash back to the bare tab id if we're still on the
    // Learn tab (the tab's own click handler already does this when
    // switching tabs, so this only matters for the in-tab back button).
    if (document.querySelector('.tab[data-tab="learn"]')?.getAttribute('aria-selected') === 'true') {
      try { history.replaceState(null, '', '#learn'); } catch {}
    }
  }

  function initLearn() {
    learn.listView = document.getElementById('learnListView');
    learn.detailView = document.getElementById('learnDetailView');
    if (!learn.listView) return;
    learnRenderList();
    document.getElementById('learnBackBtn').addEventListener('click', learnShowList);
    // Deep link support: "#learn-<slug>" is stashed by initTabs() (which
    // runs before this) since it can't resolve the article slug itself.
    if (window.__fitPendingLearnSlug) {
      const slug = window.__fitPendingLearnSlug;
      window.__fitPendingLearnSlug = null;
      if (learnGetArticle(slug)) learnOpenArticle(slug);
    }
  }

  // ── Boot ──
  function boot() {
    initTabs();
    initAuth();
    initLog();
    initTraining();
    initHome();
    initOnboarding();
    initYou();
    initCoach();
    initLearn();
    updateAuthUI();
    refreshLog();
    refreshTraining();
    refreshHome();
    refreshYou();
    refreshCoach();
    window.addEventListener('trollrunner:auth-changed', () => { refreshLog(); refreshTraining(); refreshHome(); refreshYou(); refreshCoach(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
