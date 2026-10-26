/* Editorial-site language only. Does not change apps, consent, analytics or stored project data. */
(async()=>{
 const header=document.querySelector('.site-header');if(!header)return;
 const normalize=value=>{value=String(value||'').toLowerCase();return value==='en'?'en':['zh','zh-cn','zh-hans'].includes(value)?'zh':null;};
 let remembered;try{remembered=localStorage.getItem('musedlab.language');}catch{}
 let lang=normalize(new URLSearchParams(location.search).get('lang'))||normalize(remembered)||'en';
 const group=document.createElement('div');group.className='site-language';group.setAttribute('role','group');group.setAttribute('aria-label','Language / 语言');
 const buttons=['en','zh'].map(code=>{const b=document.createElement('button');b.type='button';b.lang=code==='zh'?'zh-Hans':'en';b.textContent=code==='en'?'English':'中文';b.disabled=true;group.append(b);return b;});header.append(group);
 let dictionary;try{const response=await fetch('/js/site-zh.json');if(!response.ok)throw Error();dictionary=await response.json();}catch{group.title='Language translations could not load. Reload to retry. / 翻译未能加载，请刷新重试。';return;}
 const path=location.pathname,full=['/','/index.html','/about.html'].includes(path),collaborate=/^\/collaborate\/(?:index.html)?$/.test(path);
 const scopes=[header,document.querySelector('.skip-link'),...document.querySelectorAll('.lab-footer')];
 if(full)scopes.push(document.querySelector('main'));if(collaborate)scopes.push(document.querySelector('.collaboration-hero'));
 const nodes=[];for(const scope of scopes.filter(Boolean)){const w=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentElement.closest('.site-language,script,style'))continue;const key=n.nodeValue.trim();if(dictionary[key])nodes.push([n,n.nodeValue,key]);}}
 const main=document.querySelector('main');let notice;if(!full&&!collaborate&&main){notice=document.createElement('p');notice.className='site-language-notice';notice.lang='zh-Hans';notice.textContent='本页导航提供中文，正文暂保留英文。您可以用中文联系我们。';main.before(notice);}
 const originalTitle=document.title;
 function apply(code,persist=false){lang=code;for(const [node,english,key]of nodes)node.nodeValue=lang==='zh'?english.replace(key,key==='People'&&node.parentElement.tagName==='DT'?'使用者':dictionary[key]):english;document.documentElement.lang=lang==='zh'?'zh-Hans':'en';if(main)main.lang=(!full&&!collaborate)?'en':document.documentElement.lang;
 buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(['en','zh'][i]===lang)));if(notice)notice.hidden=lang!=='zh';
 if(full)document.title=lang==='zh'?(path==='/about.html'?'关于 MusEDLab':'MusEDLab · 音乐、学习与创造的可能'):originalTitle;
 if(collaborate){document.querySelector('#en').hidden=lang==='zh';document.querySelector('#zh').hidden=lang!=='zh';document.querySelector('.chinese-invitation')?.setAttribute('hidden','');document.querySelectorAll('.collaboration-hero a[href="#zh"],#zh a[href="#en"]').forEach(a=>a.hidden=true);}
 // Carry only language to editorial pages with this shared switch. Keep every other query/hash intact.
 for(const a of document.querySelectorAll('a[href]')){try{const u=new URL(a.getAttribute('href'),location.href);if(u.origin===location.origin&&editorial.has(u.pathname)){u.searchParams.set('lang',lang);a.href=u.pathname+u.search+u.hash;}}catch{}}
 if(persist){try{localStorage.setItem('musedlab.language',lang);}catch{}const u=new URL(location.href);u.searchParams.set('lang',lang);history.replaceState(history.state,'',u);}
 }
 const editorial=new Set(document.documentElement.dataset.languagePages.split('|'));
 buttons.forEach((b,i)=>{b.disabled=false;b.addEventListener('click',()=>apply(['en','zh'][i],true));});apply(lang);
})();
