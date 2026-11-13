/* Local inference only. Model/runtime sources and licenses: provenance.json. */
importScripts('vendor/tf.min.js','vendor/music_rnn.js');
let model, queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
 try{
  if(!model){await tf.setBackend('cpu');await tf.ready();model=new music_rnn.MusicRNN(new URL('model/',self.location).href);await model.initialize();}
  if(data.type==='init'){postMessage({id:data.id,ready:true});return;}
  // A stochastic sample may contain only rest tokens; retry before returning it.
  let sequence,attempts=0;
  do{attempts++;sequence=await model.continueSequence(data.sequence,attempts===1?data.steps:Math.max(48,data.steps),attempts===1?data.temperature:1.0);}
  while(attempts<3&&!(sequence.notes||[]).some(n=>Number.isFinite(n.pitch)));
  postMessage({id:data.id,sequence,attempts});
 }catch(e){postMessage({id:data.id,error:e.message||'The melody model could not run.'});}
});};
