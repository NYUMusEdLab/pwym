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
