const runtimeBase = new URL('../vendor/continuator/pyodide-0.28.3/', self.location.href);
importScripts(new URL('pyodide.js', runtimeBase).href);
let py;
onmessage=async({data})=>{try{if(data.action==='init'){
py=await loadPyodide({indexURL:runtimeBase.href,packageBaseUrl:runtimeBase.href});
await py.loadPackage('numpy',{checkIntegrity:true});
const response=await fetch('engine.zip'); if(!response.ok) throw new Error('Engine package unavailable');
py.unpackArchive(await response.arrayBuffer(),'zip');
await py.runPythonAsync(await (await fetch('bridge.py')).text());
postMessage({ready:true});
}else{py.globals.set('payload',JSON.stringify(data));const result=py.runPython('exchange(payload)');postMessage({id:data.id,result:JSON.parse(result)});}}
catch(e){postMessage({error:String(e)});}};
