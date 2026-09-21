const make = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

const roleLabel = role => ({ admin: 'Admin', manager: 'Manager', viewer: 'View-only' })[role] || role;
const dateLabel = value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : String(value || '-');
};

const externalLink = (text, href) => {
  const link = make('a', text);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noreferrer';
  return link;
};

export function initUsersPanel(host, { request, currentUser }) {
  let disposed = false;
  let emailConfigured = false;
  let setupDisclosureInitialized = false;
  const root = make('div', undefined, 'users-view');
  const heading = make('div', undefined, 'users-heading');
  const headingText = make('div');
  headingText.append(make('p', 'ACCESS & ROLES', 'eyebrow'), make('h2', 'Workspace users'), make('p', 'Invite colleagues and keep each account’s access appropriate.', 'muted'));
  const refresh = make('button', 'Refresh', 'button secondary'); refresh.type = 'button';
  heading.append(headingText, refresh);
  const provider = make('section', undefined, 'notice users-provider'); provider.setAttribute('aria-labelledby', 'users-email-state-title');
  const providerState = make('div', undefined, 'users-provider-state'); providerState.setAttribute('role', 'status'); providerState.setAttribute('aria-live', 'polite');
  const providerStateText = make('div');
  const providerTitle = make('strong', '', 'users-provider-title'); providerTitle.id = 'users-email-state-title';
  const providerCopy = make('p', '', 'muted small'); providerStateText.append(providerTitle, providerCopy); providerState.append(providerStateText);
  const setupGuide = make('details', undefined, 'users-security-setup');
  const setupSummary = make('summary', 'One-time security setup'); setupGuide.append(setupSummary);
  const setupBody = make('div', undefined, 'users-security-setup-body');
  if (currentUser?.id === 'owner') {
    const steps = make('ol', undefined, 'users-setup-steps');
    const addresses = make('li'); addresses.append(make('strong', 'Choose the inbox and sender.'), make('p', 'Tell Codex your receiving email and the business domain to send from. Codex handles the connection.'));
    const destinations = make('li'); const destinationCopy = make('p');
    destinationCopy.append('In Cloudflare, go to Compute > Email Service > Email Routing > Destination Addresses. Add the inbox, open the Cloudflare email, and select Verify email address. See ', externalLink('Cloudflare instructions', 'https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/'), '.');
    destinations.append(make('strong', 'Verify the inbox in Cloudflare.'), destinationCopy);
    const ownerRegistration = make('li');
    ownerRegistration.append(make('strong', 'Confirm the owner email in the CRM.'), make('p', 'After Codex connects email, open Users > Owner email. Enter that inbox and your current password, choose Send verification, and confirm the CRM email.'));
    steps.append(addresses, destinations, ownerRegistration); setupBody.append(steps, make('p', 'Enter your password only in the CRM.', 'users-setup-safety'));
  }
  const teammate = make('div', undefined, 'users-teammate-setup'); teammate.append(make('strong', currentUser?.id === 'owner' ? 'Adding a teammate later' : 'Adding a teammate'));
  teammate.append(make('p', 'Teammates can use any email domain, including Gmail or an agency address. Verify the recipient in Cloudflare, ask Codex to connect the confirmed recipient, then use Users > Invite a user and choose the role.'));
  setupBody.append(teammate); setupGuide.append(setupBody); provider.append(providerState, setupGuide);
  const status = make('p', '', 'users-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const error = make('p', '', 'inline-error users-error'); error.setAttribute('role', 'alert');

  const invite = make('section', undefined, 'panel users-section');
  const inviteHead = make('div', undefined, 'users-section-heading');
  inviteHead.append(make('h3', 'Invite a user'), make('p', 'The invitation is sent to the registered email address.', 'muted small'));
  const inviteForm = make('form', undefined, 'users-invite-form');
  const emailLabel = make('label', 'Email'); const email = make('input'); email.type = 'email'; email.name = 'email'; email.required = true; email.maxLength = 254; email.autocomplete = 'email'; emailLabel.append(email);
  const usernameLabel = make('label', 'Username'); const username = make('input'); username.name = 'username'; username.required = true; username.maxLength = 80; username.autocomplete = 'off'; username.spellcheck = false; usernameLabel.append(username);
  const roleLabelNode = make('label', 'Role'); const role = make('select'); role.name = 'role';
  for (const [value, label] of [['viewer', 'View-only'], ['manager', 'Manager'], ['admin', 'Admin']]) { const option = make('option', label); option.value = value; role.append(option); }
  roleLabelNode.append(role);
  const inviteSubmit = make('button', 'Send invitation', 'button primary'); inviteSubmit.type = 'submit';
  inviteForm.append(emailLabel, usernameLabel, roleLabelNode, inviteSubmit); invite.append(inviteHead, inviteForm);

  const usersSection = make('section', undefined, 'panel users-section');
  const usersHead = make('div', undefined, 'users-section-heading'); usersHead.append(make('h3', 'People with access'), make('p', 'Managers can operate the CRM. View-only users cannot change or export records.', 'muted small'));
  const usersTable = make('div', undefined, 'table-scroll users-table'); usersTable.setAttribute('tabindex', '0'); usersTable.setAttribute('role', 'region'); usersTable.setAttribute('aria-label', 'Workspace users');
  usersSection.append(usersHead, usersTable);

  const requestsSection = make('section', undefined, 'panel users-section');
  const requestsHead = make('div', undefined, 'users-section-heading'); requestsHead.append(make('h3', 'Password reset requests'), make('p', 'Approving a request sends a one-use reset link to the account email.', 'muted small'));
  const requestsList = make('div', undefined, 'reset-requests'); requestsSection.append(requestsHead, requestsList);

  const ownerSection = make('section', undefined, 'panel users-section'); ownerSection.hidden = currentUser?.id !== 'owner';
  const ownerHead = make('div', undefined, 'users-section-heading'); ownerHead.append(make('h3', 'Owner email'), make('p', 'Changing the owner email requires the owner’s current password and email verification.', 'muted small'));
  const ownerForm = make('form', undefined, 'owner-email-form');
  const ownerEmailLabel = make('label', 'New email'); const ownerEmail = make('input'); ownerEmail.type = 'email'; ownerEmail.required = true; ownerEmail.maxLength = 254; ownerEmail.autocomplete = 'email'; ownerEmailLabel.append(ownerEmail);
  const ownerPasswordLabel = make('label', 'Current password'); const ownerPassword = make('input'); ownerPassword.type = 'password'; ownerPassword.required = true; ownerPassword.maxLength = 1024; ownerPassword.autocomplete = 'current-password'; ownerPasswordLabel.append(ownerPassword);
  const ownerSubmit = make('button', 'Send verification', 'button primary'); ownerSubmit.type = 'submit';
  ownerForm.append(ownerEmailLabel, ownerPasswordLabel, ownerSubmit); ownerSection.append(ownerHead, ownerForm);

  root.append(heading, provider, status, error, invite, usersSection, requestsSection, ownerSection); host.replaceChildren(root);

  function clearMessages() { error.textContent = ''; status.textContent = ''; }
  function failure(reason) { error.textContent = reason?.message || 'Unable to complete this action.'; }
  function setEmailActions() {
    const reason = 'Complete the one-time security setup before using email actions.';
    for (const control of [inviteSubmit, ownerSubmit, ...root.querySelectorAll('[data-email-action]')]) {
      control.disabled = !emailConfigured || control.dataset.blocked === 'true';
      control.title = emailConfigured ? '' : reason;
    }
    provider.dataset.state = emailConfigured ? 'available' : 'required';
    providerTitle.textContent = emailConfigured ? 'Email settings are available' : 'Account email setup required';
    providerCopy.textContent = emailConfigured
      ? 'Email connection settings are present. Each new recipient must verify their inbox in Cloudflare before an invitation can be sent.'
      : 'Invitations, password resets and owner email verification are unavailable until the one-time connection is added.';
    if (!setupDisclosureInitialized) {
      setupGuide.open = !emailConfigured;
      setupDisclosureInitialized = true;
    }
  }

  async function run(control, work, success) {
    clearMessages(); control.disabled = true; const label = control.textContent; control.textContent = 'Working…';
    try { await work(); if (disposed) return false; await load(); status.textContent = success; return true; }
    catch (reason) { if (!disposed) { await load(); failure(reason); } return false; }
    finally { if (!disposed) { control.textContent = label; control.disabled = false; setEmailActions(); } }
  }

  function renderUsers(users) {
    const table = make('table'); const caption = make('caption', 'Workspace users, roles, status and account actions', 'sr-only'); table.append(caption);
    const head = make('thead'); const header = make('tr');
    for (const label of ['User', 'Email', 'Role', 'Status', 'Actions']) { const th = make('th', label); th.scope = 'col'; header.append(th); }
    head.append(header); table.append(head); const body = make('tbody');
    for (const account of users) {
      const row = make('tr');
      const identity = make('td'); identity.append(make('strong', account.username || 'Pending user'));
      if (account.id === currentUser?.id) identity.append(make('span', 'You', 'user-you'));
      const emailCell = make('td'); const invited = ['invited', 'pending'].includes(account.status);
      const emailInput = invited ? make('input') : null;
      if (emailInput) { emailInput.type = 'email'; emailInput.value = account.email || ''; emailInput.required = true; emailInput.maxLength = 254; emailInput.setAttribute('aria-label', `Email for ${account.username}`); emailCell.append(emailInput); }
      else emailCell.append(document.createTextNode(account.email || '-'));
      if (account.email_verified_at) emailCell.append(make('span', 'CRM verified', 'user-verified'));
      const immutable = account.id === 'owner' || account.id === currentUser?.id;
      const roleCell = make('td'); const roleSelect = make('select'); roleSelect.setAttribute('aria-label', `Role for ${account.username}`);
      for (const value of ['admin', 'manager', 'viewer']) { const option = make('option', roleLabel(value)); option.value = value; roleSelect.append(option); }
      roleSelect.value = account.role; roleSelect.disabled = immutable; roleCell.append(roleSelect);
      const statusCell = make('td'); const statusSelect = make('select'); statusSelect.setAttribute('aria-label', `Status for ${account.username}`);
      for (const value of ['active', 'disabled']) { const option = make('option', value === 'active' ? 'Active' : 'Disabled'); option.value = value; statusSelect.append(option); }
      statusSelect.value = account.status === 'disabled' ? 'disabled' : 'active'; statusSelect.disabled = immutable || invited; statusCell.append(statusSelect);
      if (invited) statusCell.replaceChildren(make('span', 'Invitation pending', 'status-pill'));
      const actions = make('td'); const actionGroup = make('div', undefined, 'user-actions');
      if (!immutable) {
        const save = make('button', 'Save', 'button secondary'); save.type = 'button';
        save.addEventListener('click', () => run(save, () => request(`/api/admin/users/${encodeURIComponent(account.id)}`, { method: 'PATCH', body: JSON.stringify({ role: roleSelect.value, ...(invited ? {email:emailInput.value.trim()} : {status:statusSelect.value}) }) }), invited ? 'Invitation corrected. Resend it to issue a current link.' : 'User access updated.'));
        actionGroup.append(save);
        if (invited) {
          const disable = make('button', 'Disable', 'text-button'); disable.type = 'button';
          disable.addEventListener('click', () => run(disable, () => request(`/api/admin/users/${encodeURIComponent(account.id)}`, {method:'PATCH',body:JSON.stringify({status:'disabled'})}), 'Invitation disabled.'));
          actionGroup.append(disable);
        }
      }
      if (invited) {
        const resend = make('button', 'Resend invite', 'text-button'); resend.type = 'button'; resend.dataset.emailAction = '';
        resend.addEventListener('click', () => run(resend, () => request(`/api/admin/users/${encodeURIComponent(account.id)}/invite`, { method: 'POST', body: '{}' }), 'Invitation sent.'));
        actionGroup.append(resend);
      } else if (account.status === 'active') {
        const reset = make('button', 'Send reset', 'text-button'); reset.type = 'button'; reset.dataset.emailAction = '';
        reset.addEventListener('click', () => run(reset, () => request(`/api/admin/users/${encodeURIComponent(account.id)}/reset`, { method: 'POST', body: '{}' }), 'Password reset email sent.'));
        actionGroup.append(reset);
      }
      if (account.id === 'owner') actionGroup.append(make('span', 'Owner account', 'muted small'));
      actions.append(actionGroup); row.append(identity, emailCell, roleCell, statusCell, actions); body.append(row);
    }
    if (!users.length) { const row = make('tr'); const cell = make('td', 'No workspace users found.', 'muted'); cell.colSpan = 5; row.append(cell); body.append(row); }
    table.append(body); usersTable.replaceChildren(table);
  }

  function renderRequests(requests) {
    requestsList.replaceChildren();
    const pending = requests.filter(item => item.status === 'pending');
    if (!pending.length) { requestsList.append(make('p', 'No password reset requests are waiting for review.', 'muted small reset-empty')); return; }
    for (const item of pending) {
      const row = make('article', undefined, 'reset-request-row'); const text = make('div');
      text.append(make('strong', item.username || item.email), make('p', `${item.email} · Requested ${dateLabel(item.created_at)}`, 'muted small'));
      const actions = make('div', undefined, 'user-actions'); const selfRequest = item.user_id === currentUser?.id;
      const approve = make('button', selfRequest ? 'Another admin required' : 'Approve', 'button secondary'); approve.type = 'button'; approve.dataset.emailAction = ''; approve.dataset.blocked = String(selfRequest); approve.disabled = selfRequest;
      if (selfRequest) approve.title = 'An administrator cannot approve their own password reset request.';
      else approve.addEventListener('click', () => run(approve, () => request(`/api/admin/users/reset-requests/${encodeURIComponent(item.id)}/approve`, { method: 'POST', body: '{}' }), 'Reset request approved and email sent.'));
      const reject = make('button', 'Reject', 'text-button'); reject.type = 'button'; reject.addEventListener('click', () => run(reject, () => request(`/api/admin/users/reset-requests/${encodeURIComponent(item.id)}/reject`, { method: 'POST', body: '{}' }), 'Reset request rejected.'));
      actions.append(approve, reject); row.append(text, actions); requestsList.append(row);
    }
  }

  async function load() {
    clearMessages(); status.textContent = 'Loading users…'; root.setAttribute('aria-busy', 'true');
    try {
      const data = await request('/api/admin/users'); if (disposed) return;
      emailConfigured = data.email_configured === true; renderUsers(data.users || []); renderRequests(data.requests || []); status.textContent = ''; setEmailActions();
    } catch (reason) { if (!disposed) { status.textContent = ''; failure(reason); } }
    finally { if (!disposed) root.removeAttribute('aria-busy'); }
  }

  inviteForm.addEventListener('submit', event => {
    event.preventDefault();
    run(inviteSubmit, () => request('/api/admin/users', { method: 'POST', body: JSON.stringify({ email: email.value.trim(), username: username.value.trim(), role: role.value }) }), 'Invitation sent.').then(saved => { if (saved) inviteForm.reset(); });
  });
  ownerForm.addEventListener('submit', event => {
    event.preventDefault();
    run(ownerSubmit, () => request('/api/admin/users/owner-email', { method: 'POST', body: JSON.stringify({ email: ownerEmail.value.trim(), current_password: ownerPassword.value }) }), 'Verification email sent to the new owner address.').then(saved => { if (saved) ownerForm.reset(); else ownerPassword.value = ''; });
  });
  refresh.addEventListener('click', load); load();
  return { refresh: load, dispose() { disposed = true; } };
}
