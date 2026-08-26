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

  // ── Boot ──
  function boot() {
    initTabs();
    initAuth();
    updateAuthUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
