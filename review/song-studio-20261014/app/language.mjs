import {dictionary} from './language-dictionary.mjs';
// Only presentation text changes. Project fields, original lyrics and audio stay untouched.
const key='song-studio.language',records=new WeakMap();let language='en';
export const normalize=value=>/^en$/i.test(value||'')?'en':/^zh(?:-cn|-hans)?$/i.test(value||'')?'zh':null;
const protectedText='script,style,textarea,pre,.workshop-language,[data-no-translate],.library-song,[data-word],[data-live-word],[data-marker],#section-strip,.track-name,#preview-note';
const patterns=[
 [/^Audio missing: (.+)\. Reopen the original file\.$/,(_,n)=>`缺少音频：${n}。请重新打开原文件。`],
 [/^Fresh Annotator example · (.+) · (.+)\. Original audio, lyrics, section timings, and recovered drawings\. (\d+) timed phrases are kept whole; their internal word times are unavailable\. Timings still need your review\.$/,(_,a,b,n)=>`Fresh Annotator 示例 · ${a} · ${b}。原有音频、歌词、段落时间及恢复的画作。${n} 个带时间的乐句按整体保留，没有内部逐词时间。仍需要你核听。`],
 [/^Loaded (\d+) lyric events and (\d+) keyword events through the original Annotator SongLoader\. Permanent word IDs bind the artwork\.$/,(_,w,k)=>`已通过原有 Annotator SongLoader 加载 ${w} 个歌词事件和 ${k} 个关键词事件。画作通过永久词编号关联。`],
 [/^(.+) · (\d+) sound layers? · (.+)$/,(_,d,n,s)=>`${d} · ${n} 个声音层 · ${s}`],
 [/^(\d+) (words|timed words \/ phrases) · (\d+) reviewed by you · (\d+) starred · (\d+) archived$/,(_,n,u,r,s,a)=>`${n} 个${u==='words'?'词':'词／乐句'} · ${r} 个已核听 · ${s} 个已标星 · ${a} 个已存档`],
 [/^(\d+) of (\d+) word timings are marked reviewed\. (\d+) still need a listen\. Exports retain their timing source and review status\.$/,(_,r,n,l)=>`${n} 个词中已有 ${r} 个时间标记完成核听，还有 ${l} 个需要核听。导出会保留时间来源和核听状态。`],
 [/^Edit (.+) at ([\d.]+) seconds$/,(_,w,t)=>`编辑“${w}”，位置 ${t} 秒`],
 [/^Listen to (.+) at ([\d.]+) seconds$/,(_,w,t)=>`回听“${w}”，位置 ${t} 秒`],
 [/^(Add|Remove) keyword status for (.+)$/,(_,a,w)=>`${a==='Add'?'添加':'取消'}“${w}”的关键词标记`],
 [/^Section (\d+) label$/,(_,n)=>`第 ${n} 段名称`],[/^Section (\d+) start in seconds$/,(_,n)=>`第 ${n} 段起点（秒）`],[/^Mark section (\d+) reviewed$/,(_,n)=>`将第 ${n} 段标记为已核听`],
 [/^(.+) volume$/,(_,n)=>`${n} 音量`],[/^(.+) offset$/,(_,n)=>`${n} 偏移量`],
 [/^(.+) · needs a listen$/,(_,s)=>`${s} · 需要核听`],
 [/^(.+) for “(.+)”\. Change the picture if you imagine something else\.$/,(_,d,w)=>`为“${w}”推荐：${dictionary[d]||d}。如果有其他想法，可以换图。`],
 [/^No automatic match for “(.+)” yet\. Choose a picture below\.$/,(_,w)=>`暂未找到与“${w}”匹配的草图，请在下方选图。`],
 [/^Next: “(.+)”$/,(_,w)=>`下一个：“${w}”`],
 [/^Missing audio for (.+)\.$/,(_,n)=>`缺少 ${n} 的音频。`],
 [/^Sketch added to “(.+)”\. You can draw on it, or undo a stroke\.(.*)$/,(_,w,extra)=>`已为“${w}”添加草图。可以继续绘画，或撤销笔画。${extra?'将此词标星后可显示动画。':''}`],
 [/^(\d+) words · (\d+) untimed · (\d+) sections\. (Existing drawings and notes will stay attached\.|Lyrics differ from this project\.)$/,(_,w,u,s,e)=>`${w} 个词 · ${u} 个尚无时间 · ${s} 个段落。${e.startsWith('Existing')?'已有画作和笔记将继续关联。':'歌词与当前作品不同。'}`],
 [/^Added (\d+) sketches?\. Kept (\d+) existing drawings?\.(.*)$/,(_,a,k,extra)=>`已添加 ${a} 幅草图，保留 ${k} 幅已有画作。${extra.replace(' Choose pictures for: ','请为这些词选图：').replace('Select a word, then Suggest a drawing.','选择一个词，再点击“推荐草图”。')}`]
];
function translate(source){if(language==='en')return source;const trimmed=source.trim(),text=trimmed.replace(/\s+/g,' ');let out=dictionary[text];if(out===undefined)for(const [re,fn]of patterns)if(re.test(text)){out=text.replace(re,fn);break;}return out===undefined?source:source.replace(trimmed,out);}
function value(node,key,current,set){const rec=records.get(node)||{},prior=rec[key],source=prior&&prior.output===current?prior.source:current,output=translate(source);rec[key]={source,output};records.set(node,rec);if(output!==current)set(output);}
function walk(node){
 if(node.nodeType===3){if(!node.parentElement?.closest(protectedText))value(node,'text',node.nodeValue,v=>node.nodeValue=v);return;}
 if(node.nodeType!==1||node.closest('script,style,pre,.workshop-language,[data-no-translate]'))return;
 for(const attr of ['title','aria-label','placeholder'])if(node.hasAttribute(attr))value(node,attr,node.getAttribute(attr),v=>node.setAttribute(attr,v));
 if(node.tagName!=='TEXTAREA')for(const child of node.childNodes)walk(child);
}
const allowed=new Set([location.origin,'https://ruthmann.github.io','https://workshop.musedlab.org']);let parentOrigin=null;
try{const origin=new URL(document.referrer).origin;if(allowed.has(origin))parentOrigin=origin;}catch{}
function setLanguage(next,persist=true,announce=true){
 if(!normalize(next))return;language=normalize(next);document.documentElement.lang=language==='zh'?'zh-CN':'en';
 for(const b of document.querySelectorAll('.workshop-language button'))b.setAttribute('aria-pressed',String(b.dataset.language===language));walk(document.body);
 if(persist){try{localStorage.setItem(key,language);}catch{}const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);}
 for(const a of document.querySelectorAll('a[href]')){const u=new URL(a.getAttribute('href'),location.href);if(u.origin===location.origin&&u.pathname.startsWith('/review/song-studio-20261014/')&&!u.pathname.endsWith('.md')){u.searchParams.set('lang',language);a.href=u.href;}}
 if(announce&&parentOrigin&&parent!==window)parent.postMessage({type:'rgf-language',language},parentOrigin);
}
const q=new URLSearchParams(location.search);let saved;try{saved=localStorage.getItem(key);}catch{}
setLanguage(normalize(q.get('lang'))||normalize(q.get('launcherlang'))||normalize(saved)||'en',false,false);
for(const b of document.querySelectorAll('.workshop-language button')){b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',()=>setLanguage(b.dataset.language));}
new MutationObserver(changes=>{for(const c of changes){if(c.type==='childList')c.addedNodes.forEach(walk);else walk(c.target);}}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});
addEventListener('message',event=>{const d=event.data;if(parent===window||event.source!==parent||event.origin!==parentOrigin||!d||Object.keys(d).length!==2||d.type!=='rgf-language'||!['en','zh'].includes(d.language)||d.language===language)return;setLanguage(d.language,true,false);});
