/* Browser approximation, not Sony's proprietary stretch engine. */
(function(root){
'use strict';
const mod=(n,m)=>((n%m)+m)%m;
function semitones(root,key){return mod(key-mod(root,12)+6,12)-6;}
function frameCount(beats,bpm,sampleRate){if(!(beats>0&&bpm>0&&sampleRate>0))throw Error('Invalid loop timing');return Math.max(1,Math.round(beats*60/bpm*sampleRate));}
function ticket(){let generation=0;return {next:()=>++generation,valid:n=>n===generation,cancel:()=>++generation};}
async function render(channels,sampleRate,meta,bpm,key,{cancelled=()=>false,yieldTask=()=>new Promise(r=>setTimeout(r,0))}={}){
 const length=channels[0].length,target=frameCount(meta.beats,bpm,sampleRate),pitch=2**(semitones(meta.root,key)/12);
 // Resampling changes pitch first; WSOLA then restores the independently chosen duration.
 const resampledLength=Math.max(1,Math.round(length/pitch));
 const input=channels.map(data=>{const out=new Float32Array(resampledLength);for(let i=0;i<out.length;i++){const x=i*pitch,j=Math.floor(x),f=x-j;out[i]=data[j%length]*(1-f)+data[(j+1)%length]*f;}return out;});
 const output=channels.map(()=>new Float32Array(target)),weights=new Float32Array(target);
 const size=1024,hop=256,search=160,window=Float32Array.from({length:size},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(size-1)));
 let lastSource=null,grains=0;
 for(let outAt=-size;outAt<target;outAt+=hop){
  if(cancelled())throw Error('Audio preparation superseded');
  const expected=Math.round(outAt*resampledLength/target);let source=expected;
  if(lastSource!==null){
   let best=-Infinity;const prev=lastSource+hop;
   // Correlation uses both channels so stereo placement is preserved.
   const score=(candidate)=>{let cross=0,a2=1e-12,b2=1e-12;for(let c=0;c<input.length;c++){const d=input[c];for(let j=0;j<size-hop;j+=8){let a=d[mod(prev+j,resampledLength)],b=d[mod(candidate+j,resampledLength)];cross+=a*b;a2+=a*a;b2+=b*b;}}return cross/Math.sqrt(a2*b2);};
   for(let offset=-search;offset<=search;offset+=8){let candidate=expected+offset,s=score(candidate);if(s>best){best=s;source=candidate;}}
   const coarse=source;for(let offset=-7;offset<=7;offset++){const candidate=coarse+offset,s=score(candidate);if(s>best){best=s;source=candidate;}}
  }
  for(let j=0;j<size;j++){const at=outAt+j;if(at<0||at>=target)continue;const w=window[j];weights[at]+=w;for(let c=0;c<output.length;c++)output[c][at]+=input[c][mod(source+j,resampledLength)]*w;}
  lastSource=source;
  if(++grains%24===0)await yieldTask();
 }
 for(let c=0;c<output.length;c++)for(let i=0;i<target;i++)output[c][i]/=weights[i]||1;
 if(cancelled())throw Error('Audio preparation superseded');return output;
}
const api={semitones,frameCount,ticket,render};if(typeof module!=='undefined')module.exports=api;else root.XPressAudioEngine=api;
})(typeof window!=='undefined'?window:globalThis);
