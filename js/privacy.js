/* Local, optional analytics preferences. No third-party code runs before opt-in. */
'use strict';
(() => {
  const key = 'musedlab.privacy.v1';
  const tag = document.querySelector('meta[name="musedlab-analytics"]');
  const id = tag && tag.content;
  const panel = document.querySelector('#privacy-panel');
  const open = document.querySelector('#privacy-preferences');
  if (!panel || !open) return;
  let choice = null, loaded = false, previousFocus = null;
  try { const stored = localStorage.getItem(key); if (stored === 'accepted' || stored === 'rejected' || stored === 'dismissed') choice = stored; } catch (_) {}
  const status = panel.querySelector('[data-privacy-status]');
  function describe(extra = '') {
    panel.querySelector('[data-privacy-reject]').textContent = choice === 'accepted' ? 'Withdraw analytics' : 'Reject analytics';
    status.textContent = (choice === 'accepted' ? 'Optional analytics are accepted.' : 'Optional analytics are off.') + extra;
  }
  function analytics() {
    if (!id || choice !== 'accepted') return;
    window['ga-disable-' + id] = false;
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
    window.gtag('js', new Date());
    window.gtag('config', id, {allow_google_signals: false, allow_ad_personalization_signals: false});
    const script = document.createElement('script');
    script.id = 'optional-analytics'; script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(script);
  }
  function clearAnalyticsCookies() {
    const parts = location.hostname.split('.');
    const domains = [''];
    for (let i = 0; i < parts.length - 1; i++) domains.push(parts.slice(i).join('.'), '.' + parts.slice(i).join('.'));
    const paths = ['/'];
    const segments = location.pathname.split('/');
    for (let i = 1; i < segments.length; i++) paths.push(segments.slice(0, i).join('/') || '/');
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      if (!/^(_ga($|_)|_gid$|_gat)/.test(name)) return;
      domains.forEach(domain => paths.forEach(path => { document.cookie = name + '=; Max-Age=0; path=' + path + (domain ? '; domain=' + domain : '') + '; SameSite=Lax'; }));
    });
  }
  function resetEmbeds() {
    document.querySelectorAll('[data-embed]').forEach(box => {
      const iframe = box.querySelector('iframe'); if (iframe) iframe.remove();
      box.querySelector('[data-load-embed]').hidden = false;
    });
  }
  function setChoice(next) {
    const wasLoaded = loaded;
    choice = next;
    let persisted = true;
    try { localStorage.setItem(key, next); } catch (_) { persisted = false; }
    if (next === 'accepted') analytics();
    else {
      if (id) window['ga-disable-' + id] = true;
      clearAnalyticsCookies(); resetEmbeds();
      const script = document.querySelector('#optional-analytics'); if (script) script.remove();
      // Reload only after a persisted withdrawal to unload any analytics runtime.
      if (wasLoaded && persisted) { location.reload(); return; }
    }
    describe(persisted ? '' : ' Your browser could not save this preference; it applies to this visit only.');
    if (persisted) { panel.hidden = true; open.setAttribute('aria-expanded', 'false'); if (previousFocus) previousFocus.focus(); }
  }
  const footer = document.createElement('div'); footer.className = 'privacy-footer';
  document.body.appendChild(footer); footer.appendChild(open);
  open.hidden = false;
  open.addEventListener('click', () => {
    previousFocus = open; panel.hidden = !panel.hidden;
    open.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) { describe(); panel.querySelector('button').focus(); }
  });
  panel.querySelector('[data-privacy-accept]').addEventListener('click', () => setChoice('accepted'));
  panel.querySelector('[data-privacy-reject]').addEventListener('click', () => setChoice('rejected'));
  function dismiss() {
    if (choice === null) { choice = 'dismissed'; try { localStorage.setItem(key, choice); } catch (_) {} }
    panel.hidden = true; open.setAttribute('aria-expanded', 'false');
    if (previousFocus) open.focus();
  }
  panel.querySelector('[data-privacy-close]').addEventListener('click', dismiss);
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') dismiss(); });
  document.querySelectorAll('[data-embed]').forEach(box => {
    const button = box.querySelector('[data-load-embed]'); button.hidden = false;
    button.addEventListener('click', () => {
      if (box.querySelector('iframe')) return;
      const iframe = document.createElement('iframe');
      iframe.title = box.dataset.title || 'Embedded content'; iframe.src = box.dataset.embed;
      iframe.allowFullscreen = true; iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.allow = 'fullscreen; picture-in-picture';
      box.insertBefore(iframe, box.firstChild); button.hidden = true;
      iframe.focus();
    });
  });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    choice = event.newValue === 'accepted' ? 'accepted' : 'rejected';
    if (choice === 'accepted') analytics();
    else { if (id) window['ga-disable-' + id] = true; clearAnalyticsCookies(); resetEmbeds(); if (loaded) location.reload(); }
    describe();
  });
  describe(); panel.hidden = choice !== null || !id;
  open.setAttribute('aria-expanded', String(!panel.hidden));
  if (choice === 'accepted') analytics(); else { if (id) window['ga-disable-' + id] = true; clearAnalyticsCookies(); }
})();
