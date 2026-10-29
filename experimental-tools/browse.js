/* Progressive enhancement: the original directory remains usable without JavaScript. */
(() => {
  'use strict';
  const main = document.querySelector('main');
  const hero = document.querySelector('.collection-hero');
  const sections = [...document.querySelectorAll('.experiment-section')];
  if (!main || !hero || !sections.length || typeof HTMLDialogElement === 'undefined') return;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const allTools = sections.flatMap(section => [...section.querySelectorAll('.experiment')]);
  const about = make('dialog', 'browse-about');
  about.id = 'collection-about';
  about.setAttribute('aria-labelledby', 'collection-about-title');
  const aboutBar = make('div', 'about-bar');
  const aboutTitle = make('h2', '', 'About these experiments');
  aboutTitle.id = 'collection-about-title';
  const close = make('button', 'browse-control', 'Close');
  close.type = 'button';
  close.addEventListener('click', () => about.close());
  aboutBar.append(aboutTitle, close);
  about.append(aboutBar);
  const dek = hero.querySelector('.collection-dek');
  const aside = hero.querySelector('.hero-aside');
  if (dek) about.append(dek);
  if (aside) about.append(aside);
  for (const node of [...main.querySelectorAll('.practice-context, .collection-notes')]) about.append(node);
  document.body.append(about);

  const intro = make('p', 'browse-intro', 'Choose a tool. Explore the idea. Open it when you’re ready.');
  hero.firstElementChild.append(intro);
  const actions = make('div', 'browse-actions');
  actions.append(make('span', 'browse-count', `${allTools.length} tools · ${sections.length} practices`));
  const aboutButton = make('button', 'browse-control', 'About & before you begin');
  aboutButton.type = 'button';
  aboutButton.setAttribute('aria-haspopup', 'dialog');
  aboutButton.setAttribute('aria-controls', about.id);
  aboutButton.addEventListener('click', () => { aboutButton.focus({preventScroll: true}); about.showModal(); });
  actions.append(aboutButton);
  hero.append(actions);

  const browser = make('div', 'tool-browser');
  const chooser = make('section', 'tool-chooser');
  chooser.setAttribute('aria-labelledby', 'tool-chooser-title');
  const chooserTitle = make('h2', 'browse-visually-hidden', 'Choose a tool');
  chooserTitle.id = 'tool-chooser-title';
  chooser.append(chooserTitle);
  const reader = make('section', 'tool-reader');
  reader.id = 'tool-reader';
  reader.tabIndex = 0;
  const readerTop = make('div', 'reader-top');
  readerTop.append(make('span', 'eyebrow', 'Explore this tool'));
  const back = make('button', 'browse-control reader-back', 'Back to tools ↑');
  back.type = 'button';
  readerTop.append(back);
  reader.append(readerTop);
  browser.append(chooser, reader);
  const collectionNav = main.querySelector('.collection-nav');
  collectionNav.insertAdjacentElement('afterend', browser);
  const choices = new Map();
  let activeId;

  for (const [index, section] of sections.entries()) {
    const group = make('div', 'tool-group');
    const groupTitle = make('h3', 'tool-group-title', section.querySelector('h2').textContent);
    groupTitle.id = `${section.id}-choices`;
    const ordinal = make('span', 'group-number', String(index + 1).padStart(2, '0'));
    const groupHeader = make('div', 'tool-group-header');
    groupHeader.append(ordinal, groupTitle);
    group.append(groupHeader);
    const list = make('div', 'tool-choice-list');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-labelledby', groupTitle.id);
    for (const article of [...section.querySelectorAll('.experiment')]) {
      const title = article.querySelector('h3');
      if (!title.id) title.id = `${article.id}-title`;
      const choice = make('button', 'tool-choice');
      choice.type = 'button';
      choice.id = `${article.id}-choice`;
      choice.setAttribute('aria-controls', 'tool-reader');
      choice.setAttribute('aria-pressed', 'false');
      choice.append(make('span', 'choice-name', title.textContent));
      choice.append(make('span', 'choice-status', article.querySelector('.availability')?.textContent || 'Preview'));
      choice.addEventListener('click', () => {
        choice.focus({preventScroll: true});
        history.pushState(null, '', `#${article.id}`);
        select(article.id, true);
      });
      list.append(choice);
      choices.set(article.id, {article, section, choice, title});
    }
    group.append(list);
    chooser.append(group);
    reader.append(section);
  }
  const selectedStatus = make('p', 'browse-visually-hidden');
  selectedStatus.setAttribute('role', 'status');
  selectedStatus.setAttribute('aria-live', 'polite');
  browser.append(selectedStatus);
  back.addEventListener('click', () => choices.get(activeId)?.choice.focus());

  function select(id, userInitiated = false) {
    const selected = choices.get(id);
    if (!selected) return false;
    activeId = id;
    for (const [key, item] of choices) {
      item.article.hidden = key !== id;
      item.choice.setAttribute('aria-pressed', String(key === id));
    }
    for (const section of sections) section.hidden = section !== selected.section;
    reader.setAttribute('aria-labelledby', selected.title.id);
    selectedStatus.textContent = `${selected.title.textContent} selected. Details and launch link are available.`;
    reader.scrollTop = 0;
    if (userInitiated && matchMedia('(max-width: 1099px)').matches) reader.focus();
    if (matchMedia('(min-width: 1100px) and (min-height: 600px)').matches) window.scrollTo(0, 0);
    return true;
  }

  function navigateHash(userInitiated = false) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!id || choices.has(id) || sections.some(item => item.id === id)) {
      if (about.open) about.close();
    }
    if (!id) { select(allTools[0].id); return; }
    if (select(id, userInitiated)) return;
    const section = sections.find(item => item.id === id);
    if (section) {
      select(section.querySelector('.experiment').id, userInitiated);
      return;
    }
    const target = id && document.getElementById(id);
    if (target && about.contains(target)) {
      if (!about.open) about.showModal();
      target.scrollIntoView({block: 'start'});
    }
  }
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;
    let url;
    let targetId;
    try {
      url = new URL(anchor.href, location.href);
      targetId = decodeURIComponent(url.hash.slice(1));
    } catch { return; }
    if (url.origin !== location.origin || url.pathname !== location.pathname || !targetId) return;
    const hash = url.hash;
    const target = document.getElementById(targetId);
    if (!target || !(reader.contains(target) || about.contains(target))) return;
    event.preventDefault();
    if (about.open && reader.contains(target)) about.close();
    history.pushState(null, '', hash);
    navigateHash(true);
  });
  window.addEventListener('hashchange', () => navigateHash());
  window.addEventListener('popstate', () => navigateHash());
  const privacyButton = document.getElementById('privacy-preferences');
  const footer = document.querySelector('.container > footer');
  if (privacyButton && footer) footer.append(privacyButton);
  document.body.classList.add('browse-ready');
  select(allTools[0].id);
  navigateHash();
  window.addEventListener('load', () => {
    if (matchMedia('(min-width: 1100px) and (min-height: 600px)').matches) window.scrollTo(0, 0);
  });
})();
