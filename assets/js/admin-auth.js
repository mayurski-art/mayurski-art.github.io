(function () {
  const SUPABASE_URL = 'https://tjsyhfplxjtakdfkpdtg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3loZnBseGp0YWtkZmtwZHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTc0ODksImV4cCI6MjA5MTk3MzQ4OX0.xLUcPUUguRBQttNwiIRWJHxjJjLqrQDMu4Ubsk5yZoQ';
  const ADMIN_EMAIL_HASH = '4181a603ec6d4d7897801ff8192b8de3ec6bf993d85fd9bb3b599df246ec567a';
  const ADMIN_LOGIN_EMAIL = window.atob('bWF5dXJjaGhpdHVAZ21haWwuY29t');
  const ADMIN_AUTH_KEY = 'trollrunner_admin_auth';
  const ROOT_REDIRECT_URL = new URL('/', window.location.origin).toString();
  let authClient = null;

  function getAuthClient() {
    if (authClient) return authClient;
    if (!window.supabase?.createClient) return null;
    authClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return authClient;
  }

  async function getSession() {
    const client = getAuthClient();
    if (!client?.auth?.getSession) return null;
    const { data, error } = await client.auth.getSession();
    if (error) return null;
    return data?.session || null;
  }

  async function getUser() {
    const client = getAuthClient();
    if (!client?.auth?.getUser) return null;
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    return data?.user || null;
  }

  async function hashText(text) {
    const normalized = String(text || '').trim().toLowerCase();
    const bytes = new TextEncoder().encode(normalized);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hashBuffer)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function hasAdminSession() {
    const [user, session] = await Promise.all([getUser(), getSession()]);
    if (!user || !session) return false;
    const emailHash = await hashText(user?.email || '');
    return emailHash === ADMIN_EMAIL_HASH;
  }

  function promptForAdminPassword() {
    const password = window.prompt('Enter the admin password to unlock the Trollrunner website.');
    if (password == null) return null;
    return String(password);
  }

  async function signInWithAdminPassword(password) {
    const client = getAuthClient();
    if (!client?.auth?.signInWithPassword) {
      throw new Error('Supabase password sign-in is unavailable.');
    }
    const { error } = await client.auth.signInWithPassword({
      email: ADMIN_LOGIN_EMAIL,
      password: String(password || ''),
    });
    if (error) throw error;
    return true;
  }

  async function signOut() {
    const client = getAuthClient();
    if (!client?.auth?.signOut) return false;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    localStorage.removeItem(ADMIN_AUTH_KEY);
    return true;
  }

  function writeStatus(nodes, message, kind = 'info') {
    nodes.forEach(node => {
      if (!node) return;
      node.textContent = message;
      node.dataset.kind = kind;
    });
  }

  function setButtonState(button, enabled, labelWhenEnabled, labelWhenDisabled) {
    if (!button) return;
    button.disabled = !enabled;
    if (labelWhenEnabled || labelWhenDisabled) {
      button.textContent = enabled ? (labelWhenEnabled || button.textContent) : (labelWhenDisabled || button.textContent);
    }
  }

  async function refreshUi() {
    const authed = await hasAdminSession();
    const footerStatus = document.getElementById('admin-auth-status');
    const gateStatus = document.getElementById('gate-admin-status');
    const gateLockToggle = document.getElementById('gate-lock-toggle');
    const footerButton = document.getElementById('admin-go');
    const gateButton = document.getElementById('gate-admin-link');
    if (authed) {
      localStorage.setItem(ADMIN_AUTH_KEY, '1');
      writeStatus([footerStatus, gateStatus], 'Signed in as the admin account.', 'success');
      setButtonState(footerButton, true, 'Unlock site', 'Unlock site');
      setButtonState(gateButton, true, 'Unlock site', 'Unlock site');
      if (gateLockToggle) gateLockToggle.disabled = false;
    } else {
      localStorage.removeItem(ADMIN_AUTH_KEY);
      writeStatus([footerStatus, gateStatus], 'Enter the admin password to unlock admin controls.', 'info');
      if (gateLockToggle) gateLockToggle.disabled = true;
      setButtonState(footerButton, true, 'Unlock site', 'Unlock site');
      setButtonState(gateButton, true, 'Unlock site', 'Unlock site');
    }

    return authed;
  }

  async function requestAdminLink() {
    const footerStatus = document.getElementById('admin-auth-status');
    const gateStatus = document.getElementById('gate-admin-status');
    const password = promptForAdminPassword();
    if (password == null) {
      writeStatus([footerStatus, gateStatus], 'Admin unlock canceled.', 'info');
      return false;
    }
    try {
      await signInWithAdminPassword(password);
      const lockHelper = window.TrollrunnerSiteLock;
      if (lockHelper?.requestLockTransition) {
        lockHelper.requestLockTransition(false);
      }
      writeStatus([footerStatus, gateStatus], 'Website unlocked.', 'success');
      return true;
    } catch (error) {
      const message = error?.message ? String(error.message) : 'Unable to unlock admin controls.';
      writeStatus([footerStatus, gateStatus], message, 'error');
      return false;
    }
  }

  async function ensureAdminSession() {
    const authed = await hasAdminSession();
    if (authed) localStorage.setItem(ADMIN_AUTH_KEY, '1');
    return authed;
  }

  async function openAdminPageOrLink() {
    const authed = await hasAdminSession();
    if (authed) {
      localStorage.setItem(ADMIN_AUTH_KEY, '1');
      window.location.href = 'admin.html';
      return true;
    }
    const unlocked = await requestAdminLink();
    if (unlocked) {
      window.location.href = 'admin.html';
      return true;
    }
    return false;
  }

  function init() {
    const client = getAuthClient();
    if (client?.auth?.onAuthStateChange) {
      client.auth.onAuthStateChange(() => {
        void refreshUi();
      });
    }
    void refreshUi();
  }

  window.TrollrunnerAdminAuth = {
    adminAuthKey: ADMIN_AUTH_KEY,
    getSession,
    getUser,
    hasAdminSession,
    signInWithAdminPassword,
    requestAdminLink,
    ensureAdminSession,
    openAdminPageOrLink,
    signOut,
    refreshUi,
  };

  window.requestAdminLoginLink = () => requestAdminLink();
  window.goToAdmin = () => openAdminPageOrLink();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
