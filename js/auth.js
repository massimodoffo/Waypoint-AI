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
//
// The confirmation email's link redirects back to this site with
// #confirmation_token=<token> in the URL hash. netlify-identity-widget would
// normally catch that automatically and call /verify to complete the
// confirmation — this REST-only implementation has no equivalent unless it's
// done explicitly, so consumeConfirmationToken() below does it on load. Skip
// this comment's history if you're wondering why an earlier version of this
// flow never actually finished confirming anyone: the widget's auto-handling
// was assumed rather than replaced.

const IDENTITY_BASE = '/.netlify/identity';
const IDENTITY_TIMEOUT_MS = 8000;
const STORAGE_KEY = 'wp_identity';
// The raw access token, kept separate from STORAGE_KEY's display-only
// metadata and in sessionStorage rather than localStorage — it's read by
// agents.js on every Claude call (see getAccessToken) but only needs to
// survive this tab for this session, not linger on disk after it's closed.
const TOKEN_STORAGE_KEY = 'wp_identity_token';

const MSG_GENERIC_ERROR = 'Something went wrong. Please try again.';
const MSG_UNCONFIRMED = 'Account created! Check your email to confirm it, then log in below.';
const MSG_MAYBE_REGISTERED = 'That email may already have an account — try logging in instead.';
const MSG_NOT_CONFIRMED_LOGIN = 'Please confirm your email first — check your inbox for the link we sent, then log in from there.';

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
    agreeTerms: document.getElementById('authAgreeTerms'),
    agreePrivacy: document.getElementById('authAgreePrivacy'),
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

function isUnconfirmedError(message) {
  return typeof message === 'string' && /not confirmed/i.test(message);
}

// Netlify Identity's signup/token endpoints return their error text under
// slightly different shapes depending on the failure — normalize to one
// human-readable string rather than showing raw API JSON. Duplicate-account
// signups are softened separately (see isDuplicateAccountError) rather than
// relaying GoTrue's own wording verbatim, so a scripted signup attempt can't
// use the exact response text to enumerate which emails already have
// accounts. "Email not confirmed" is remapped everywhere (not just the
// post-signup path handleSignupSubmit already covers via MSG_UNCONFIRMED) so
// a standalone login attempt on an unconfirmed account — e.g. the user
// closed the tab after signing up and came back later without clicking the
// email link — gets the same actionable wording instead of GoTrue's terse
// raw string.
function extractErrorMessage(body, { isSignup = false } = {}) {
  if (!body) return MSG_GENERIC_ERROR;
  const raw = body.error_description || body.msg || body.error || MSG_GENERIC_ERROR;
  if (isSignup && isDuplicateAccountError(raw)) return MSG_MAYBE_REGISTERED;
  if (isUnconfirmedError(raw)) return MSG_NOT_CONFIRMED_LOGIN;
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

// GoTrue's /verify endpoint both confirms the account *and* logs it in —
// the response shape matches identityLogin's (access_token/refresh_token/
// user), so a successful call here can go straight into the app.
async function identityVerify(token) {
  let res;
  try {
    res = await fetch(`${IDENTITY_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, type: 'signup' }),
      signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MS)
    });
  } catch {
    throw new Error(MSG_GENERIC_ERROR);
  }
  const body = await parseJsonSafe(res);
  if (!res.ok) throw new Error(extractErrorMessage(body));
  return body;
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
  try {
    if (tokenResponse?.access_token) sessionStorage.setItem(TOKEN_STORAGE_KEY, tokenResponse.access_token);
  } catch { /* storage unavailable — proxy.js's JWT check will 401 subsequent Claude calls */ }
}

// Read by agents.js to attach the Identity JWT to every /.netlify/functions/proxy
// call — that function rejects requests with no valid token (see proxy.js).
function getAccessToken() {
  try { return sessionStorage.getItem(TOKEN_STORAGE_KEY); } catch { return null; }
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
  const { submitSignup, firstName, lastName, signupEmail, signupPassword, agreeTerms, agreePrivacy } = els();
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
  // The form carries novalidate (see index.html) so the checkboxes' own
  // `required` attribute never blocks submission on its own — this is the
  // actual gate, same manual-validation pattern as the fields above.
  if (!agreeTerms?.checked || !agreePrivacy?.checked) {
    showMessage('Please agree to the Terms of Service and Privacy Policy to continue.', 'error');
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

// Consumed once on load. The token is single-use server-side, so the hash
// is stripped immediately (before the fetch even resolves) rather than
// after success — a refresh or accidental back-nav mid-request must not
// replay it against /verify a second time.
async function consumeConfirmationToken() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('confirmation_token');
  if (!token) return;

  history.replaceState(null, '', window.location.pathname + window.location.search);

  showMessage('Confirming your email…', '');
  try {
    const tokenResponse = await identityVerify(token);
    storeSession(tokenResponse, tokenResponse?.user?.email);
    showMessage('Email confirmed — you\'re in!', 'success');
    setTimeout(enterApp, 600);
  } catch (err) {
    // identityVerify throws MSG_GENERIC_ERROR specifically for network
    // failures/timeouts/unparseable responses (see its own catch block) —
    // those are worth retrying, unlike a token GoTrue has actually rejected
    // as invalid or expired, so they get distinct wording instead of both
    // being told the one-time link is dead and to sign up again.
    const message = err.message === MSG_GENERIC_ERROR
      ? 'Couldn\'t reach the server to confirm your email. Check your connection and try the link again.'
      : 'That confirmation link is invalid or has expired. Try logging in below, or sign up again.';
    showMessage(message, 'error');
    switchTab('login', { preserveMessage: true });
  }
}

// ── ACCOUNT MANAGEMENT ──────────────────────────────────────────────────────
// Used by js/account.js's settings panel, not the signup/login screen above.

// GoTrue's self-service /user endpoint updates the *currently authenticated*
// user (identified by the Bearer token, not a path param) — the same
// no-admin-secret pattern identityLogin/identitySignup use above, just for
// updates instead of account creation.
async function identityUpdateUser(accessToken, updates) {
  let res;
  try {
    res = await fetch(`${IDENTITY_BASE}/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(updates),
      signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MS)
    });
  } catch {
    throw new Error(MSG_GENERIC_ERROR);
  }
  const body = await parseJsonSafe(res);
  if (!res.ok) throw new Error(extractErrorMessage(body));
  return body;
}

