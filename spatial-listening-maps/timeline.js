import {clamp, formatTime} from './model.js?v=0.2.0';

// A view over section times; it never owns audio or changes the project schema.
export class SectionTimeline {
  constructor({getProject, select, boundary, seek, split, edit, announce}) {
    Object.assign(this,{getProject,select,boundary,seek,split,edit,announce});
    this.el=document.getElementById('section-timeline');
    this.rows=document.getElementById('timeline-rows');
    this.ruler=document.getElementById('timeline-ruler');
    this.drag=null;this.view=null;this.ready=false;
    for(const key of ['start','end']) {
      document.getElementById('timeline-'+key).onchange=e=>boundary(key,Number(e.target.value));
    }
    document.getElementById('timeline-focus').onclick=()=>{this.view=this.focusRange();this.render();};
    document.getElementById('timeline-all').onclick=()=>{this.view=null;this.render();};
    document.getElementById('timeline-edit').onclick=edit;
    document.getElementById('timeline-split').onclick=split;
    this.rows.addEventListener('click',e=>{
      if(e.target.closest('[data-edge]'))return;
      const b=e.target.closest('[data-section]');if(b)select(b.dataset.section);
    });
    this.ruler.onclick=e=>{if(this.ready)this.seek(this.timeAt(e.clientX));};
    this.rows.addEventListener('pointerdown',e=>this.begin(e));
    this.rows.addEventListener('pointermove',e=>this.move(e));
    this.rows.addEventListener('pointerup',e=>this.finish(e));
    this.rows.addEventListener('pointercancel',()=>this.cancel());
    this.rows.addEventListener('lostpointercapture',()=>this.cancel());
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.drag){e.preventDefault();e.stopPropagation();this.cancel();}},true);
    this.rows.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&this.drag){e.preventDefault();this.cancel();return;}
      const handle=e.target.closest('[data-edge]');
      if(!handle||e.altKey||e.ctrlKey||e.metaKey)return;
      const key=handle.dataset.edge, s=this.selected();
      let value=s[key];
      if(['ArrowLeft','ArrowDown'].includes(e.key))value-=e.shiftKey?1:.1;
      else if(['ArrowRight','ArrowUp'].includes(e.key))value+=e.shiftKey?1:.1;
      else if(e.key==='Home')value=key==='start'?0:s.start+.1;
      else if(e.key==='End')value=key==='start'?s.end-.1:this.duration();
      else return;
      e.preventDefault();this.boundary(key,this.limit(key,value));
      this.announce(`${key==='start'?'Start':'End'} ${formatTime(this.selected()[key],true)}`);
    });
    this.observer=new ResizeObserver(()=>{if(!this.drag)this.paint();});this.observer.observe(this.rows);
  }
  selected(){const p=this.getProject();return p.sections.find(s=>s.id===p.activeSectionId);}
  duration(){const p=this.getProject();return p.audio?.duration||Math.max(30,...p.sections.map(s=>s.end));}
  range(){return this.view||{start:0,end:this.duration()};}
  focusRange(){const s=this.selected(),d=this.duration(),pad=Math.max(.2,(s.end-s.start)*.15);return {start:Math.max(0,s.start-pad),end:Math.min(d,s.end+pad)};}
  limit(key,value){const s=this.selected();return clamp(Math.round(value*1000)/1000,key==='start'?0:s.start+.1,key==='start'?s.end-.1:this.duration());}
  timeAt(x){const r=this.rows.getBoundingClientRect(),v=this.range();return clamp(v.start+(x-r.left)/r.width*(v.end-v.start),v.start,v.end);}
  begin(e){
    const handle=e.target.closest('[data-edge]');if(!handle||!e.isPrimary||e.button!==0||this.drag)return;
    e.preventDefault();handle.focus({preventScroll:true});
    const key=handle.dataset.edge;
    this.drag={key,original:this.selected()[key],value:this.selected()[key],x:e.clientX,pointerId:e.pointerId,range:{...this.range()},width:this.rows.getBoundingClientRect().width};
    this.rows.setPointerCapture(e.pointerId);
  }
  move(e){
    const d=this.drag;if(!d||e.pointerId!==d.pointerId)return;
    d.value=this.limit(d.key,d.original+(e.clientX-d.x)/d.width*(d.range.end-d.range.start));
    this.paint();document.getElementById('timeline-'+d.key).value=d.value;
  }
  finish(e){
    const d=this.drag;if(!d||e.pointerId!==d.pointerId)return;
    this.drag=null;if(this.rows.hasPointerCapture(e.pointerId))this.rows.releasePointerCapture(e.pointerId);
    Promise.resolve(this.boundary(d.key,d.value)).then(()=>this.rows.querySelector(`[data-edge="${d.key}"]`)?.focus({preventScroll:true}));this.announce(`${d.key==='start'?'Start':'End'} set to ${formatTime(d.value,true)}`);
  }
  cancel(){if(!this.drag)return;this.drag=null;this.render();this.announce('Boundary adjustment cancelled.');}
  render(){
    const p=this.getProject(),s=this.selected();
    if(this.projectId!==p.id){this.projectId=p.id;this.view=null;}
    if(this.view&&(s.end<this.view.start||s.start>this.view.end))this.view=this.focusRange();
    for(const key of ['start','end']) {
      const input=document.getElementById('timeline-'+key);input.value=s[key];input.min=key==='start'?0:s.start+.1;input.max=key==='start'?s.end-.1:this.duration();
    }
    document.getElementById('timeline-edit').title=`Rename or edit ${s.name}`;
    this.paint();
  }
  paint(){
    const p=this.getProject(),v=this.range(),span=v.end-v.start;
    const focus=document.activeElement?.dataset.edge, focusedSection=document.activeElement?.dataset.section;
    const oldScroll=this.el.scrollTop;
    const ends=[],items=[];
    for(const original of [...p.sections].sort((a,b)=>a.start-b.start||a.end-b.end)) {
      const s={...original};if(this.drag&&s.id===p.activeSectionId)s[this.drag.key]=this.drag.value;
      if(s.end<v.start||s.start>v.end)continue;
      let lane=ends.findIndex(end=>end<=s.start+.00001);if(lane<0)lane=ends.length;ends[lane]=s.end;
      items.push({s,lane});
    }
    document.getElementById('timeline-hint').textContent='Select a section. Drag its edges, or use arrow keys (Shift = 1 second).'+(ends.length>1?' Overlapping sections: scroll the rows.':' Times are in seconds.');
    this.rows.style.height=`${Math.max(1,ends.length)*46}px`;
    this.rows.replaceChildren();
    for(const {s,lane} of items) {
      const left=clamp((s.start-v.start)/span*100,0,100),right=clamp((s.end-v.start)/span*100,0,100);
      const block=document.createElement('button');block.className='timeline-section';block.dataset.section=s.id;
      block.style.left=left+'%';block.style.width=Math.max(.15,right-left)+'%';block.style.top=lane*46+'px';
      if((right-left)/100*this.rows.clientWidth<88)block.style.padding='0';
      block.textContent=s.name||'Unnamed section';block.setAttribute('aria-pressed',String(s.id===p.activeSectionId));
      block.setAttribute('aria-label',`${s.name||'Unnamed section'}, ${formatTime(s.start,true)} to ${formatTime(s.end,true)}. Select section.`);
      block.title=`${s.name} · ${formatTime(s.start,true)}–${formatTime(s.end,true)}`;this.rows.append(block);
      if(s.id!==p.activeSectionId)continue;
      for(const key of ['start','end']) {
        const x=(s[key]-v.start)/span*100;if(x<0||x>100)continue;
        const handle=document.createElement('span');handle.className='timeline-handle';handle.dataset.edge=key;handle.tabIndex=0;
        handle.setAttribute('role','slider');handle.setAttribute('aria-label',`Section ${key}`);handle.setAttribute('aria-orientation','horizontal');
        handle.setAttribute('aria-valuemin',key==='start'?0:s.start+.1);handle.setAttribute('aria-valuemax',key==='start'?s.end-.1:this.duration());handle.setAttribute('aria-valuenow',s[key]);handle.setAttribute('aria-valuetext',formatTime(s[key],true));
        handle.setAttribute('aria-describedby','timeline-hint');handle.style.left=x+'%';handle.style.top=lane*46+'px';handle.textContent=key==='start'?'[':']';
        // Tiny intervals remain selectable; precise times and Focus section expose their edges.
        handle.hidden=(right-left)/100*this.rows.clientWidth<88;
        this.rows.append(handle);
      }
    }
    const playhead=document.createElement('span');playhead.id='timeline-playhead';playhead.setAttribute('aria-hidden','true');this.rows.append(playhead);
    this.ruler.replaceChildren();
    for(let i=0;i<=4;i++){const tick=document.createElement('span');tick.textContent=formatTime(v.start+span*i/4,span<10);tick.style.left=i*25+'%';this.ruler.append(tick);}
    this.el.scrollTop=oldScroll;
    if(focus&&!this.drag)this.rows.querySelector(`[data-edge="${focus}"]`)?.focus({preventScroll:true});
    else if(focusedSection)[...this.rows.querySelectorAll("[data-section]")].find(el=>el.dataset.section===focusedSection)?.focus({preventScroll:true});
    if(this.lastSelected!==p.activeSectionId){const active=this.rows.querySelector('[aria-pressed="true"]');if(active){const y=parseFloat(active.style.top);if(y<this.el.scrollTop)this.el.scrollTop=y;else if(y+44>this.el.scrollTop+this.el.clientHeight)this.el.scrollTop=y+44-this.el.clientHeight;}this.lastSelected=p.activeSectionId;}
    this.tick(this.time||0,this.ready);
  }
  tick(time,ready){
    this.time=time;this.ready=ready;
    const v=this.range(),head=document.getElementById('timeline-playhead');
    if(head){head.hidden=!ready||time<v.start||time>v.end;head.style.left=(time-v.start)/(v.end-v.start)*100+'%';}
    const s=this.selected();document.getElementById('timeline-split').disabled=!ready||time<s.start+.1||time>s.end-.1||this.getProject().sections.length>=100;
  }
}
