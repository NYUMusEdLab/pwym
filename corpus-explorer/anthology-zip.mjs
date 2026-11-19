// Browser-local reader for the official Anthology province score archives.
// No network, persistence, or uploads. Supports classic ZIP store/deflate only.
const MiB=1024*1024;
const decoder=new TextDecoder('utf-8',{fatal:true});
const sourceUrl='https://github.com/m-july/Anthology-of-Chinese-Folk-Songs';
const provinceNames={shanghai:'Shanghai',shaanxi:'Shaanxi'};
const normalizePath=p=>p.replace(/^\.\//,'');
async function bytes(blob,start,length){
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(length)||start<0||length<0||start+length>blob.size)throw Error('Invalid ZIP bounds');
  return new Uint8Array(await blob.slice(start,start+length).arrayBuffer());
}
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
async function directory(blob){
  if(blob.size<22||blob.size>180*MiB)throw Error('Choose a province ZIP under 180 MiB');
  const tailStart=Math.max(0,blob.size-65557), tail=view(await bytes(blob,tailStart,blob.size-tailStart));
  let end=tail.byteLength-22;
  for(;end>=0;end--)if(tail.getUint32(end,true)===0x06054b50&&end+22+tail.getUint16(end+20,true)===tail.byteLength)break;
  if(end<0)throw Error('Invalid ZIP archive');
  const count=tail.getUint16(end+10,true), size=tail.getUint32(end+12,true), start=tail.getUint32(end+16,true);
  if(tail.getUint16(end+4,true)||tail.getUint16(end+6,true)||tail.getUint16(end+8,true)!==count||count>25000||size>20*MiB||start+size>tailStart+end)throw Error('Unsupported ZIP directory');
  const raw=await bytes(blob,start,size), cd=view(raw), entries=new Map;
  let p=0;
  for(let i=0;i<count;i++){
    if(p+46>size||cd.getUint32(p,true)!==0x02014b50)throw Error('Invalid ZIP entry');
    const n=cd.getUint16(p+28,true), extra=cd.getUint16(p+30,true), comment=cd.getUint16(p+32,true), next=p+46+n+extra+comment;
    if(next>size||cd.getUint16(p+34,true))throw Error('Invalid ZIP entry bounds');
    const name=normalizePath(decoder.decode(raw.subarray(p+46,p+46+n)));
    if(entries.has(name))throw Error('Duplicate ZIP entry: '+name);
    entries.set(name,{name,flags:cd.getUint16(p+8,true),method:cd.getUint16(p+10,true),packed:cd.getUint32(p+20,true),unpacked:cd.getUint32(p+24,true),offset:cd.getUint32(p+42,true),limit:start});
    p=next;
  }
  return entries;
}
async function readXml(blob,item){
  if(!item)throw Error('Score not found in this ZIP');
  const {offset,packed,unpacked,method,flags,limit,name}=item;
  if(unpacked>2*MiB||packed>2*MiB||(flags&1)||![0,8].includes(method)||offset+30>limit)throw Error('Unsupported or oversized score entry');
  const h=view(await bytes(blob,offset,30));
  if(h.getUint32(0,true)!==0x04034b50||h.getUint16(8,true)!==method||h.getUint16(6,true)!==flags)throw Error('Invalid ZIP score header');
  const n=h.getUint16(26,true), start=offset+30+n+h.getUint16(28,true);
  if(start+packed>limit||normalizePath(decoder.decode(await bytes(blob,offset+30,n)))!==name)throw Error('Invalid ZIP score bounds');
  if(method===0){
    if(packed!==unpacked)throw Error('Invalid ZIP score length');
    return decoder.decode(await bytes(blob,start,packed));
  }
  let inflater;
  try{inflater=new DecompressionStream('deflate-raw');}
  catch{throw Error('This browser cannot decompress this ZIP. Use the local JSON importer or a current browser.');}
  const reader=blob.slice(start,start+packed).stream().pipeThrough(inflater).getReader();
  const result=new Uint8Array(unpacked);
  let p=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      if(p+value.length>unpacked){await reader.cancel();throw Error('ZIP score exceeded its declared size');}
      result.set(value,p);p+=value.length;
    }
  }finally{reader.releaseLock();}
  if(p!==unpacked)throw Error('Invalid ZIP score length');
  return decoder.decode(result);
}
const children=(node,name)=>Array.from(node.children).filter(n=>n.localName===name);
const child=(node,name)=>children(node,name)[0];
const val=(node,name)=>child(node,name)?.textContent;
const tones={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function parseScore(xml,r,path,province){
  // MusicXML commonly includes a harmless external DTD declaration; DOMParser
  // receives no declarations at all, and imported text is never treated as HTML.
  if(/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(xml))throw Error('Unsupported XML declaration');
  const doc=new DOMParser().parseFromString(xml.replace(/<!DOCTYPE[^>]*>/gi,''),'application/xml');
  const part=child(doc.documentElement,'part');
  if(doc.documentElement.localName!=='score-partwise'||!part)throw Error('Expected a MusicXML partwise score');
  const pitches=[],durations=[],onsets=[],measures=[],lyrics=[];
  let clock=0,div=1;
  for(const measure of children(part,'measure')){
    const attr=child(measure,'attributes'), d=attr&&Number(val(attr,'divisions'));
    if(d>0&&Number.isFinite(d))div=d;
    for(const note of children(measure,'note')){
      if(child(note,'chord')||child(note,'grace'))continue;
      const duration=Number(val(note,'duration'))/div;
      if(!Number.isFinite(duration)||duration<=0)continue;
      const onset=clock;clock+=duration;
      const pitch=child(note,'pitch');
      if(!pitch)continue;
      const octave=Number(val(pitch,'octave')), midi=12*(octave+1)+tones[val(pitch,'step')]+Number(val(pitch,'alter')||0);
      if(!Number.isFinite(midi)||midi<0||midi>127)continue;
      if(children(note,'tie').some(t=>t.getAttribute('type')==='stop')&&midi===pitches.at(-1)){durations[durations.length-1]+=duration;continue;}
      if(pitches.length>=10000)throw Error('Too many notes in first part');
      pitches.push(midi);durations.push(duration);onsets.push(onset);measures.push(measure.getAttribute('number')||'?');
      lyrics.push(children(note,'lyric').map(l=>children(l,'text').map(t=>t.textContent).join('')).filter(Boolean).join(' / '));
    }
  }
  if(pitches.length<4)throw Error('Fewer than four pitched events');
  const fields=r.fields||{}, get=k=>fields[k]?.value;
  const raw=get('metronome'), met=String(raw||'').match(/^(quarter|eighth|half)(\.*)=(\d+(?:\.\d+)?)$/);
  const tempos=[];
  if(met){
    const [,unit,dots,rate]=met, bpm=Number(rate)*{quarter:1,eighth:.5,half:2}[unit]*(2-0.5**dots.length);
    if(bpm>0&&Number.isFinite(bpm))tempos.push({onset:0,bpm,source:'unreviewed metadata candidate',mark:raw,verified:false});
  }
  const volume=r.volume_id;
  return {id:'anthology:'+province+':'+r.id,title:r.title,dataset:'Anthology · '+provinceNames[province]+' · '+volume,
    notation:'jianpu',pitches,durations,onsets,measures,lyrics,tempos,
    tempoMetadata:{mark:raw,text:get('tempo_text'),source:fields.metronome?.source,reviewStatus:fields.metronome?.review_status},
    context:'Book volume: '+volume+' · locality candidate: '+(get('locality')||'not supplied')+' · source category: '+(get('category')||'not supplied')+' · meter candidate: '+(get('meter')||'not supplied'),
    pitchReference:'1=C display; source candidate '+(get('tonic')||'not supplied'),
    provenance:path+' · '+(r.dataset_version||'version not supplied')+' · automatically recognized first part; catalogue scope is not verified origin or ethnicity',
    rights:'Authorized exploratory use only; public redistribution permission not verified',
    sourceUrl,collectionProvince:r.collection_province,metadataFields:fields};
}

export async function readAnthologyArchive(file,metadataTexts,province,onProgress=()=>{}){
  if(!Object.hasOwn(provinceNames,province))throw Error('Choose Shanghai or Shaanxi');
  if(!Array.isArray(metadataTexts)||metadataTexts.length<1||metadataTexts.length>2)throw Error('Choose the matching curated JSONL metadata');
  const rows=[], seen=new Set;
  for(const text of metadataTexts){
    if(typeof text!=='string'||text.length>24*MiB)throw Error('Unexpected metadata size');
    for(const line of text.split(/\r?\n/)){
      if(!line.trim())continue;
      const r=JSON.parse(line.trim());
      if(typeof r.volume_id!=='string'||!r.volume_id.toLowerCase().startsWith(province))throw Error('Metadata does not match the selected province');
      if(typeof r.id!=='string'||typeof r.title!=='string'||typeof r.assets?.musicxml!=='string'||seen.has(r.id))throw Error('Invalid or duplicate metadata record');
      if(rows.length>=2000)throw Error('Too many metadata records');
      seen.add(r.id);rows.push(r);
    }
  }
  if(!rows.length)throw Error('No metadata rows found');
  const entries=await directory(file), records=[], excluded=[];
  let totalBytes=0;
  if(!rows.some(r=>entries.has(normalizePath(r.assets.musicxml))))throw Error('No matching MusicXML paths; choose the official scores ZIP for '+provinceNames[province]);
  if(rows.some(r=>entries.get(normalizePath(r.assets.musicxml))?.method===8)){
    try{new DecompressionStream('deflate-raw');}
    catch{throw Error('This browser cannot decompress this ZIP. Use the local JSON importer or a current browser.');}
  }
  for(let i=0;i<rows.length;i++){
    const r=rows[i], path=normalizePath(r.assets.musicxml), item=entries.get(path);
    if(item?.unpacked<=2*MiB&&(totalBytes+=item.unpacked)>280*MiB)throw Error('Expanded score archive is too large');
    try{records.push(parseScore(await readXml(file,item),r,path,province));}
    catch(error){excluded.push({id:r.id,reason:error.message});}
    if(i===0||(i+1)%25===0||i===rows.length-1){
      onProgress(i+1,rows.length);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  if(!records.length)throw Error('No playable score lines found in the selected archive');
  return {records,excluded};
}
