// ── auth.js ───────────────────────────────────────────────────────────────────
// Account creation + login screen shown between the splash and the main app.
// Talks directly to Netlify Identity's GoTrue-compatible REST API
// (/.netlify/identity/*) via fetch — no client library — the same
// no-dependency posture the rest of this codebase already uses for Open-Meteo,
// Nominatim, and OSRM. Those endpoints only exist once Identity is enabled on
// the Netlify site (Site configuration → Identity in the dashboard); until
// then, or when running against a plain static server with no Netlify layer
// at all, every call below 404s and the form surfaces that as a normal error
// message rather than hanging.
//
// Netlify Identity ships with "Enable email confirmations" on by default,
// which means a fresh signup can't log in until the user clicks a link in a
// confirmation email — that's a site-level setting only the account owner can
// change (Site configuration → Identity → Emails), not something this code
// can flip. The login attempt this file fires immediately after signup
// handles that gracefully (see MSG_UNCONFIRMED below) rather than assuming
// email confirmation is off.

const IDENTITY_BASE = '/.netlify/identity';
const STORAGE_KEY = 'wp_identity';

const MSG_GENERIC_ERROR = 'Something went wrong. Please try again.';
const MSG_UNCONFIRMED = 'Account created! Check your email to confirm it, then log in below.';

function els() {
  return {
    screen: document.getElementById('authScreen'),
    tabSignup: document.getElementById('authTabSignup'),
    tabLogin: document.getElementById('authTabLogin'),
    formSignup: document.getElementById('authFormSignup'),
    formLogin: document.getElementById('authFormLogin'),
    submitSignup: document.getElementById('authSignupSubmit'),
    submitLogin: document.getElementById('authLoginSubmit'),
    message: document.getElementById('authMessage'),
    loginEmail: document.getElementById('authLoginEmail'),
  };
}

function showMessage(text, kind) {
  const { message } = els();
  if (!message) return;
  message.textContent = text;
  message.className = 'auth-message' + (kind ? ' ' + kind : '');
  message.hidden = false;
}

function clearMessage() {
  const { message } = els();
  if (!message) return;
  message.hidden = true;
  message.textContent = '';
}

function switchTab(target) {
  const { tabSignup, tabLogin, formSignup, formLogin } = els();
  if (!tabSignup || !tabLogin || !formSignup || !formLogin) return;
  const toSignup = target === 'signup';
  tabSignup.classList.toggle('active', toSignup);
  tabLogin.classList.toggle('active', !toSignup);
  tabSignup.setAttribute('aria-selected', String(toSignup));
  tabLogin.setAttribute('aria-selected', String(!toSignup));
  formSignup.hidden = !toSignup;
  formLogin.hidden = toSignup;
  clearMessage();
}

// Netlify Identity's signup/token endpoints return their error text under
// slightly different shapes depending on the failure — normalize to one
// human-readable string rather than showing raw API JSON.
function extractErrorMessage(body) {
  if (!body) return MSG_GENERIC_ERROR;
  return body.error_description || body.msg || body.error || MSG_GENERIC_ERROR;
}

async function parseJsonSafe(res) {
  try { return await res.json(); } catch { return null; }
}

async function identitySignup(email, password, firstName, lastName) {
  const res = await fetch(`${IDENTITY_BASE}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email, password,
      data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`.trim() }
    })
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) throw new Error(extractErrorMessage(body));
  return body;
}

async function identityLogin(email, password) {
  const res = await fetch(`${IDENTITY_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', username: email, password })
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) throw new Error(extractErrorMessage(body));
  return body; // { access_token, refresh_token, expires_in, ... }
}

// Only covers this page load — there's no session restore on return visits
// (the splash always plays first), just enough persistence that a mid-app
// refresh right after logging in doesn't strand the user.
function storeSession(tokenResponse, email) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      email, storedAt: Date.now(), expiresIn: tokenResponse.expires_in
    }));
  } catch { /* storage unavailable or full — session still works for this tab */ }
}

// Mirrors the reveal splash.js used to do itself when Explore led straight
// into the app: lift the pre-start gating (nav/app hidden — see
// body.pre-start in styles.css), fade the auth screen out, then hand focus
// to <main> for keyboard users the same way splash.js's own dismissal does.
function enterApp() {
  const { screen } = els();
  document.body.classList.remove('pre-start');
  if (screen) {
    screen.classList.add('auth-leaving');
    setTimeout(() => screen.remove(), 300);
  }
  const main = document.querySelector('main');
  if (main) main.focus({ preventScroll: true });
}

function setSubmitting(button, isSubmitting, idleLabel) {
  if (!button) return;
  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? 'One moment…' : idleLabel;
}

async function handleSignupSubmit(e) {
  e.preventDefault();
  const { submitSignup } = els();
  clearMessage();

  const firstName = document.getElementById('authFirstName').value.trim();
  const lastName = document.getElementById('authLastName').value.trim();
  const email = document.getElementById('authSignupEmail').value.trim();
  const password = document.getElementById('authSignupPassword').value;

  if (!firstName || !lastName || !email || password.length < 6) {
    showMessage('Fill in every field — password needs at least 6 characters.', 'error');
    return;
  }

  setSubmitting(submitSignup, true, 'Create account');
  try {
    await identitySignup(email, password, firstName, lastName);
    // Netlify Identity's default config requires email confirmation before
    // a token grant succeeds, so this immediate login attempt is expected
    // to fail on a freshly-confirmed-by-default site — that's handled below
    // by showing MSG_UNCONFIRMED instead of a raw error.
    try {
      const tokenResponse = await identityLogin(email, password);
      storeSession(tokenResponse, email);
      showMessage('Account created — you\'re in!', 'success');
      setTimeout(enterApp, 600);
    } catch {
      showMessage(MSG_UNCONFIRMED, 'success');
      switchTab('login');
      const { loginEmail } = els();
      if (loginEmail) loginEmail.value = email;
    }
  } catch (err) {
    showMessage(err.message || MSG_GENERIC_ERROR, 'error');
  } finally {
    setSubmitting(submitSignup, false, 'Create account');
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const { submitLogin } = els();
  clearMessage();

  const email = document.getElementById('authLoginEmail').value.trim();
  const password = document.getElementById('authLoginPassword').value;
  if (!email || !password) {
    showMessage('Enter your email and password.', 'error');
    return;
  }

  setSubmitting(submitLogin, true, 'Log in');
  try {
    const tokenResponse = await identityLogin(email, password);
    storeSession(tokenResponse, email);
    enterApp();
  } catch (err) {
    showMessage(err.message || MSG_GENERIC_ERROR, 'error');
    setSubmitting(submitLogin, false, 'Log in');
  }
}

function initAuth() {
  const { tabSignup, tabLogin, formSignup, formLogin } = els();
  if (!tabSignup || !tabLogin || !formSignup || !formLogin) return;

  tabSignup.addEventListener('click', () => switchTab('signup'));
  tabLogin.addEventListener('click', () => switchTab('login'));
  formSignup.addEventListener('submit', handleSignupSubmit);
  formLogin.addEventListener('submit', handleLoginSubmit);
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────
export { initAuth };
