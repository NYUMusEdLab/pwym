export const MAX=300;
export const QUAL={maj:[0,4,7],min:[0,3,7],dom7:[0,4,7,10],maj7:[0,4,7,11],min7:[0,3,7,10],dim:[0,3,6],sus4:[0,5,7],silent:[]};
const PITCH=['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
export const noteName=n=>PITCH[((Math.round(n)%12)+12)%12]+(Math.floor(Math.round(n)/12)-1);
export const chordName=(r,q)=>q==='silent'?'No chord':PITCH[r]+({maj:'',min:'m',dom7:'7',maj7:'maj7',min7:'m7',dim:'°',sus4:'sus4'}[q]||'');
export const chordPitches=(r,q)=>QUAL[q].map(x=>48+r+x);
export function place(xs,item){return [...xs.filter(x=>Math.abs(x.time-item.time)>.09),item].sort((a,b)=>a.time-b.time);}
export function active(xs,t){return xs.findLast(x=>x.time<=t+.001)||null;}
export function analyze(a,sr){
 const dec=Math.max(1,Math.round(sr/9000)),rate=sr/dec, out=new Float32Array(Math.floor(Math.min(a.length,sr*MAX)/dec));
 for(let i=0;i<out.length;i++){let j=i*dec,v=0;for(let k=0;k<dec;k++)v+=a[j+k];out[i]=v/dec;}
 const block=Math.round(rate*.046), move=Math.round(rate*.028), min=Math.floor(rate/1150),max=Math.ceil(rate/62);
 const peak=Math.max(.001,...Array.from({length:Math.min(1500,out.length)},(_,i)=>Math.abs(out[Math.floor(i*out.length/Math.min(1500,out.length))])));const gate=Math.min(.014,Math.max(.0026,peak*.037));
 const buf=new Float64Array(max+2), data=[], waveform=[];
 for(let base=0;base+block+max+1<out.length;base+=move){
  let eng=0;for(let i=0;i<block;i++)eng+=out[base+i]*out[base+i];
  const rms=Math.sqrt(eng/block),t=(base+block/2)/rate;waveform.push([t,rms]);
  if(rms<gate)continue;
  buf[0]=1;
  let sum=0;
  for(let lag=1;lag<=max+1;lag++){
   let d=0; for(let j=0;j<block;j++){const dx=out[base+j]-out[base+j+lag];d+=dx*dx;}
   sum+=d;buf[lag]=sum>1e-10?d*lag/sum:1;
  }
  let best=-1;
  for(let k=Math.max(2,min);k<=max;k++)if(buf[k]<.19){while(k<max&&buf[k+1]<buf[k])k++;best=k;break;}
  if(best<0)continue;
  const x=buf[best-1],y=buf[best],z=buf[best+1];const offs=(x+z-2*y)>.00001?.5*(x-z)/(x+z-2*y):0;
  const midi=69+12*Math.log2((rate/(best+Math.min(.5,Math.max(-.5,offs))))/440);
  if(midi>=35&&midi<=84)data.push([Math.round(t*1000)/1000,Math.round(midi*100)/100,Math.round((1-y)*100)/100]);
 }
 return {data,waveform,dur:out.length/rate};
}
export function phrase(notes, rate=22050){
 const secs=.52,dur=.3+notes.length*secs,out=new Float32Array(Math.round(dur*rate));
 for(let k=0;k<notes.length;k++){
  const f=440*2**((notes[k]-69)/12);
  for(let i=0;i<rate*.47;i++){const j=Math.round(rate*(.22+k*secs))+i;if(j>=out.length)break;
   const t=i/rate,amp=.22*Math.min(1,t/.045)*Math.min(1,(.47-t)/.07);
   out[j]=amp*(Math.sin(2*Math.PI*f*t)+.17*Math.sin(4*Math.PI*f*t));
  }
 }
 return out;
}
export function wav(a,sr){
 const b=new ArrayBuffer(44+a.length*2),d=new DataView(b);
 const str=(offset,s)=>{for(let i=0;i<s.length;i++)d.setUint8(offset+i,s.charCodeAt(i));};
 str(0,'RIFF');d.setUint32(4,36+a.length*2,true);str(8,'WAVE');str(12,'fmt ');
 d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,sr,true);d.setUint32(28,2*sr,true);d.setUint16(32,2,true);d.setUint16(34,16,true);
 str(36,'data');d.setUint32(40,a.length*2,true);
 for(let i=0;i<a.length;i++)d.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,a[i]))*32767),true);
 return new Blob([b],{type:'audio/wav'});
}