// Read by the account panel to display which address is signed in —
// separate from getAccessToken() (sessionStorage, cleared on tab close)
// since this is just display text, not a credential.
function getStoredEmail() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw).email ?? null : null;
  } catch { return null; }
}

// Re-authenticates with the current password before changing it. GoTrue's
// /user endpoint itself only requires a valid access token, not the current
// password — this extra round-trip is a deliberate choice on top of that,
// not a GoTrue requirement: it stops someone who's grabbed an active
// session/token (but not the password) from locking the real account owner
// out, and it doubles as confirming the typed current password is actually
// correct before the new one overwrites it.
async function changePassword(currentPassword, newPassword) {
  const email = getStoredEmail();
  if (!email) throw new Error('Your session has expired — please log in again.');
  const tokenResponse = await identityLogin(email, currentPassword);
  await identityUpdateUser(tokenResponse.access_token, { password: newPassword });
}

// Calls the account-deletion Netlify function (see
// netlify/functions/delete-account.js), which needs the caller's own
// Identity JWT to know which account to delete — the same Bearer-header
// pattern agents.js uses for the Claude proxy.
async function deleteAccount() {
  const token = getAccessToken();
  if (!token) throw new Error('Your session has expired — please log in again.');
  let res;
  try {
    res = await fetch('/.netlify/functions/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MS)
    });
  } catch {
    throw new Error(MSG_GENERIC_ERROR);
  }
  if (!res.ok) {
    const body = await parseJsonSafe(res);
    throw new Error(body?.error || MSG_GENERIC_ERROR);
  }
}

// Clears the local session without calling any API — used both for a plain
// "log out" action and after a successful account deletion, where the
// account is already gone server-side and there's nothing left to sign out
// of, just local state to clear.
function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  try { sessionStorage.removeItem(TOKEN_STORAGE_KEY); } catch { /* storage unavailable */ }
}

function initAuth() {
  const { tabSignup, tabLogin, formSignup, formLogin } = els();
  if (!tabSignup || !tabLogin || !formSignup || !formLogin) return;

  tabSignup.addEventListener('click', () => switchTab('signup'));
  tabLogin.addEventListener('click', () => switchTab('login'));
  formSignup.addEventListener('submit', handleSignupSubmit);
  formLogin.addEventListener('submit', handleLoginSubmit);

  const backBtn = document.getElementById('authBackBtn');
  if (backBtn) backBtn.addEventListener('click', () => window.location.reload());

  consumeConfirmationToken();
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────
export { initAuth, getAccessToken, getStoredEmail, changePassword, deleteAccount, clearSession };
