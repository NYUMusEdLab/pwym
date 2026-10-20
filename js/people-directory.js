(() => {
  'use strict';
  const controls = document.querySelector('.people-controls');
  if (!controls) return;
  const cards = Array.from(document.querySelectorAll('[data-person]'));
  const groups = Array.from(document.querySelectorAll('.directory-group'));
  const search = document.querySelector('#people-search');
  const radios = Array.from(document.querySelectorAll('[name="people-group"]'));
  const involvement = document.querySelector('#people-involvement');
  const more = document.querySelector('#people-more');
  const all = document.querySelector('#people-all');
  const pagination = document.querySelector('.people-pagination');
  const count = document.querySelector('#people-count');
  const empty = document.querySelector('#people-empty');
  const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const index = new Map(cards.map(card => [card, normalize(card.textContent + ' ' + card.dataset.group + ' ' + card.dataset.category)]));
  let limit = 15;
  const selected = () => radios.find(r => r.checked).value;
  const matches = () => {
    const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    return cards.filter(card => (!selected() || card.dataset.group === selected()) && (!involvement.value || card.dataset.category === involvement.value) && words.every(word => index.get(card).includes(word)));
  };
  function save(clearHash = false) {
    const url = new URL(location.href);
    if (clearHash) url.hash = '';
    for (const [key, value] of [['q', search.value], ['group', selected()], ['involvement', involvement.value], ['show', limit > 15 ? String(limit) : '']]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(history.state, '', url);
  }
  function render(persist = true, clearHash = false) {
    const found = matches();
    const visible = new Set(found.slice(0, limit));
    cards.forEach(card => { card.hidden = !visible.has(card); });
    groups.forEach(group => { group.hidden = !Array.from(group.querySelectorAll('[data-person]')).some(card => !card.hidden); });
    const n = Math.min(found.length, limit);
    count.textContent = `Showing ${n} of ${found.length} ${found.length === 1 ? 'person' : 'people'}${found.length < cards.length ? ` · ${cards.length} in the directory` : ''}`;
    empty.hidden = found.length !== 0;
    pagination.hidden = n >= found.length;
    all.textContent = `Show all ${found.length} people`;
    involvement.disabled = selected() !== '' && selected() !== 'Lab Alumni';
    if (persist) save(clearHash);
  }
  function restore() {
    const params = new URL(location.href).searchParams;
    search.value = params.get('q') || '';
    const chosen = radios.find(r => r.value === params.get('group')) || radios[0];
    chosen.checked = true;
    involvement.value = params.get('involvement') || '';
    if (selected() && selected() !== 'Lab Alumni') involvement.value = '';
    limit = Math.max(15, Math.min(cards.length, Number(params.get('show')) || 15));
    render(false);
  }
  function revealHash(scroll = true) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    const target = document.getElementById(id);
    if (!target || !document.querySelector('#people-results').contains(target)) return;
    if (target.hidden || target.closest('[hidden]')) {
      search.value = ''; radios[0].checked = true; involvement.value = '';
      limit = cards.length; render();
    }
    if (target.matches('[data-person]')) {
      const biography = target.querySelector('details');
      if (biography) biography.open = true;
    }
    if (scroll) target.scrollIntoView({block: 'start'});
  }
  function reset() { search.value = ''; radios[0].checked = true; involvement.value = ''; limit = 15; render(true, true); search.focus(); }
  search.addEventListener('input', () => { limit = 15; render(true, true); });
  search.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); reset(); } });
  radios.forEach(r => r.addEventListener('change', () => { involvement.value = ''; limit = 15; render(true, true); }));
  involvement.addEventListener('change', () => { if (involvement.value) radios.find(r => r.value === 'Lab Alumni').checked = true; limit = 15; render(true, true); });
  document.querySelector('#people-reset').addEventListener('click', reset);
  function expand(newLimit) {
    const previouslyHidden = matches().filter(card => card.hidden);
    limit = newLimit; render();
    const first = previouslyHidden.find(card => !card.hidden);
    if (first) { first.setAttribute('tabindex', '-1'); first.focus({preventScroll: true}); }
  }
  more.addEventListener('click', () => expand(limit + 15));
  all.addEventListener('click', () => expand(cards.length));
  window.addEventListener('popstate', () => { restore(); revealHash(); });
  window.addEventListener('pageshow', () => { restore(); revealHash(false); });
  window.addEventListener('hashchange', () => revealHash());
  controls.hidden = false; restore(); revealHash();
})();
