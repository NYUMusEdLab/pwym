/* Section navigation only. The existing search and consent scripts are unchanged. */
(() => {
  const map = document.getElementById('section-map');
  const tabs = [...map.querySelectorAll('[role="tab"]')];
  const panels = [...map.querySelectorAll('.section-panel')];
  const browser = document.getElementById('archive-browser');
  function select(index) {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
  }
  tabs.forEach((tab, index) => {
    panels[index].setAttribute('role', 'tabpanel');
    panels[index].setAttribute('aria-labelledby', tab.id);
    panels[index].tabIndex = 0;
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      const keys = {ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1};
      if (!(event.key in keys)) return;
      event.preventDefault();
      const next = keys[event.key];
      select(next);
      tabs[next].focus();
    });
  });
  select(0);
  map.querySelector('[role="tablist"]').hidden = false;
  map.classList.add('landing-ready');

  function followFragment() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!id || id === 'section-map') {
      browser.open = false;
      if (id) {
        tabs.find(tab => tab.getAttribute('aria-selected') === 'true').focus({preventScroll: true});
        map.scrollIntoView({block: 'start'});
      }
      return;
    }
    const target = document.getElementById(id);
    if (!target || !browser.contains(target)) return;
    browser.open = true;
    // A preserved category link must remain visible after a previous search.
    const search = document.getElementById('search');
    const filter = document.getElementById('filter');
    if (search.value || filter.value) {
      search.value = '';
      filter.value = '';
      search.dispatchEvent(new Event('input', {bubbles: true}));
    }
    requestAnimationFrame(() => {
      target.tabIndex = -1;
      target.focus({preventScroll: true});
      target.scrollIntoView({block: 'start'});
    });
  }
  window.addEventListener('hashchange', followFragment);
  // Also handle a repeated click on the same hash after closing the browser.
  document.querySelectorAll('a[href^="#category-"], a[href="#section-map"]').forEach(link => {
    link.addEventListener('click', () => {
      if (link.hash === location.hash) followFragment();
    });
  });
  followFragment();
})();
