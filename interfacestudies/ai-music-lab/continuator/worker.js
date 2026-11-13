importScripts('https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.js');
let py;
onmessage=async({data})=>{try{if(data.action==='init'){
py=await loadPyodide(); await py.loadPackage('numpy');
const response=await fetch('engine.zip'); if(!response.ok) throw new Error('Engine package unavailable');
py.unpackArchive(await response.arrayBuffer(),'zip');
await py.runPythonAsync(await (await fetch('bridge.py')).text());
postMessage({ready:true});
}else{py.globals.set('payload',JSON.stringify(data));const result=py.runPython('exchange(payload)');postMessage({id:data.id,result:JSON.parse(result)});}}
catch(e){postMessage({error:String(e)});}};
