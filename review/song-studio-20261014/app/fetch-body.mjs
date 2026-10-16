// Keep the deadline active until the response body is read, not only until headers.
// The controller/timer fallback supports browsers without AbortSignal.timeout.
export async function fetchBody(url,type,{signal,timeoutMs=45000}={}){
  const controller=new AbortController();
  let timer=null,deadline=null,abortedBy=null;
  const abort=kind=>{if(!controller.signal.aborted){abortedBy=kind;controller.abort();}};
  const cancel=()=>abort('cancel');
  const timeout=()=>abort('timeout');
  if(signal?.aborted)cancel();
  else signal?.addEventListener('abort',cancel,{once:true});
  try{
    if(!controller.signal.aborted){
      if(typeof globalThis.AbortSignal?.timeout==='function'){
        deadline=globalThis.AbortSignal.timeout(timeoutMs);
        deadline.addEventListener('abort',timeout,{once:true});
      }else timer=setTimeout(timeout,timeoutMs);
    }
    if(controller.signal.aborted)throw Error('cancelled');
    const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
    if(!response.ok)throw Error('Could not load the public Fresh Annotator example. Please try again.');
    return await response[type]();
  }catch(error){
    if(abortedBy){
      const failure=Error(abortedBy==='timeout'
        ?'Loading the Fresh Annotator example timed out. Please check your connection and try again.'
        :'Loading the Fresh Annotator example was cancelled. You can try again.');
      failure.name=abortedBy==='timeout'?'TimeoutError':'AbortError';
      throw failure;
    }
    throw error;
  }finally{
    if(timer!==null)clearTimeout(timer);
    deadline?.removeEventListener('abort',timeout);
    signal?.removeEventListener('abort',cancel);
  }
}
