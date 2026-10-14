'use strict';
(() => {
  const root = document.querySelector('.alumni-directory');
  if (!root) return;
  const cards = [...root.querySelectorAll('[data-alumni-card]')];
  const search = root.querySelector('#alumni-search');
  const category = root.querySelector('#alumni-category');
  const count = root.querySelector('#alumni-count');
  const more = root.querySelector('#alumni-more');
  let limit = 12;
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  function render(reset = false) {
    if (reset) limit = 12;
    const query = normalize(search.value.trim());
    const matches = cards.filter(card => (!category.value || card.dataset.category === category.value) && normalize(card.textContent).includes(query));
    const visible = new Set(matches.slice(0, limit));
    cards.forEach(card => { card.hidden = !visible.has(card); });
    count.textContent = `Showing ${visible.size} of ${matches.length} people${matches.length !== cards.length ? ` (${cards.length} total)` : ''}`;
    more.hidden = matches.length <= limit;
    root.querySelector('#alumni-empty').hidden = matches.length !== 0;
  }
  search.addEventListener('input', () => render(true));
  category.addEventListener('change', () => render(true));
  root.querySelector('#alumni-clear').addEventListener('click', () => { search.value = ''; category.value = ''; render(true); search.focus(); });
  search.addEventListener('keydown', event => { if (event.key === 'Escape') { search.value = ''; render(true); } });
  more.addEventListener('click', () => { limit += 12; render(); });
  root.querySelector('.alumni-controls').hidden = false;
  render();
})();
