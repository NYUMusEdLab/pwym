/* A public reading index: no fetching, storage or analytics. */
(() => {
  const panels = [...document.querySelectorAll('.reader-panel')];
  const links = [...document.querySelectorAll('[data-reading]')];
  const modes = [...document.querySelectorAll('button[data-mode]')];
  function show(panel, focus = false) {
    panels.forEach(item => { item.hidden = item !== panel; });
    links.forEach(link => {
      if (link.dataset.reading === panel.id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('.reader-nav-group').forEach(group => { group.hidden = group.dataset.mode !== panel.dataset.mode; });
    modes.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === panel.dataset.mode)));
    if (focus) {
      panel.focus({preventScroll: true});
      if (matchMedia('(max-width: 999px), (max-height: 649px)').matches) panel.scrollIntoView({block: 'start'});
    }
  }
  function fromHash(focus = false) {
    let hash;
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { hash = ''; }
    if (hash === 'main' && focus) return;
    const panel = panels.find(p => p.id === hash) || panels.find(p => p.dataset.group === hash) || panels[0];
    show(panel, focus);
  }
  modes.forEach(button => button.addEventListener('click', () => {
    const first = panels.find(p => p.dataset.mode === button.dataset.mode);
    if (location.hash === '#' + first.id) show(first, true);
    else location.hash = first.id;
  }));
  links.forEach(link => link.addEventListener('click', () => {
    if (location.hash === link.hash) show(document.getElementById(link.dataset.reading), true);
  }));
  document.querySelector('.reader-modes').hidden = false;
  document.body.classList.add('section-ready');
  fromHash();
  window.addEventListener('hashchange', () => fromHash(true));
})();
