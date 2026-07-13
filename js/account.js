// ── account.js ────────────────────────────────────────────────────────────────
// Post-login account management: change password, delete account, revisit
// the legal docs, log out. auth.js owns the pre-login signup/login screen;
// this owns the dismissible panel opened from the sidebar once logged in.

import { getStoredEmail, changePassword, deleteAccount, clearSession, MSG_GENERIC_ERROR } from './auth.js';

function els() {
  return {
    modal: document.getElementById('accountModal'),
    backdrop: document.getElementById('accountBackdrop'),
    openBtn: document.getElementById('sidebarAccountOpenBtn'),
    closeBtn: document.getElementById('accountCloseBtn'),
    emailDisplay: document.getElementById('accountEmailDisplay'),
    sidebarEmail: document.getElementById('sidebarAccountEmail'),
    sidebarAvatar: document.getElementById('sidebarAccountAvatar'),
    message: document.getElementById('accountMessage'),
    passwordForm: document.getElementById('accountPasswordForm'),
    passwordSubmit: document.getElementById('accountPasswordSubmit'),
    currentPassword: document.getElementById('accountCurrentPassword'),
    newPassword: document.getElementById('accountNewPassword'),
    confirmPassword: document.getElementById('accountConfirmPassword'),
    deleteOpenBtn: document.getElementById('accountDeleteOpenBtn'),
    deleteConfirm: document.getElementById('accountDeleteConfirm'),
    deleteInput: document.getElementById('accountDeleteInput'),
    deleteCancelBtn: document.getElementById('accountDeleteCancelBtn'),
    deleteConfirmBtn: document.getElementById('accountDeleteConfirmBtn'),
    logoutBtn: document.getElementById('accountLogoutBtn'),
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

function setSubmitting(button, isSubmitting, idleLabel) {
  if (!button) return;
  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? 'One moment…' : idleLabel;
}

// Mirrors the sidebar's own avatar/email display and the modal's header —
// called on init and every time the modal opens, so it stays correct even
// if getStoredEmail() ever changes mid-session (it doesn't today, but this
// is the one place both surfaces are kept consistent from).
function refreshIdentityDisplay() {
  const { emailDisplay, sidebarEmail, sidebarAvatar } = els();
  const email = getStoredEmail();
  if (emailDisplay) emailDisplay.textContent = email || '';
  if (sidebarEmail) sidebarEmail.textContent = email || 'Account';
  if (sidebarAvatar) sidebarAvatar.textContent = email ? email[0] : '•';
}

function resetDeleteConfirm() {
  const { deleteConfirm, deleteInput, deleteConfirmBtn } = els();
  if (deleteConfirm) deleteConfirm.hidden = true;
  if (deleteInput) deleteInput.value = '';
  if (deleteConfirmBtn) deleteConfirmBtn.disabled = true;
}

function openModal() {
  const { modal, currentPassword } = els();
  if (!modal) return;
  refreshIdentityDisplay();
  clearMessage();
  resetDeleteConfirm();
  modal.hidden = false;
  if (currentPassword) currentPassword.focus({ preventScroll: true });
}

function closeModal() {
  const { modal, openBtn } = els();
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  // Hand focus back to the button that opened it — otherwise it's dropped
  // to <body> with no visible indicator, same reasoning as splash.js's own
  // focus hand-off comment.
  if (openBtn) openBtn.focus({ preventScroll: true });
}

async function handlePasswordSubmit(e) {
  e.preventDefault();
  const { passwordSubmit, currentPassword, newPassword, confirmPassword } = els();
  if (!currentPassword || !newPassword || !confirmPassword) return;
  clearMessage();

  const current = currentPassword.value;
  const next = newPassword.value;
  const confirm = confirmPassword.value;

  if (!current || next.length < 6) {
    showMessage('Enter your current password and a new one with at least 6 characters.', 'error');
    return;
  }
  if (next !== confirm) {
    showMessage('New password and confirmation don\'t match.', 'error');
    return;
  }

  setSubmitting(passwordSubmit, true, 'Update password');
  try {
    // changePassword re-verifies `current` by logging in with it before
    // calling GoTrue's update endpoint — see its own comment in auth.js for
    // why that's not just a UX nicety.
    await changePassword(current, next);
    showMessage('Password updated.', 'success');
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (err) {
    showMessage(err.message || MSG_GENERIC_ERROR, 'error');
  }
  setSubmitting(passwordSubmit, false, 'Update password');
}

// Full reload rather than an in-place teardown of the app shell — matches
// auth.js's own back button and this app's existing "no session restore
// across visits" design: the simplest way back to a known-clean state,
// used both for a plain log-out and after a successful account deletion
// (where the account is already gone server-side, nothing left to do but
// clear local state and start over).
function returnToLanding() {
  clearSession();
  window.location.href = window.location.pathname;
}

async function handleDeleteConfirm() {
  const { deleteConfirmBtn } = els();
  setSubmitting(deleteConfirmBtn, true, 'Permanently delete');
  try {
    await deleteAccount();
    returnToLanding();
  } catch (err) {
    showMessage(err.message || MSG_GENERIC_ERROR, 'error');
    setSubmitting(deleteConfirmBtn, false, 'Permanently delete');
  }
}

function initAccount() {
  const {
    modal, backdrop, openBtn, closeBtn, passwordForm,
    deleteOpenBtn, deleteConfirm, deleteInput, deleteCancelBtn, deleteConfirmBtn,
    logoutBtn
  } = els();
  if (!modal || !openBtn) return;

  refreshIdentityDisplay();

  openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  if (passwordForm) passwordForm.addEventListener('submit', handlePasswordSubmit);

  if (deleteOpenBtn && deleteConfirm) {
    deleteOpenBtn.addEventListener('click', () => {
      deleteConfirm.hidden = false;
      if (deleteInput) deleteInput.focus({ preventScroll: true });
    });
  }
  if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', resetDeleteConfirm);
  // Typing the word out is the confirmation — no separate "are you sure"
  // dialog on top of it, since that would just be a second click to
  // habituate past rather than a real safeguard.
  if (deleteInput && deleteConfirmBtn) {
    deleteInput.addEventListener('input', () => {
      deleteConfirmBtn.disabled = deleteInput.value.trim() !== 'DELETE';
    });
  }
  if (deleteConfirmBtn) deleteConfirmBtn.addEventListener('click', handleDeleteConfirm);

  if (logoutBtn) logoutBtn.addEventListener('click', returnToLanding);
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────
export { initAccount };
