/* Run with Node 22+; no module installation or HTTP server needed. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');

const blocked = () => { throw new Error('External network disabled in smoke test'); };
globalThis.fetch = blocked;
for (const protocol of ['node:http','node:https']) {
  const network = require(protocol);
  network.get = network.request = blocked;
}
const { loadPyodide } = require('./pyodide.js');
const site = path.resolve(__dirname, '../../..');
const syntheticOrigin = 'https://musedlab.test';
const local = target => {
  const url = new URL(target);
  assert.equal(url.origin, syntheticOrigin, 'worker made a third-party request');
  assert.match(url.pathname, /^\/interfacestudies\//);
  return path.join(site,url.pathname.slice('/interfacestudies/'.length));
};
async function run(worker) {
  const workerFile = path.join(site,worker);
  const workerUrl = new URL('/interfacestudies/'+worker,syntheticOrigin);
  const messages = [], requested=[];
  const world = {
    URL, self:{location:workerUrl},
    importScripts(url) { assert.equal(local(url),path.join(__dirname,'pyodide.js')); requested.push(url); },
    async loadPyodide(options) {
      assert.equal(path.resolve(local(options.indexURL)),__dirname);
      assert.equal(path.resolve(local(options.packageBaseUrl)),__dirname);
      return loadPyodide({indexURL:__dirname,packageBaseUrl:__dirname});
    },
    async fetch(resource) {
      const url = new URL(resource,workerUrl);
      requested.push(url.href);
      return new Response(await fs.readFile(local(url)));
    },
    postMessage(message) { messages.push(message); },
  };
  vm.runInNewContext(await fs.readFile(workerFile,'utf8'),world,{filename:workerFile});
  await world.onmessage({data:{action:'init'}});
  assert.equal(messages.at(-1)?.ready,true,messages.at(-1)?.error);
  const notes = [60,64,67,64,60].map((pitch,index)=>({pitch,velocity:90,start:index/3,duration:.29}));
  if(worker.startsWith('ai-music-lab/')) {
    await world.onmessage({data:{id:0,action:'learn',notes}});
    assert.equal(messages.at(-1)?.result?.phrases,1,messages.at(-1)?.error);
  }
  await world.onmessage({data:{id:1,action:'continue',notes,length:4}});
  assert.equal(messages.at(-1)?.id,1,messages.at(-1)?.error);
  assert.ok(Array.isArray(messages.at(-1).result.notes) && messages.at(-1).result.notes.length>0,
    JSON.stringify(messages.at(-1)));
  await world.onmessage({data:{id:2,action:'clear'}});
  assert.equal(messages.at(-1).result.phrases,0);
  assert.equal(requested.length,3);
  console.log(worker+': same-origin requests, Python/NumPy, generation and clear passed');
}
(async()=>{
  await run('continuator/worker.js');
  await run('ai-music-lab/continuator/worker.js');
})().catch(error=>{console.error(error);process.exitCode=1;});
