/**
 * Framework-free multi-step lead lightbox.
 * DOM contract: see references/build-contract.md.
 */
(() => {
  const modal = document.querySelector('#lead-modal');
  if (!modal) return;

  const form = modal.querySelector('.wizard[data-lead-form]');
  if (!form) return;

  const steps = Array.from(form.querySelectorAll('.wizard__step'));
  const nextButton = form.querySelector('[data-next]');
  const backButton = form.querySelector('[data-back]');
  const submitButton = form.querySelector('[data-submit]');
  const closeButton = modal.querySelector('[data-close-modal], .modal__close');
  const stepCounter = modal.querySelector('[data-step-current]');
  const progress = modal.querySelector('[data-progress]');
  const errorRegion = form.querySelector('[data-form-error]');
  const attributionKeys = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid'
  ];

  const storagePrefix = form.dataset.storagePrefix || 'lead_funnel_';
  const thankYouUrl = form.dataset.thankYou || 'thank-you.html';
  const fallbackPhone = form.dataset.fallbackPhone || '';
  const originalSubmitLabel = submitButton?.textContent || 'Submit';
  let currentStep = 0;
  let modalTrigger = null;
  let submitting = false;
  let requestId = crypto.randomUUID();
  let uncertainBody = null;
  const entryControls = Array.from(form.querySelectorAll("input, select, textarea"));
  const setPending = (value) => {
    [nextButton, backButton].forEach(button => { if (button) button.disabled = value; });
    entryControls.forEach(field => { field.disabled = value; });
  };
  const safeStorage = { get(key) { try { return sessionStorage.getItem(key); } catch { return null; } }, set(key, value) { try { sessionStorage.setItem(key, value); } catch {} } };

  const setError = (message = '') => {
    if (errorRegion) {
      errorRegion.textContent = message;
      errorRegion.hidden = !message;
    }
  };

  const showStep = (index, moveFocus = true) => {
    currentStep = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach((step, stepIndex) => { step.hidden = stepIndex !== currentStep; });
    if (stepCounter) stepCounter.textContent = String(currentStep + 1);
    if (progress) progress.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
    if (backButton) backButton.hidden = currentStep === 0;
    if (nextButton) nextButton.hidden = currentStep === steps.length - 1;
    if (submitButton) submitButton.hidden = currentStep !== steps.length - 1;
    setError();

    if (moveFocus) {
      const heading = steps[currentStep].querySelector('legend, h2, h3');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  };

  const validateCurrentStep = () => {
    const fields = Array.from(steps[currentStep].querySelectorAll('input, select, textarea'));
    let firstInvalid = null;
    fields.forEach((field) => {
      field.removeAttribute('aria-invalid');
      if (!field.checkValidity()) {
        field.setAttribute('aria-invalid', 'true');
        firstInvalid ||= field;
      }
    });
    if (!firstInvalid) return true;
    firstInvalid.reportValidity();
    firstInvalid.focus({ preventScroll: true });
    return false;
  };

  const openModal = (trigger) => {
    modalTrigger = trigger;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (!submitting && !uncertainBody) showStep(0, false);
    const first = Array.from(form.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])')).find(element => element.getClientRects().length > 0);
    (first || closeButton)?.focus({ preventScroll: true });
  };

  const closeModal = () => {
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    modalTrigger?.focus();
  };

  document.querySelectorAll('[data-open-modal]').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openModal(trigger);
    });
  });
  closeButton?.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(modal.querySelectorAll(
      'button:not([hidden]):not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
    )).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    // Safari/macOS may skip buttons in its native Tab order. Own the complete
    // modal cycle so focus cannot escape through the last text input.
    const activeIndex = focusable.indexOf(document.activeElement);
    const direction = event.shiftKey ? -1 : 1;
    const nextIndex = activeIndex < 0 ? (event.shiftKey ? focusable.length - 1 : 0) : (activeIndex + direction + focusable.length) % focusable.length;
    event.preventDefault();
    focusable[nextIndex].focus({ preventScroll: true });
  });

  form.addEventListener('input', (event) => event.target.removeAttribute('aria-invalid'));
  form.addEventListener('change', (event) => event.target.removeAttribute('aria-invalid'));
  nextButton?.addEventListener('click', () => {
    if (!submitting && !uncertainBody && validateCurrentStep()) showStep(currentStep + 1);
  });
  backButton?.addEventListener('click', () => { if (!submitting && !uncertainBody) showStep(currentStep - 1); });

  const search = new URLSearchParams(window.location.search);
  attributionKeys.forEach((key) => {
    const value = search.get(key);
    if (value) safeStorage.set(`${storagePrefix}${key}`, value);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (currentStep < steps.length - 1 && !uncertainBody) { if (validateCurrentStep()) showStep(currentStep + 1); return; }
    for (let i = 0; i < steps.length; i++) {
      if (Array.from(steps[i].querySelectorAll('input, select, textarea')).some(field => !field.checkValidity())) {
        showStep(i); validateCurrentStep(); return;
      }
    }
    submitting = true;
    const payload = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type=checkbox][name]').forEach(field => { payload[field.name] = field.checked; });

    setPending(true);
    submitButton.disabled = true;
    submitButton.textContent = form.dataset.submittingLabel || 'Sending…';
    setError();

    let delivered = false;
    let result;
    try {
      const webhook = form.dataset.endpoint?.trim() || form.dataset.webhook?.trim();
      if (webhook) {
        const controller = new AbortController();
        const timeoutMs = Math.min(60000, Math.max(1000, Number(form.dataset.webhookTimeout) || 15000));
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
        let response;
        try {
          const context = window.LeadFunnel ? await window.LeadFunnel.context() : {};
          const { website = '', ...formData } = payload;
          const body = uncertainBody || { ...context, idempotency_key: requestId, form_name: form.dataset.formName || 'lead_form', form_data: formData, website };
          uncertainBody = body;
          response = await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          if (!response.ok) {
            // Ordinary validation/abuse rejection cannot have stored this request.
            if ([400,403,413,415,422,429].includes(response.status)) { uncertainBody = null; requestId = crypto.randomUUID(); }
            const failure = new Error(`Lead endpoint returned HTTP ${response.status}`);
            if (response.status >= 400 && response.status < 500) { try { const detail=await response.json(); if(typeof detail.error==='string') failure.publicMessage=detail.error.slice(0,200); } catch {} }
            throw failure;
          }
          result = await response.json();
          if (result?.ok !== true || typeof result.receipt_id !== 'string' || !result.receipt_id || typeof result.lead_id !== 'string' || !result.lead_id) throw new Error('Lead was not acknowledged');
          delivered = true;
          uncertainBody = null;
        } finally {
          window.clearTimeout(timeoutId);
        }

      } else if (form.dataset.localPreview !== 'true') {
        throw new Error('Lead delivery is not configured. Add data-webhook or explicitly use data-local-preview="true".');
      }
    } catch (error) {
      console.warn('Lead submission could not be confirmed.');
      submitting = false;
      setPending(Boolean(uncertainBody));
      submitButton.disabled = false;
      submitButton.textContent = originalSubmitLabel;
      const fallback = fallbackPhone ? ` Please call ${fallbackPhone}.` : '';
      const message = uncertainBody ? `We could not confirm whether your request was saved. Retry to check the same request safely; your details are kept unchanged.${fallback}` : `${error.publicMessage || "We could not accept your request. Check your details and try again."}${fallback}`;
      setError(message);
      if (errorRegion) errorRegion.focus();
      else window.alert(message);
      return;
    }

    if (delivered) {
      // Lead storage succeeded. Analytics failure must not invite a duplicate submission.
      try { window.LeadFunnel?.accepted(result); } catch {}
    }

    window.location.assign(thankYouUrl);
  });

  showStep(0, false);
})();
