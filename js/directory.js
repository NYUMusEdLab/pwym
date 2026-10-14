'use strict';

// Every item is present in the HTML. Search is an optional enhancement.
document.querySelectorAll('[data-directory]').forEach(directory => {
  const search = directory.querySelector('input[type="search"]');
  const items = [...directory.querySelectorAll('[data-directory-item]')];
  const count = directory.querySelector('[data-result-count]');
  const empty = directory.querySelector('[data-empty-state]');
  const label = directory.dataset.directory;
  if (!search) return;
  directory.querySelector('.directory-toolbar').hidden = false;
  const filter = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    items.forEach(item => {
      const matches = `${item.dataset.search || ''} ${item.textContent}`.toLocaleLowerCase().includes(query);
      item.hidden = !matches;
      if (matches) visible++;
    });
    count.textContent = `${visible} of ${items.length} ${label}`;
    empty.hidden = visible !== 0;
  };
  search.addEventListener('input', filter);
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      search.value = '';
      filter();
    }
  });
  filter();
});
