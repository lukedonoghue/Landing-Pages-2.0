(() => {
  const modal = document.querySelector('#lead-modal');
  const form = modal?.querySelector('[data-lead-form]');
  if (!modal || !form) return;

  const steps = Array.from(form.querySelectorAll('.wizard-step, .wizard__step'));
  const nextButton = form.querySelector('[data-next]');
  const backButton = form.querySelector('[data-back]');
  const submitButton = form.querySelector('[data-submit]');
  const closeButton = modal.querySelector('[data-close-modal]');
  const modalTitle = modal.querySelector('#lead-modal-title');
  const modalScroll = modal.querySelector('.modal-scroll');
  const stepCounter = modal.querySelector('[data-step-current]');
  const progress = modal.querySelector('[data-progress]');
  const errorRegion = form.querySelector('[data-form-error]');
  const errorTitle = errorRegion?.querySelector('strong');
  const errorList = errorRegion?.querySelector('[data-error-list]');
  const entryControls = Array.from(form.querySelectorAll('input, select, textarea'));
  const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_term', 'utm_content', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic', 'gclid', 'dclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid'];
  const storagePrefix = form.dataset.storagePrefix || 'lead_funnel_';
  const thankYouUrl = form.dataset.thankYou || 'thank-you.html';
  const fallbackPhone = form.dataset.fallbackPhone || '';
  const originalSubmitLabel = submitButton?.textContent || 'Submit';
  const errors = new Map();

  let currentStep = 0;
  let modalTrigger = null;
  let pagePosition = 0;
  let submitting = false;
  let requestId = crypto.randomUUID();
  let uncertainBody = null;
  let erased = false;

  const controlsForName = (name) => Array.from(form.querySelectorAll(`[name="${CSS.escape(name)}"]`));
  const firstControl = (name) => controlsForName(name)[0] || null;
  const groupFor = (control) => control?.closest('[data-field-group]') || null;
  const labelFor = (control) => {
    if (!control) return 'This field';
    if (control.type === 'radio') return control.closest('.choice-group')?.querySelector('legend')?.textContent?.trim() || 'Contact method';
    const label = groupFor(control)?.querySelector('label');
    return label?.childNodes?.[0]?.textContent?.trim() || control.name.replaceAll('_', ' ');
  };
  const errorNodeFor = (control) => groupFor(control)?.querySelector('[data-field-error]') || null;
  const targetFor = (control) => control?.type === 'radio' ? control.closest('.choice-group') : control;
  const usableTarget = (control) => control?.type === 'radio' ? controlsForName(control.name).find(item => item.checked) || control : control;

  const ensureTargetId = (control) => {
    const target = usableTarget(control);
    if (!target) return '';
    if (!target.id) target.id = `field-${control.name.replaceAll('_', '-')}`;
    return target.id;
  };

  const setPending = (value) => {
    [nextButton, backButton].forEach((button) => { if (button) button.disabled = value; });
    entryControls.forEach((field) => { field.disabled = value; });
  };

  const renderErrors = (focus = false) => {
    if (!errorRegion) return;
    if (!errorList || !errorTitle) {
      errorRegion.textContent = errors.size ? [...errors.values()].join(' ') : '';
      errorRegion.hidden = errors.size === 0;
      if (focus && errors.size) errorRegion.focus({ preventScroll: true });
      return;
    }
    errorList.replaceChildren();
    if (!errors.size) {
      errorRegion.hidden = true;
      return;
    }
    errorTitle.textContent = 'Check the highlighted details.';
    for (const [name, message] of errors) {
      const control = firstControl(name);
      const id = ensureTargetId(control);
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${id}`;
      link.textContent = `${labelFor(control)}: ${message}`;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const target = usableTarget(control);
        groupFor(control)?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        window.setTimeout(() => target?.focus({ preventScroll: true }), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
      });
      item.append(link);
      errorList.append(item);
    }
    errorRegion.hidden = false;
    if (focus) {
      errorRegion.scrollIntoView({ block: 'nearest' });
      errorRegion.focus({ preventScroll: true });
    }
  };

  const showGlobalError = (message) => {
    errors.clear();
    if (!errorRegion) return;
    if (!errorList || !errorTitle) {
      errorRegion.textContent = message;
      errorRegion.hidden = false;
      errorRegion.focus({ preventScroll: true });
      return;
    }
    errorList.replaceChildren();
    errorTitle.textContent = message;
    errorRegion.hidden = false;
    errorRegion.scrollIntoView({ block: 'nearest' });
    errorRegion.focus({ preventScroll: true });
  };

  const clearGlobalError = () => {
    if (!errorRegion || errors.size) return;
    errorRegion.hidden = true;
    if (!errorList || !errorTitle) errorRegion.textContent = '';
  };

  const messageFor = (control) => {
    const fields = controlsForName(control.name);
    if (control.type === 'radio') return fields.some((field) => field.checked) ? '' : 'Choose phone or email.';
    if (control.type === 'checkbox') return control.required && !control.checked ? 'Confirm that this enquiry uses synthetic test data.' : '';
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    if (control.required && !value) return 'Enter a value.';
    if (!value) return '';
    if (control.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
    if (control.type === 'tel') {
      if (/[A-Za-z]/.test(value)) return 'Use digits and normal international phone punctuation only.';
      const normalized = value.replace(/[\s().-]/g, '');
      if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return 'Use international format, such as +44 7700 900123.';
    }
    if (control.maxLength > -1 && value.length > control.maxLength) return `Use no more than ${control.maxLength} characters.`;
    return '';
  };

  const setFieldError = (control, message) => {
    const name = control.name;
    const errorNode = errorNodeFor(control);
    const target = targetFor(control);
    for (const field of controlsForName(name)) field.setAttribute('aria-invalid', 'true');
    target?.setAttribute('aria-invalid', 'true');
    if (errorNode) {
      errorNode.textContent = message;
      errorNode.hidden = false;
      for (const field of controlsForName(name)) {
        const ids = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
        ids.add(errorNode.id);
        field.setAttribute('aria-describedby', [...ids].join(' '));
      }
    }
    errors.set(name, message);
  };

  const clearFieldError = (name) => {
    const control = firstControl(name);
    const errorNode = errorNodeFor(control);
    for (const field of controlsForName(name)) {
      field.removeAttribute('aria-invalid');
      if (errorNode) {
        const ids = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id && id !== errorNode.id);
        if (ids.length) field.setAttribute('aria-describedby', ids.join(' '));
        else field.removeAttribute('aria-describedby');
      }
    }
    targetFor(control)?.removeAttribute('aria-invalid');
    if (errorNode) {
      errorNode.textContent = '';
      errorNode.hidden = true;
    }
    errors.delete(name);
  };

  const controlsInStep = (index) => {
    const found = Array.from(steps[index].querySelectorAll('input, select, textarea')).filter((field) => field.name && field.name !== 'website');
    return found.filter((field, position) => found.findIndex((item) => item.name === field.name) === position);
  };

  const validateStep = (index, focus = true) => {
    for (const control of controlsInStep(index)) {
      clearFieldError(control.name);
      const message = messageFor(control);
      if (message) setFieldError(control, message);
    }
    renderErrors(focus && errors.size > 0);
    return errors.size === 0;
  };

  const showStep = (index, focus = true) => {
    currentStep = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach((step, stepIndex) => { step.hidden = stepIndex !== currentStep; });
    errors.clear();
    errorRegion.hidden = true;
    if (stepCounter) stepCounter.textContent = String(currentStep + 1);
    if (progress) progress.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
    if (backButton) backButton.hidden = currentStep === 0;
    if (nextButton) nextButton.hidden = currentStep === steps.length - 1;
    if (submitButton) submitButton.hidden = currentStep !== steps.length - 1;
    modalScroll?.scrollTo({ top: 0, behavior: 'auto' });
    if (focus) {
      const legend = steps[currentStep].querySelector('legend');
      if (legend) {
        legend.tabIndex = -1;
        legend.focus({ preventScroll: true });
      }
    }
  };

  const openModal = (trigger) => {
    modalTrigger = trigger;
    pagePosition = window.scrollY;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const activeStep = steps[currentStep] || steps.find((step) => !step.hidden);
    const firstField = activeStep?.querySelector('input:not([type="hidden"]):not([tabindex="-1"]), select, textarea');
    if (firstField && firstField.getClientRects().length) firstField.focus({ preventScroll: true });
    else {
      modalTitle.tabIndex = -1;
      modalTitle.focus({ preventScroll: true });
    }
  };

  const closeModal = () => {
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    window.scrollTo({ top: pagePosition, behavior: 'auto' });
    modalTrigger?.focus({ preventScroll: true });
  };

  document.querySelectorAll('[data-open-modal]').forEach((trigger) => trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openModal(trigger);
  }));
  closeButton?.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(modal.querySelectorAll('button:not([hidden]):not([disabled]), input:not([disabled]):not([tabindex="-1"]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href]')).filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const activeIndex = focusable.indexOf(document.activeElement);
    const direction = event.shiftKey ? -1 : 1;
    const nextIndex = activeIndex < 0 ? (event.shiftKey ? focusable.length - 1 : 0) : (activeIndex + direction + focusable.length) % focusable.length;
    event.preventDefault();
    focusable[nextIndex].focus();
  });
  document.addEventListener('focusin', (event) => {
    if (modal.getAttribute('aria-hidden') === 'false' && !modal.contains(event.target)) closeButton?.focus({ preventScroll: true });
  });

  const correctField = (event) => {
    const control = event.target;
    if (!control.name || !errors.has(control.name)) return;
    const message = messageFor(firstControl(control.name));
    if (message) setFieldError(firstControl(control.name), message);
    else clearFieldError(control.name);
    renderErrors(false);
  };
  form.addEventListener('input', correctField);
  form.addEventListener('change', correctField);

  nextButton?.addEventListener('click', () => {
    if (!submitting && !uncertainBody && validateStep(currentStep)) showStep(currentStep + 1);
  });
  backButton?.addEventListener('click', () => { if (!submitting && !uncertainBody) showStep(currentStep - 1); });

  attributionKeys.forEach((key) => {
    try { sessionStorage.removeItem(`${storagePrefix}${key}`); } catch {}
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || erased) return;
    if (currentStep < steps.length - 1 && !uncertainBody) {
      if (validateStep(currentStep)) showStep(currentStep + 1);
      return;
    }
    if (!uncertainBody) {
      for (let index = 0; index < steps.length; index += 1) {
        if (!validateStep(index, false)) {
          showStep(index, false);
          validateStep(index, true);
          return;
        }
      }
    }

    submitting = true;
    const payload = Object.fromEntries(Array.from(new FormData(form).entries()).map(([name, value]) => [name, typeof value === 'string' ? value.trim() : value]));
    form.querySelectorAll('input[type="checkbox"][name]').forEach((field) => { payload[field.name] = field.checked; });
    setPending(true);
    submitButton.disabled = true;
    submitButton.textContent = form.dataset.submittingLabel || 'Sending...';
    clearGlobalError();

    let delivered = false;
    let result;
    let acceptedContext = {};
    try {
      const endpoint = form.dataset.endpoint?.trim();
      if (!endpoint) throw new Error('Lead delivery is not configured.');
      const controller = new AbortController();
      const timeoutMs = Math.min(60000, Math.max(1000, Number(form.dataset.webhookTimeout) || 15000));
      let timeoutId;
      try {
        const context = window.LeadFunnel ? await window.LeadFunnel.context() : {};
        const { website = '', ...formData } = payload;
        const candidate = uncertainBody || { ...context, idempotency_key: requestId, form_name: form.dataset.formName || 'lead_form', form_data: formData, website };
        uncertainBody = candidate;
        const body = window.LeadFunnel?.protectSubmission ? window.LeadFunnel.protectSubmission(candidate) : candidate;
        acceptedContext = body;
        timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (response.status === 410) {
          erased = true;
          uncertainBody = null;
          form.reset();
          throw new Error('Erased enquiry');
        }
        if (!response.ok) {
          if ([400, 403, 413, 415, 422, 429].includes(response.status)) {
            uncertainBody = null;
            requestId = crypto.randomUUID();
          }
          const failure = new Error(`Lead endpoint returned HTTP ${response.status}`);
          if (response.status >= 400 && response.status < 500) {
            try {
              const detail = await response.json();
              if (typeof detail.error === 'string') failure.publicMessage = detail.error.slice(0, 200);
            } catch {}
          }
          throw failure;
        }
        result = await response.json();
        if (result?.ok !== true || typeof result.receipt_id !== 'string' || !result.receipt_id || typeof result.lead_id !== 'string' || !result.lead_id) throw new Error('Lead was not acknowledged');
        delivered = true;
        uncertainBody = null;
      } finally {
        window.clearTimeout(timeoutId);
      }
    } catch (error) {
      console.warn('Test enquiry storage could not be confirmed.');
      submitting = false;
      setPending(Boolean(uncertainBody));
      submitButton.disabled = false;
      submitButton.textContent = originalSubmitLabel;
      if (erased) {
        setPending(true);
        submitButton.disabled = true;
        showGlobalError('This test enquiry can no longer be retried. Reload the page to start a new enquiry.');
        return;
      }
      const fallback = fallbackPhone ? ` The real business can be called on ${fallbackPhone}.` : '';
      const message = uncertainBody ? `We could not confirm whether your test enquiry was stored. Retry to check the same request safely; your details are kept unchanged.${fallback}` : `${error.publicMessage || 'We could not store your test enquiry. Check the details and try again.'}${fallback}`;
      showGlobalError(message);
      return;
    }

    if (delivered) {
      try { await window.LeadFunnel?.accepted(result, payload, acceptedContext); } catch {}
      window.location.assign(thankYouUrl);
    }
  });

  showStep(0, false);
})();
