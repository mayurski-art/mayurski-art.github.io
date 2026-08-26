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
     fit_profiles.humor_enabled) are defined in trollrunner-fitness's
     supabase/fit_activities.sql, fit_onboarding.sql and fit_humor_toggle.sql.
     Those need to have been run against the SHARED TrollRunner Supabase
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

  // ── Boot ──
  function boot() {
    initTabs();
    initAuth();
    initLog();
    initTraining();
    updateAuthUI();
    refreshLog();
    refreshTraining();
    window.addEventListener('trollrunner:auth-changed', () => { refreshLog(); refreshTraining(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
