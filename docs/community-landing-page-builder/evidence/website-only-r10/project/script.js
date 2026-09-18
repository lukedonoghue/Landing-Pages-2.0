(() => {
  "use strict";

  const menuButton = document.querySelector(".menu-button");
  const primaryNav = document.querySelector(".primary-nav");
  const dialog = document.querySelector("#quote-dialog");
  const quoteForm = document.querySelector("#quote-form");
  const successPanel = document.querySelector("#quote-success");
  const successLabel = successPanel.querySelector(".success-label");
  const successTitle = document.querySelector("#success-title");
  const successCopy = document.querySelector("#success-copy");
  const quoteIntro = document.querySelector("#quote-intro");
  const errorSummary = document.querySelector("#form-errors");
  const errorList = errorSummary.querySelector("ul");
  const submitError = document.querySelector("#submit-error");
  const submitButton = quoteForm.querySelector('button[type="submit"]');
  const qaMode = new URLSearchParams(window.location.search).get("qa");
  const isLocalPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  let lastOpener = null;
  let inFlight = false;

  const fields = {
    service: {
      input: document.querySelector("#service"),
      error: document.querySelector("#service-error"),
      label: "Service needed",
      validate: (value) => value ? "" : "Choose the service you need."
    },
    frequency: {
      input: quoteForm.elements.frequency,
      fieldset: document.querySelector(".frequency-field"),
      error: document.querySelector("#frequency-error"),
      label: "Cleaning frequency",
      validate: () => quoteForm.querySelector('input[name="frequency"]:checked') ? "" : "Choose one-off or regular cleaning."
    },
    name: {
      input: document.querySelector("#name"),
      error: document.querySelector("#name-error"),
      label: "Your name",
      validate: (value) => value.trim() ? "" : "Enter your name."
    },
    email: {
      input: document.querySelector("#email"),
      error: document.querySelector("#email-error"),
      label: "Email",
      validate: (value, input) => {
        if (!value.trim()) return "Enter your email address.";
        return input.validity.typeMismatch ? "Enter a valid email address." : "";
      }
    },
    phone: {
      input: document.querySelector("#phone"),
      error: document.querySelector("#phone-error"),
      label: "Phone number",
      validate: (value) => {
        const digits = value.replace(/\D/g, "");
        if (!value.trim()) return "Enter your phone number.";
        return digits.length >= 7 && digits.length <= 15 ? "" : "Enter a usable phone number."
      }
    },
    address: {
      input: document.querySelector("#address"),
      error: document.querySelector("#address-error"),
      label: "Address",
      validate: (value) => value.trim() ? "" : "Enter the property address."
    },
    postcode: {
      input: document.querySelector("#postcode"),
      error: document.querySelector("#postcode-error"),
      label: "Postcode",
      validate: (value) => value.trim() ? "" : "Enter the property postcode."
    }
  };

  function setMenu(open) {
    primaryNav.dataset.open = String(open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  }

  menuButton.addEventListener("click", () => {
    setMenu(menuButton.getAttribute("aria-expanded") !== "true");
  });

  primaryNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenu(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      menuButton.focus();
    }
  });

  function clearSubmitError() {
    submitError.hidden = true;
    submitError.textContent = "";
  }

  function resetDialogView() {
    quoteForm.hidden = false;
    successPanel.hidden = true;
    quoteIntro.textContent = isLocalPreview
      ? "Tell us about the property and the clean you need. This local preview does not send details."
      : "Tell us about the property and the clean you need.";
    clearSubmitError();
  }

  function openDialog(opener) {
    lastOpener = opener;
    resetDialogView();
    dialog.showModal();
    window.requestAnimationFrame(() => fields.service.input.focus());
  }

  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => openDialog(button));
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => dialog.close());
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener("close", () => {
    if (lastOpener && document.contains(lastOpener)) lastOpener.focus();
  });

  function visibleDialogControls() {
    return Array.from(dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((control) => !control.hidden && control.getClientRects().length > 0);
  }

  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = visibleDialogControls();
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener("focusin", (event) => {
    if (!dialog.open || dialog.contains(event.target)) return;
    const controls = visibleDialogControls();
    if (controls.length) controls[0].focus();
  });

  function getValue(field) {
    if (field === fields.frequency) {
      return quoteForm.querySelector('input[name="frequency"]:checked')?.value || "";
    }
    return field.input.value;
  }

  function setFieldState(key, message) {
    const field = fields[key];
    field.error.textContent = message;
    field.error.hidden = !message;
    if (field.fieldset) {
      field.fieldset.setAttribute("aria-invalid", String(Boolean(message)));
    } else {
      field.input.setAttribute("aria-invalid", String(Boolean(message)));
    }
  }

  function collectErrors() {
    const errors = [];
    Object.entries(fields).forEach(([key, field]) => {
      const message = field.validate(getValue(field), field.input);
      setFieldState(key, message);
      if (message) errors.push({ key, label: field.label, message });
    });
    return errors;
  }

  function renderSummary(errors) {
    errorList.replaceChildren();
    errors.forEach(({ key, label, message }) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = key === "frequency" ? "#frequency-error" : `#${key}`;
      link.textContent = `${label}: ${message}`;
      item.append(link);
      errorList.append(item);
    });
    errorSummary.hidden = errors.length === 0;
  }

  function refreshValidation() {
    const errors = collectErrors();
    renderSummary(errors);
    return errors;
  }

  Object.entries(fields).forEach(([key, field]) => {
    const targets = key === "frequency" ? quoteForm.querySelectorAll('input[name="frequency"]') : [field.input];
    targets.forEach((target) => {
      const eventName = target.type === "radio" || target.tagName === "SELECT" ? "change" : "input";
      target.addEventListener(eventName, () => {
        const message = field.validate(getValue(field), field.input);
        setFieldState(key, message);
        if (!errorSummary.hidden) {
          const errors = Object.entries(fields).flatMap(([currentKey, currentField]) => {
            const currentMessage = currentField.validate(getValue(currentField), currentField.input);
            return currentMessage ? [{ key: currentKey, label: currentField.label, message: currentMessage }] : [];
          });
          renderSummary(errors);
        }
        clearSubmitError();
      });
    });
  });

  quoteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (inFlight) return;

    clearSubmitError();
    const errors = refreshValidation();
    if (errors.length) {
      errorSummary.focus();
      return;
    }

    inFlight = true;
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

    const payload = Object.fromEntries(new FormData(quoteForm).entries());
    const endpoint = qaMode ? `${quoteForm.action}?mode=${encodeURIComponent(qaMode)}` : quoteForm.action;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error("Preview receiver rejected the request.");

      const previewResponse = result.preview === true;
      successLabel.textContent = previewResponse ? "Quote preview" : "Request received";
      successTitle.textContent = previewResponse
        ? "Preview complete. Nothing was sent."
        : "Thanks. Your quote request has been sent.";
      successCopy.textContent = previewResponse
        ? "The form journey is working locally. Close this message to return to the page."
        : "Stayclean normally replies within one working day.";
      quoteForm.hidden = true;
      successPanel.hidden = false;
      successPanel.focus();
    } catch (error) {
      submitError.textContent = isLocalPreview
        ? "This preview does not send details. Your entries are still here. Please try again after the form connection is available."
        : "We could not send your quote request. Your entries are still here. Please try again or call 0800 8560 120.";
      submitError.hidden = false;
      submitError.focus();
    } finally {
      inFlight = false;
      submitButton.disabled = false;
      submitButton.textContent = "Send quote request";
    }
  });
})();
