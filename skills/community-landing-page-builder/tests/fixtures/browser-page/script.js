const dialog = document.querySelector('#lead-modal');
let opener = null;
document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-open-modal]');
  if (!trigger) return;
  opener = trigger;
  dialog.showModal();
});
dialog.addEventListener('close', () => opener?.focus());
