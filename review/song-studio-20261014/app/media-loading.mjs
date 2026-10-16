// Indeterminate readiness follows real work. There is no estimated percentage.
export function createMediaLoading(root,{controls=[]}={}){
  const message=root.querySelector('[data-loading-message]'),bar=root.querySelector('progress');
  const cancel=root.querySelector('[data-loading-cancel]'),retry=root.querySelector('[data-loading-retry]'),close=root.querySelector('[data-loading-close]');
  let active=null,retryAction=null;
  // Let these buttons use native keyboard activation without the global Play shortcut.
  root.addEventListener('keydown',event=>{if(event.code==='Space'||event.key==='Enter')event.stopPropagation();});
  const show=(text,state)=>{
    root.hidden=false;root.dataset.state=state;root.setAttribute('aria-busy',String(state==='loading'));
    message.textContent=text;bar.hidden=state!=='loading';
    cancel.hidden=state!=='loading';retry.hidden=state!=='error';close.hidden=state==='loading';
  };
  cancel.addEventListener('click',()=>{
    if(!active||active.locked)return;
    active.controller.abort();cancel.disabled=true;message.textContent='Cancelling audio preparation…';
  });
  close.addEventListener('click',()=>{if(!active){root.hidden=true;retryAction=null;}});
  retry.addEventListener('click',()=>retryAction?.());
  async function run(label,work){
    if(active)return;
    const op={controller:new AbortController(),locked:false};active=op;retryAction=null;
    const locked=controls.flatMap(selector=>[...document.querySelectorAll(selector)]).map(el=>[el,el.disabled]);
    locked.forEach(([el])=>el.disabled=true);cancel.disabled=false;show(label,'loading');
    const check=()=>{if(op.controller.signal.aborted){const error=Error('Loading cancelled. Your current song is unchanged.');error.name='AbortError';throw error;}};
    const task={signal:op.controller.signal,check,
      stage(text){if(!op.controller.signal.aborted)message.textContent=text;},
      commit(){check();op.locked=true;cancel.hidden=true;message.textContent='Opening the prepared song…';}
    };
    try{const result=await work(task);root.hidden=true;return result;}
    catch(error){
      if(op.controller.signal.aborted)show('Loading cancelled. Your current song is unchanged.','cancelled');
      else{retryAction=()=>run(label,work);show(['EncodingError','NotSupportedError'].includes(error.name)
        ?'This audio could not be decoded. Choose another audio file or try again.'
        :error.message||'Could not prepare this audio. Please try again.','error');}
    }finally{
      active=null;root.setAttribute('aria-busy','false');bar.hidden=true;
      locked.forEach(([el,disabled])=>el.disabled=disabled);
    }
  }
  return {run};
}
