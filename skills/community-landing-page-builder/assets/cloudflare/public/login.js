const form = document.querySelector('#login-form');
const username = document.querySelector('#username');
const password = document.querySelector('#password');
const error = document.querySelector('#login-error');
const submit = document.querySelector('#submit');
const status = document.querySelector('#login-status');

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
