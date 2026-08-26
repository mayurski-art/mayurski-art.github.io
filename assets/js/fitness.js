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
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => activate(tab.dataset.tab));
      tab.addEventListener('keydown', (e) => {
        const i = tabs.indexOf(tab);
        if (e.key === 'ArrowRight') { e.preventDefault(); (tabs[i + 1] || tabs[0]).focus(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); (tabs[i - 1] || tabs[tabs.length - 1]).focus(); }
      });
    });

    const initial = (location.hash || '').replace('#', '');
    activate(tabs.some((t) => t.dataset.tab === initial) ? initial : 'home');
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
      buckets.push({ label: weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), mileage: Math.round(mileage * 10) / 10 });
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
        '<button type="button" class="kudos-btn"></button>' +
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
    const { user, activities, goals, onboardingMileage, recentRecovery, todayRecovery, feed, kudosMap } = homeState;

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

    let activities = [], goals = [], onboardingMileage = 0, recentRecovery = [], todayRecovery = null, feed = [], kudosMap = new Map();
    try {
      const results = await Promise.all([
        listActivities(user.userId, 200),
        getGoals(user.userId),
        getOnboardingWeeklyMileage(user.userId),
        listRecentRecovery(user.userId, 7),
        getTodayRecovery(user.userId),
      ]);
      activities = results[0]; goals = results[1]; onboardingMileage = results[2]; recentRecovery = results[3]; todayRecovery = results[4];
    } catch { /* everything already defaulted above — Home still renders with empty state */ }

    try {
      feed = await getFriendsFeed(user.userId);
      if (feed.length) kudosMap = await getKudosInfo(feed.map((a) => a.id), user.userId);
    } catch { feed = []; }

    homeRecoveryEditing = false;
    homeState = { user, activities, goals, onboardingMileage, recentRecovery, todayRecovery, feed, kudosMap };
    document.getElementById('homeLoadingPill').hidden = true;
    renderHome();
  }

  // ── Boot ──
  function boot() {
    initTabs();
    initAuth();
    initLog();
    initTraining();
    initHome();
    updateAuthUI();
    refreshLog();
    refreshTraining();
    refreshHome();
    window.addEventListener('trollrunner:auth-changed', () => { refreshLog(); refreshTraining(); refreshHome(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
