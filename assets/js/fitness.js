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

  // ── Render: analytics stub (real charts are Phase 6 — this just points
  //    back at Home's already-built stats/trend chart, plus a couple of
  //    numbers computed from the same fresh activity fetch as badges above). ──
  function renderYouAnalytics(activities) {
    const card = document.getElementById('youAnalyticsCard');
    const month = monthSummary(activities);
    card.innerHTML =
      '<p class="fit-label">Analytics</p>' +
      '<p class="desc" style="margin-top:2px;">Full charts and trends live on Home for now — training load, weekly mileage sparkline, and this month’s totals. Deeper analytics is a later phase.</p>' +
      '<div class="stat-grid" style="margin-top:10px;">' +
      '<div class="stat-tile"><span class="stat-label">Total activities</span><span class="stat-value">' + activities.length + '</span></div>' +
      '<div class="stat-tile"><span class="stat-label">Mileage this month</span><span class="stat-value">' + month.totalMileage + ' mi</span></div>' +
      '</div>' +
      '<button type="button" class="link-accent" id="youAnalyticsHomeLink" style="margin-top:10px;">See Home for full trends →</button>';
    const link = document.getElementById('youAnalyticsHomeLink');
    if (link) link.addEventListener('click', () => document.querySelector('.tab[data-tab="home"]').click());
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

  // ── Boot ──
  function boot() {
    initTabs();
    initAuth();
    initLog();
    initTraining();
    initHome();
    initOnboarding();
    initYou();
    updateAuthUI();
    refreshLog();
    refreshTraining();
    refreshHome();
    refreshYou();
    window.addEventListener('trollrunner:auth-changed', () => { refreshLog(); refreshTraining(); refreshHome(); refreshYou(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
