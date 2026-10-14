import {uid,round} from './model.mjs';
export const MAX_BYTES=60*1024*1024;
export async function readAudio(file) {
  if(file.size>MAX_BYTES)throw Error('Choose an audio file smaller than 60 MB.');
  const bytes=await file.arrayBuffer(),ctx=new AudioContext();
  let buffer;try{buffer=await ctx.decodeAudioData(bytes.slice(0));}finally{await ctx.close();}
  if(buffer.duration>1200)throw Error('Use a song shorter than 20 minutes.');
  const mime=file.type?.startsWith('audio/')?file.type:file.type==='video/mp4'?'audio/mp4':'audio/wav';
  return {blob:new Blob([bytes],{type:mime}),buffer,
    track:{id:uid('track'),name:file.name,duration:round(buffer.duration),offset:0,volume:1,muted:false,mime}};
}
export async function decodeBlob(blob){const ctx=new AudioContext();try{return await ctx.decodeAudioData(await blob.arrayBuffer());}finally{await ctx.close();}}
export function wav(samples,sampleRate=16000){
  const bytes=new ArrayBuffer(44+samples.length*2),v=new DataView(bytes);
  function text(offset,text){for(let i=0;i<text.length;i++)v.setUint8(offset+i,text.charCodeAt(i));}
  text(0,'RIFF');v.setUint32(4,36+samples.length*2,true);text(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples.length*2,true);
  samples.forEach((x,i)=>v.setInt16(44+i*2,Math.max(-1,Math.min(1,x))*32767,true));
  return new Blob([bytes],{type:'audio/wav'});
}
export function fixtureAudio(){
  const rate=16000,samples=new Float32Array(16*rate),notes=[261.63,329.63,392,329.63,293.66,349.23,440,392];
  for(let i=0;i<samples.length;i++){
    const t=i/rate,beat=Math.floor(t*2),phase=t%.5;
    if((t>=7.3&&t<8)||(t>=14.8))continue;
    const envelope=Math.min(1,phase/.025)*Math.exp(-phase*7);
    samples[i]=.2*envelope*(Math.sin(2*Math.PI*notes[beat%8]*t)+.25*Math.sin(4*Math.PI*notes[beat%8]*t));
  }return wav(samples,rate);
}
export function envelope(buffer,step=.05){
  const bins=[],size=Math.max(1,Math.floor(buffer.sampleRate*step));
  for(let from=0;from<buffer.length;from+=size){
    let sum=0,count=0;
    for(let c=0;c<buffer.numberOfChannels;c++){const a=buffer.getChannelData(c);for(let i=from;i<Math.min(from+size,a.length);i+=4){sum+=a[i]*a[i];count++;}}
    bins.push(Math.sqrt(sum/Math.max(1,count)));
  }return {bins,step,duration:buffer.duration};
}
export function suggestSections(env){
  const peak=Math.max(...env.bins),threshold=Math.max(.003,peak*.07);if(peak<.004)return [];
  const cuts=[];let silence=null;
  env.bins.forEach((v,i)=>{
    if(v<threshold&&silence===null)silence=i;
    if((v>=threshold||i===env.bins.length-1)&&silence!==null){
      const length=(i-silence)*env.step,cut=round((i+silence)*env.step/2);
      if(length>=.45&&cut>2&&cut<env.duration-2&&cut-(cuts.at(-1)||0)>2)cuts.push(cut);
      silence=null;
    }
  });
  return cuts;
}
export function estimateWords(words,start,end,env){
  if(!words.length||end-start<words.length*.002)throw Error('Give these words more room.');
  const threshold=Math.max(.003,Math.max(...env.bins)*.07);
  let slots=env.bins.map((v,i)=>({v,t:i*env.step})).filter(b=>b.t>=start&&b.t<end&&b.v>threshold).map(b=>b.t);
  // Acoustic energy is not a vocal/phoneme detector. This only supplies editable placeholders.
  if(slots.length<words.length)slots=Array.from({length:words.length*4},(_,i)=>start+(end-start)*i/(words.length*4));
  const starts=words.map((_,i)=>round(slots[Math.floor(i*slots.length/words.length)]));
  words.forEach((w,i)=>{w.start=starts[i];w.end=round(i<words.length-1?starts[i+1]:end);w.reviewed=false;w.timingSource='energy-spacing estimate (not alignment)';});
}
export async function dataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
export function blobFromDataURL(url){
  const [header,encoded]=url.split(','),raw=atob(encoded),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return new Blob([bytes],{type:header.slice(5,-7)});
}
export async function mixdown(project,blobs){
  const rate=22050,ctx=new OfflineAudioContext(1,Math.ceil(project.duration*rate),rate);
  for(const track of project.tracks){
    const blob=blobs.get(track.id);if(!blob)throw Error(`Audio missing: ${track.name}. Reopen the original file.`);
    if(track.muted)continue;
    const buffer=await ctx.decodeAudioData(await blob.arrayBuffer()),source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=buffer;gain.gain.value=track.volume;source.connect(gain).connect(ctx.destination);
    if(track.offset<0){if(-track.offset<buffer.duration)source.start(0,-track.offset);}else if(track.offset<project.duration)source.start(track.offset);
  }
  const rendered=await ctx.startRendering(),samples=rendered.getChannelData(0);let peak=1;
  for(const s of samples)peak=Math.max(peak,Math.abs(s));if(peak>1)for(let i=0;i<samples.length;i++)samples[i]/=peak;
  return wav(samples,rate);
}
