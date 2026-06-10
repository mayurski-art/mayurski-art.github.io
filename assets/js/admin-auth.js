(function () {
  const SUPABASE_URL = 'https://tjsyhfplxjtakdfkpdtg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3loZnBseGp0YWtkZmtwZHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTc0ODksImV4cCI6MjA5MTk3MzQ4OX0.xLUcPUUguRBQttNwiIRWJHxjJjLqrQDMu4Ubsk5yZoQ';
  const ADMIN_EMAIL = 'mayurchhitu@gmail.com';
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

  async function hasAdminSession() {
    const user = await getUser();
    return String(user?.email || '').toLowerCase() === ADMIN_EMAIL;
  }

  async function sendMagicLink(email = ADMIN_EMAIL, redirectTo = ROOT_REDIRECT_URL) {
    const client = getAuthClient();
    if (!client?.auth?.signInWithOtp) {
      throw new Error('Supabase auth is unavailable.');
    }
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
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
    const footerEmail = document.getElementById('admin-email');

    if (footerEmail && !footerEmail.value) footerEmail.value = ADMIN_EMAIL;
    if (footerEmail) footerEmail.readOnly = true;

    if (authed) {
      localStorage.setItem(ADMIN_AUTH_KEY, '1');
      writeStatus([footerStatus, gateStatus], `Signed in as ${ADMIN_EMAIL}.`, 'success');
      setButtonState(footerButton, true, 'Admin', 'Admin');
      setButtonState(gateButton, true, 'Signed in', 'Send admin link');
      if (gateLockToggle) gateLockToggle.disabled = false;
    } else {
      localStorage.removeItem(ADMIN_AUTH_KEY);
      writeStatus([footerStatus, gateStatus], `Send a sign-in link to ${ADMIN_EMAIL}.`, 'info');
      if (gateLockToggle) gateLockToggle.disabled = true;
      setButtonState(footerButton, true, 'Send link', 'Send link');
      setButtonState(gateButton, true, 'Send admin link', 'Send admin link');
    }

    return authed;
  }

  async function requestAdminLink(redirectTo = ROOT_REDIRECT_URL) {
    const footerStatus = document.getElementById('admin-auth-status');
    const gateStatus = document.getElementById('gate-admin-status');
    try {
      await sendMagicLink(ADMIN_EMAIL, redirectTo);
      writeStatus([footerStatus, gateStatus], `Magic link sent to ${ADMIN_EMAIL}. Check your inbox.`, 'success');
      return true;
    } catch (error) {
      const message = error?.message ? String(error.message) : 'Unable to send admin link.';
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
    return requestAdminLink(ROOT_REDIRECT_URL);
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
    adminEmail: ADMIN_EMAIL,
    adminAuthKey: ADMIN_AUTH_KEY,
    getSession,
    getUser,
    hasAdminSession,
    sendMagicLink,
    requestAdminLink,
    ensureAdminSession,
    openAdminPageOrLink,
    signOut,
    refreshUi,
  };

  window.requestAdminLoginLink = () => requestAdminLink(ROOT_REDIRECT_URL);
  window.goToAdmin = () => openAdminPageOrLink();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
