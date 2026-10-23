import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
let temp:string,root:string;
let db:typeof import('../src/services/sqlite.js');
let store:typeof import('../src/services/code-graph-store.js');
let tools:typeof import('../src/tools/code-graph.js');
let locator:typeof import('../src/tools/locate-code.js');
const sources=[
  {filePath:'util.py',content:'def target():\n return 1\n'},
  {filePath:'main.py',content:'from util import target\ndef caller():\n return target()\n'},
  {filePath:'api.php',content:'<?php function entry() { return 1; }'},
  {filePath:'ignore.php',content:'<?php function hidden() { return 1; }'},
];
beforeAll(async()=>{
  temp=fs.mkdtempSync(path.join(os.tmpdir(),'hnindex-polyglot-'));root=path.join(temp,'repo');fs.mkdirSync(root);
  vi.stubEnv('STORAGE_PATH',path.join(temp,'storage'));vi.stubEnv('CODE_GRAPH_ENABLED','true');vi.stubEnv('WATCH_AUTO_RESUME','false');vi.stubEnv('RERANK_PROVIDER','none');
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Network forbidden');}));
  db=await import('../src/services/sqlite.js');db.initDatabase();store=await import('../src/services/code-graph-store.js');tools=await import('../src/tools/code-graph.js');locator=await import('../src/tools/locate-code.js');
});
beforeEach(()=>{
  for(const p of db.listProjects())db.deleteProject(p.projectName);
  for(const s of sources)fs.writeFileSync(path.join(root,s.filePath),s.content);
  fs.writeFileSync(path.join(root,'.hnindexignore'),'ignore.php\n');
});
afterAll(()=>{db?.getDb().close();if(temp&&path.basename(temp).startsWith('hnindex-polyglot-'))fs.rmSync(temp,{recursive:true,force:true});vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('multilingual graph storage/tool integration',()=>{
  it('indexes foreign languages offline and exposes fresh source/caller evidence',async()=>{
    const result=await tools.indexCodeGraphTool({path:root,project_name:'poly'});
    expect(result.content[0].text).toContain('Files: 3');
    expect(store.graphSources('poly').map(s=>s.filePath)).toEqual(['api.php','main.py','util.py']);
    expect(tools.callersTool({project_name:'poly',symbol:'target'}).content[0].text).toContain('main.py:3:');
    const located=JSON.parse((await locator.locateCodeTool({project_name:'poly',symbol:'target'})).content[0].text);
    expect(located.locations[0]).toMatchObject({file:'util.py',line:1,origin:'graph',freshness:'fresh'});
    expect(fetch).not.toHaveBeenCalled();
  });
  it('re-resolves unchanged Python consumers after incremental edits and removes deleted sources',()=>{
    db.upsertProject('poly',root);store.syncCodeGraph('poly',root,sources.slice(0,3));
    store.updateCodeGraphFile('poly',root,'util.py','def replacement():\n return 1\n');
    expect(store.findGraphNodes('poly',{symbol:'target'})).toEqual([]);
    expect(store.graphEdges('poly',[store.findGraphNodes('poly',{symbol:'caller'})[0].id],'outgoing',['CALLS'],10)[0].resolution).toBe('unresolved');
    store.updateCodeGraphFile('poly',root,'api.php',null);
    expect(store.graphSources('poly').some(s=>s.filePath==='api.php')).toBe(false);
  });
});
