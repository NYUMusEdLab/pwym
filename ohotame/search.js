
const search=document.getElementById('search'), filter=document.getElementById('filter');
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function update(){const terms=norm(search.value.trim()).split(/\s+/).filter(Boolean);let shown=0;document.querySelectorAll('[data-search]').forEach(e=>{e.hidden=!(terms.every(t=>norm(e.dataset.search).includes(t))&&(!filter.value||e.dataset.group===filter.value));if(!e.hidden)shown++});document.querySelectorAll('.category,.subcat').forEach(e=>{e.hidden=![...e.querySelectorAll('[data-search]')].some(c=>!c.hidden)});document.getElementById('count').textContent=shown+' results';document.getElementById('empty').hidden=shown>0}
search.addEventListener('input',update);filter.addEventListener('change',update);update();

