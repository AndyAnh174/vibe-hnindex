import { afterAll, beforeAll, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
let temp: string, client: Client;
beforeAll(async()=>{
  temp=fs.mkdtempSync(path.join(os.tmpdir(),'hnindex-security-mcp-'));
  const root=path.join(temp,'repo');fs.mkdirSync(root);
  fs.writeFileSync(path.join(root,'app.ts'),'app.get("/profile", requireAuth, (req,res)=>eval(req.query.code));');
  client=new Client({name:'security-mcp-test',version:'1'});
  const transport=new StdioClientTransport({command:process.execPath,args:['node_modules/tsx/dist/cli.mjs','src/index.ts'],cwd:process.cwd(),env:{STORAGE_PATH:path.join(temp,'storage'),WATCH_AUTO_RESUME:'false',CHAT_MEMORY_ENABLED:'false',SEARCH_RERANK:'false',RERANK_PROVIDER:'none',CODE_GRAPH_ENABLED:'true'},stderr:'pipe'});
  transport.stderr?.on('data',()=>{});
  await client.connect(transport);
  await client.callTool({name:'index_code_graph',arguments:{path:root,project_name:'fixture'}});
},30000);
afterAll(async()=>{
  await client?.close();
  if(temp&&path.basename(temp).startsWith('hnindex-security-mcp-'))fs.rmSync(temp,{recursive:true,force:true});
});
it('exposes all security tools and preserves filters/rerank arguments over actual MCP',async()=>{
  const tools=(await client.listTools()).tools;
  expect(tools.map(t=>t.name)).toEqual(expect.arrayContaining(['security_audit','security_context','pentest_plan']));
  for(const [name,extra] of [['security_audit',{}],['security_context',{query:'profile authentication'}],['pentest_plan',{}]] as const){
    const r=await client.callTool({name,arguments:{project_name:'fixture',file_pattern:'app.ts',rerank:false,...extra}});
    expect(r.isError).not.toBe(true);
    const text=(r.content as Array<{type:string;text?:string}>).filter(c=>c.type==='text').map(c=>c.text).join('\n');
    const data=JSON.parse(text);expect(data.coverage.scannedFiles).toBe(1);expect(data.rerank.status).toBe('disabled');
  }
});
