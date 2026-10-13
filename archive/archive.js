'use strict';
const search = document.querySelector('#archive-search');
const cards = [...document.querySelectorAll('.archive-card')];
document.querySelector('.search-tools').hidden = false;
search.addEventListener('input', () => {
  const query = search.value.trim().toLocaleLowerCase();
  let count = 0;
  cards.forEach(card => {
    const matches = card.dataset.search.toLocaleLowerCase().includes(query);
    card.hidden = !matches;
    if (matches) count++;
  });
  document.querySelector('#result-count').textContent = `${count} project${count === 1 ? '' : 's'}`;
  document.querySelector('#empty-state').hidden = count !== 0;
});
