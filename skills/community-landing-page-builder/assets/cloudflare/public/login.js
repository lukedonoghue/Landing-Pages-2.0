const form = document.querySelector('#login-form');
const username = document.querySelector('#username');
const password = document.querySelector('#password');
const error = document.querySelector('#login-error');
const submit = document.querySelector('#submit');
const status = document.querySelector('#login-status');
const title = document.querySelector('#login-title');
const description = document.querySelector('#login-description');
const resetForm = document.querySelector('#reset-request-form');
const resetEmail = document.querySelector('#reset-email');
const resetError = document.querySelector('#reset-error');
const resetSubmit = document.querySelector('#reset-submit');
const showReset = document.querySelector('#show-reset');
const forgotHelp = document.querySelector('#forgot-help');

function showLogin() {
  resetForm.hidden = true; form.hidden = false; forgotHelp.hidden = false;
  title.textContent = 'Your workspace awaits.';
  description.textContent = 'Sign in to see your enquiries and page performance.';
  resetError.textContent = ''; status.textContent = ''; username.focus();
}

function showResetRequest() {
  form.hidden = true; resetForm.hidden = false; forgotHelp.hidden = true;
  title.textContent = 'Request a password reset.';
  description.textContent = 'Use the email registered to your workspace account.';
  error.textContent = ''; status.textContent = ''; resetEmail.focus();
}

showReset.addEventListener('click', showResetRequest);
document.querySelector('#back-to-login').addEventListener('click', showLogin);

resetForm.addEventListener('submit', async event => {
  event.preventDefault(); resetError.textContent = ''; status.textContent = '';
  resetSubmit.disabled = true; resetSubmit.textContent = 'Submitting…';
  try {
    const response = await fetch('/api/auth/reset-request', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmail.value.trim() })
    });
    let data = {}; try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || (response.status === 503 ? 'Password reset email is not configured. Contact your workspace administrator.' : 'The request could not be submitted. Please try again.'));
    resetForm.reset();
    status.textContent = 'If an account matches that email, an administrator can review the reset request.';
  } catch (failure) {
    resetError.textContent = failure instanceof TypeError ? 'Unable to connect. Check your connection and try again.' : failure.message || 'Unable to request a reset. Please try again.';
    resetEmail.focus();
  } finally { resetSubmit.disabled = false; resetSubmit.textContent = 'Request reset →'; }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  error.textContent = ''; password.removeAttribute('aria-invalid'); username.removeAttribute('aria-invalid');
  submit.disabled = true; submit.textContent = 'Signing in…';
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    });
    const data = await response.json();
    if (!response.ok || !data.authenticated) {
      if (response.status === 429) throw new Error(data.error || 'Too many sign-in attempts. Please wait before trying again.');
      throw new Error(data.error || 'That username or password was not recognised. Please try again.');
    }
    password.value = '';
    status.textContent = 'Signed in. Opening your workspace…';
    window.location.assign('/admin/');
  } catch (failure) {
    error.textContent = failure instanceof TypeError ? 'Unable to connect. Check your connection and try again.' : failure.message || 'Unable to sign in. Please try again.';
    username.setAttribute('aria-invalid', 'true'); password.setAttribute('aria-invalid', 'true'); password.focus();
    submit.disabled = false; submit.textContent = 'Sign in →';
  }
});

// Only the server's signed, HttpOnly cookie determines whether a session is valid.
fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
  .then(response => response.ok ? response.json() : null)
  .then(data => { if (data?.authenticated) window.location.replace('/admin/'); })
  .catch(() => {});
