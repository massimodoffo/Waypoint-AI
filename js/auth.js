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
const IDENTITY_TIMEOUT_MS = 8000;
const STORAGE_KEY = 'wp_identity';

const MSG_GENERIC_ERROR = 'Something went wrong. Please try again.';
const MSG_UNCONFIRMED = 'Account created! Check your email to confirm it, then log in below.';
const MSG_MAYBE_REGISTERED = 'That email may already have an account — try logging in instead.';

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
    firstName: document.getElementById('authFirstName'),
    lastName: document.getElementById('authLastName'),
    signupEmail: document.getElementById('authSignupEmail'),
    signupPassword: document.getElementById('authSignupPassword'),
    loginEmail: document.getElementById('authLoginEmail'),
    loginPassword: document.getElementById('authLoginPassword'),
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

// preserveMessage: the signup-success handler switches to the login tab
// itself to show a "check your email" / "you're in" message it just set —
// without this, the tab-click default of clearing stale messages would wipe
// that message out before the user ever sees it, since both calls happen in
// the same synchronous tick with nothing in between to let it paint.
function switchTab(target, { preserveMessage = false } = {}) {
  const { tabSignup, tabLogin, formSignup, formLogin } = els();
  if (!tabSignup || !tabLogin || !formSignup || !formLogin) return;
  const toSignup = target === 'signup';
  tabSignup.classList.toggle('active', toSignup);
  tabLogin.classList.toggle('active', !toSignup);
  tabSignup.setAttribute('aria-selected', String(toSignup));
  tabLogin.setAttribute('aria-selected', String(!toSignup));
  formSignup.hidden = !toSignup;
  formLogin.hidden = toSignup;
  if (!preserveMessage) clearMessage();
}

function isDuplicateAccountError(message) {
  return typeof message === 'string' && /already.*(registered|exists)/i.test(message);
}

// Netlify Identity's signup/token endpoints return their error text under
// slightly different shapes depending on the failure — normalize to one
// human-readable string rather than showing raw API JSON. Duplicate-account
// signups are softened separately (see isDuplicateAccountError) rather than
// relaying GoTrue's own wording verbatim, so a scripted signup attempt can't
// use the exact response text to enumerate which emails already have
// accounts.
function extractErrorMessage(body, { isSignup = false } = {}) {
  if (!body) return MSG_GENERIC_ERROR;
  const raw = body.error_description || body.msg || body.error || MSG_GENERIC_ERROR;
  if (isSignup && isDuplicateAccountError(raw)) return MSG_MAYBE_REGISTERED;
  return raw;
}

async function parseJsonSafe(res) {
  try { return await res.json(); } catch { return null; }
}

// Every error this throws is already normalized/safe to show directly to
// the user (see extractErrorMessage and the network-failure catch below) —
// callers don't need to re-check err.message before displaying it.
async function identitySignup(email, password, firstName, lastName) {
  let res;
  try {
    res = await fetch(`${IDENTITY_BASE}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, password,
        data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`.trim() }
      }),
      signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MS)
    });
  } catch {
    // Network failure or timeout, not an API error response — fetch's own
    // TypeError ("Failed to fetch") is not something to show verbatim.
    throw new Error(MSG_GENERIC_ERROR);
  }
  const body = await parseJsonSafe(res);
  if (!res.ok) throw new Error(extractErrorMessage(body, { isSignup: true }));
  return body;
}

async function identityLogin(email, password) {
  let res;
  try {
    res = await fetch(`${IDENTITY_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'password', username: email, password }),
      signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MS)
    });
  } catch {
    throw new Error(MSG_GENERIC_ERROR);
  }
  const body = await parseJsonSafe(res);
  if (!res.ok) throw new Error(extractErrorMessage(body));
  return body; // { access_token, refresh_token, expires_in, ... }
}

// Only covers this page load — there's no session restore on return visits
// (the splash always plays first), just enough persistence that a mid-app
// refresh right after logging in doesn't strand the user. tokenResponse can
// be null if the API returned a 2xx with a non-JSON body — guarded so that
// case surfaces as nothing-happens rather than a TypeError masquerading as
// a storage failure.
function storeSession(tokenResponse, email) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      email, storedAt: Date.now(), expiresIn: tokenResponse?.expires_in ?? null
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
  const { submitSignup, firstName, lastName, signupEmail, signupPassword } = els();
  if (!firstName || !lastName || !signupEmail || !signupPassword) return;
  clearMessage();

  const first = firstName.value.trim();
  const last = lastName.value.trim();
  const email = signupEmail.value.trim();
  const password = signupPassword.value;

  if (!first || !last || !email || password.length < 6) {
    showMessage('Fill in every field — password needs at least 6 characters.', 'error');
    return;
  }

  setSubmitting(submitSignup, true, 'Create account');
  try {
    await identitySignup(email, password, first, last);
    // Netlify Identity's default config requires email confirmation before
    // a token grant succeeds, so this immediate login attempt is expected
    // to fail on a freshly-confirmed-by-default site — that's handled below
    // by showing MSG_UNCONFIRMED instead of a raw error.
    try {
      const tokenResponse = await identityLogin(email, password);
      storeSession(tokenResponse, email);
      showMessage('Account created — you\'re in!', 'success');
      signupPassword.value = '';
      // Left disabled deliberately (unlike the catch branches below): the
      // screen is already on its way out via enterApp(), so re-enabling the
      // button here would just open a window for a duplicate signup click
      // while the success message is still on screen.
      setTimeout(enterApp, 600);
      return;
    } catch {
      showMessage(MSG_UNCONFIRMED, 'success');
      signupPassword.value = '';
      switchTab('login', { preserveMessage: true });
      const { loginEmail } = els();
      if (loginEmail) loginEmail.value = email;
    }
  } catch (err) {
    showMessage(err.message || MSG_GENERIC_ERROR, 'error');
    signupPassword.value = '';
  }
  setSubmitting(submitSignup, false, 'Create account');
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const { submitLogin, loginEmail, loginPassword } = els();
  if (!loginEmail || !loginPassword) return;
  clearMessage();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    showMessage('Enter your email and password.', 'error');
    return;
  }

  setSubmitting(submitLogin, true, 'Log in');
  try {
    const tokenResponse = await identityLogin(email, password);
    storeSession(tokenResponse, email);
    loginPassword.value = '';
    enterApp(); // left disabled — same reasoning as the signup success path above
  } catch (err) {
    showMessage(err.message || MSG_GENERIC_ERROR, 'error');
    loginPassword.value = '';
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
