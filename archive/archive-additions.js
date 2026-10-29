'use strict';
// Local filtering only. No network requests, storage, tracking or submission.
const form=document.querySelector('[data-program-search]');
const events=[...document.querySelectorAll('[data-event]')];
if(form){
  const count=document.querySelector('[data-program-count]');
  const empty=document.querySelector('[data-program-empty]');
  form.querySelectorAll('input,select,button').forEach(el=>el.disabled=false);
  const update=()=>{
    const query=form.elements.q.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible=0;
    for(const event of events){
      const text=event.dataset.search.toLocaleLowerCase();
      const matches=query.every(q=>text.includes(q))&&(!form.elements.day.value||event.dataset.day===form.elements.day.value)&&(!form.elements.kind.value||event.dataset.kind===form.elements.kind.value);
      event.hidden=!matches;if(matches)visible++;
    }
    count.textContent=`${visible} of ${events.length} program entries`;empty.hidden=visible>0;
  };
  form.addEventListener('submit',e=>e.preventDefault());
  form.addEventListener('input',update);form.addEventListener('change',update);
  // Wait for the browser to restore form defaults before reading filter values.
  form.addEventListener('reset',()=>setTimeout(update,0));update();
}
function revealSession(){
  let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
  const target=document.getElementById(id);
  if(!target?.matches('[data-event]'))return;
  if(form){form.reset();}target.hidden=false;target.open=true;
  requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
}
window.addEventListener('hashchange',revealSession);revealSession();
const search=document.querySelector('[data-presenter-search]');
if(search){search.addEventListener('input',()=>{let visible=0;for(const person of document.querySelectorAll('[data-presenter]')){person.hidden=!person.dataset.presenter.includes(search.value.trim().toLocaleLowerCase());if(!person.hidden)visible++;}document.querySelector('[data-presenter-empty]').hidden=visible>0;});}
let beforePrint;
window.addEventListener('beforeprint',()=>{beforePrint=events.map(e=>e.open);events.forEach(e=>e.open=true);});
window.addEventListener('afterprint',()=>{if(beforePrint)events.forEach((e,i)=>e.open=beforePrint[i]);});
