'use strict';

// Keep existing archive bookmarks useful when records are collapsed.
const openArchiveRecord = () => {
  let id;
  try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  const record = target?.closest('.directory-record');
  if (!record) return;
  const search = document.querySelector('#archive-search');
  if (search?.value) {
    search.value = '';
    search.dispatchEvent(new Event('input'));
  }
  record.hidden = false;
  record.open = true;
  requestAnimationFrame(() => record.scrollIntoView({ block: 'start' }));
};
window.addEventListener('hashchange', openArchiveRecord);
openArchiveRecord();

// Measure the content rather than clipping long names or assuming an image size.
// Open records retain their full-width reading layout.
const archiveGrid = document.querySelector('.archive-directory .directory-grid');
if (archiveGrid) {
  let frame;
  const sizeArchiveCards = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      archiveGrid.style.removeProperty('--archive-card-height');
      const summaries = [...archiveGrid.querySelectorAll('.directory-record:not([open]):not([hidden]) > summary')];
      const height = Math.ceil(Math.max(0, ...summaries.map(summary => summary.getBoundingClientRect().height)));
      if (height) archiveGrid.style.setProperty('--archive-card-height', `${height}px`);
    });
  };
  let width;
  new ResizeObserver(entries => {
    const nextWidth = entries[0].contentRect.width;
    if (nextWidth !== width) {
      width = nextWidth;
      sizeArchiveCards();
    }
  }).observe(archiveGrid);
  new MutationObserver(sizeArchiveCards).observe(archiveGrid, { childList: true, characterData: true, subtree: true });
  archiveGrid.addEventListener('toggle', sizeArchiveCards, true);
  document.querySelector('#archive-search')?.addEventListener('input', sizeArchiveCards);
  document.fonts.ready.then(sizeArchiveCards);
  sizeArchiveCards();
}
