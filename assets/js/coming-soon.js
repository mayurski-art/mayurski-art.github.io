(function () {
  const SUPABASE_URL = 'https://tjsyhfplxjtakdfkpdtg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3loZnBseGp0YWtkZmtwZHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTc0ODksImV4cCI6MjA5MTk3MzQ4OX0.xLUcPUUguRBQttNwiIRWJHxjJjLqrQDMu4Ubsk5yZoQ';
  const isAdminPage = /\/admin\.html(?:$|\?)/.test(window.location.pathname);

  const overlay = document.getElementById('coming-soon-gate');
  if (!overlay || isAdminPage) return;

  const form = document.getElementById('cs-newsletter-form');
  const emailInput = document.getElementById('cs-newsletter-email');
  const newsletterStatus = document.getElementById('cs-newsletter-status');
  const adminInput = document.getElementById('cs-admin-pass');
  const adminGoBtn = document.getElementById('cs-admin-go');
  const adminStatus = document.getElementById('cs-admin-status');

  function setInertBehindOverlay(isLocked) {
    Array.from(document.body.children).forEach(child => {
      if (child === overlay) return;
      if (isLocked) child.setAttribute('inert', '');
      else child.removeAttribute('inert');
    });
  }

  function revealSite() {
    overlay.classList.add('is-unlocked');
    setInertBehindOverlay(false);
  }

  function hideSite() {
    overlay.classList.remove('is-unlocked');
    setInertBehindOverlay(true);
  }

  async function checkAdminSession() {
    try {
      const authed = await window.TrollrunnerAdminAuth?.hasAdminSession?.();
      if (authed) revealSite();
      else hideSite();
    } catch {
      hideSite();
    }
  }

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = String(emailInput?.value || '').trim();
    if (!email) return;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    newsletterStatus.textContent = 'Submitting...';
    newsletterStatus.dataset.kind = 'info';
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/troll_submit_newsletter_signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ p_email: email }),
      });
      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.message || 'Could not save that email.');
      }
      newsletterStatus.textContent = "You're on the list. 🧌";
      newsletterStatus.dataset.kind = 'success';
      form.reset();
    } catch (error) {
      newsletterStatus.textContent = error?.message ? String(error.message) : 'Something went wrong.';
      newsletterStatus.dataset.kind = 'error';
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  adminGoBtn?.addEventListener('click', async () => {
    const password = String(adminInput?.value || '');
    if (!password) {
      adminInput?.focus();
      return;
    }
    adminGoBtn.disabled = true;
    adminStatus.textContent = 'Checking...';
    adminStatus.dataset.kind = 'info';
    try {
      await window.TrollrunnerAdminAuth?.signInWithAdminPassword?.(password, { silent: true });
      adminStatus.textContent = '';
      if (adminInput) adminInput.value = '';
      revealSite();
    } catch (error) {
      adminStatus.textContent = error?.message ? String(error.message) : 'Wrong admin password.';
      adminStatus.dataset.kind = 'error';
    } finally {
      adminGoBtn.disabled = false;
    }
  });

  adminInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      adminGoBtn?.click();
    }
  });

  hideSite();
  void checkAdminSession();
})();
