(() => {
  'use strict';

  const selectText = (field) => {
    field.focus();
    field.select();
    field.setSelectionRange(0, field.value.length);
  };

  document.querySelectorAll('[data-copy-prompt]').forEach((button) => {
    const field = document.getElementById(button.dataset.copyPrompt);
    const status = document.getElementById(button.getAttribute('aria-describedby'));
    if (!field || !status) return;
    let copying = false;
    button.hidden = false;
    button.addEventListener('click', async () => {
      if (copying) return;
      copying = true;
      button.setAttribute('aria-busy', 'true');
      status.textContent = '';
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(field.value);
        status.textContent = 'Copied to clipboard.';
      } catch {
        selectText(field);
        status.textContent = 'Automatic copy unavailable. Text selected; press Ctrl+C or Command+C, or use your device’s Copy menu.';
      } finally {
        copying = false;
        button.removeAttribute('aria-busy');
      }
    });
  });

  document.querySelectorAll('[data-select-prompt]').forEach((button) => {
    const field = document.getElementById(button.dataset.selectPrompt);
    const status = button.closest('.prompt-actions')?.querySelector('[role="status"]');
    if (!field || !status) return;
    button.hidden = false;
    button.addEventListener('click', () => {
      selectText(field);
      status.textContent = 'Text selected; press Ctrl+C or Command+C, or use your device’s Copy menu.';
    });
  });
})();
