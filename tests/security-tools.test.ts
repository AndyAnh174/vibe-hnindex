import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let temp: string, root: string;
let db: typeof import('../src/services/sqlite.js');
let api: Record<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>>;
const secret = 'sk-' + 'A'.repeat(30);
const sources: Record<string, string> = {
  'src/db.ts': 'export function lookup(req) {\n return db.query("SELECT * FROM users WHERE id=" + req.query.id);\n}',
  'src/run.py': 'def run(request):\n    return subprocess.run(request.args["cmd"], shell=True)',
  'src/key.ts': `export const api_key = "${secret}";`,
  'src/view.tsx': 'export function View(props) { return <div dangerouslySetInnerHTML={{__html: props.html}} />; }',
  'src/safe.ts': 'export function lookup(id) { return db.query("SELECT * FROM users WHERE id = ?", [id]); }',
  'src/routes.ts': 'app.get("/account/:id", requireAuth, getAccount);',
  'ignored.ts': 'eval(req.body.code);',
};
const json = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0].text);
async function call(name: string, args: Record<string, unknown> = {}) {
  expect(api[name], 'Security tool implementation is missing').toBeTypeOf('function');
  return json(await api[name]({ project_name: 'p', rerank: false, ...args }));
}
beforeAll(async () => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hnindex-security-')); root = path.join(temp, 'repo'); fs.mkdirSync(root);
  vi.stubEnv('STORAGE_PATH', path.join(temp, 'storage'));
  vi.stubEnv('SEARCH_RERANK', 'true'); vi.stubEnv('RERANK_PROVIDER', 'http'); vi.stubEnv('RERANK_URL', 'http://rerank.invalid');
  vi.stubEnv('CHAT_MEMORY_ENABLED', 'false');
  db = await import('../src/services/sqlite.js'); db.initDatabase();
  // Missing feature is asserted by call(), rather than a module-resolution error.
  api = await import('../src/tools/security.js');
});
beforeEach(() => {
  for (const p of db.listProjects()) db.deleteProject(p.projectName);
  db.upsertProject('p', root);
  for (const [file, content] of Object.entries(sources)) {
    fs.mkdirSync(path.dirname(path.join(root,file)), { recursive: true }); fs.writeFileSync(path.join(root,file), content);
    db.insertChunks([{ id: file, projectName:'p', filePath:file, absolutePath:path.join(root,file), chunkIndex:0, startLine:1, endLine:content.split('\n').length, content, language:file.endsWith('.py')?'python':'typescript', fileHash:'old', indexedAt:new Date().toISOString() }]);
  }
  fs.writeFileSync(path.join(root,'.hnindexignore'),'ignored.ts\n');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network'); }));
});
afterAll(() => {
  db?.getDb().close();
  if (temp && path.basename(temp).startsWith('hnindex-security-')) fs.rmSync(temp,{ recursive:true, force:true });
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
describe('source-backed security tools', () => {
  it('returns review candidates at live source lines, not confirmed vulnerabilities', async () => {
    const r = await call('securityAuditTool');
    expect(r.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ file:'src/db.ts', line:2, category:'injection', status:'needs_review', source:'live' }),
      expect.objectContaining({ file:'src/run.py', line:2, category:'command_execution' }),
      expect.objectContaining({ file:'src/view.tsx', category:'xss' }),
    ]));
    expect(r.candidates.some((c: {file:string}) => ['src/safe.ts','ignored.ts'].includes(c.file))).toBe(false);
    expect(r.coverage).toMatchObject({ indexedFiles:7, scannedFiles:6, skippedFiles:1 });
  });
  it('reads changed source instead of returning stale indexed evidence', async () => {
    fs.writeFileSync(path.join(root,'src/db.ts'),'// fixed\nexport const ok = true;');
    const r = await call('securityAuditTool', { categories:['injection'] });
    expect(r.candidates).toEqual([]);
  });
  it('honors scope and category filters with honest truncated coverage', async () => {
    const r = await call('securityAuditTool',{ file_pattern:'src/*.py', categories:['command_execution'], max_files:1 });
    expect(r.candidates).toHaveLength(1); expect(r.candidates[0].file).toBe('src/run.py');
    const bounded = await call('securityAuditTool',{ file_pattern:'src/**', max_files:1 });
    expect(bounded.coverage).toMatchObject({ scannedFiles:1, truncated:true });
  });
  it('redacts credentials from evidence and outbound rerank documents', async () => {
    let sent = '';
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      sent = options.body; const body=JSON.parse(sent);
      return { ok:true, json:async()=>({ scores:body.documents.map((document: string)=>document.includes('src/view.tsx')?10:0) }) };
    }));
    const r = await call('securityAuditTool',{ rerank:true, query:'security review '+secret });
    expect(JSON.stringify(r)).not.toContain(secret); expect(sent).not.toContain(secret);
    expect(sent).toContain('[REDACTED]');
    expect(r.candidates[0].file).toBe('src/view.tsx');
    expect(r.rerank.status).toBe('applied');
  });
  it('keeps evidence and order when reranking fails', async () => {
    const baseline=await call('securityAuditTool');
    const r=await call('securityAuditTool',{rerank:true});
    expect(r.candidates).toEqual(baseline.candidates); expect(r.rerank.status).toBe('fallback');
  });
  it('obeys both global rerank configuration and per-call opt-out', async () => {
    const { config } = await import('../src/config.js');
    const original=config.searchRerankEnabled; config.searchRerankEnabled=false;
    try { expect((await call('securityAuditTool',{rerank:true})).rerank.status).toBe('disabled'); }
    finally { config.searchRerankEnabled=original; }
    expect((await call('securityAuditTool')).rerank.status).toBe('disabled');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('gathers source context for a security question without embedding services', async () => {
    const r=await call('securityContextTool',{query:'account authentication route', file_pattern:'src/routes.ts'});
    expect(r.evidence).toContainEqual(expect.objectContaining({file:'src/routes.ts',line:1}));
    expect(r.query).toBe('account authentication route'); expect(fetch).not.toHaveBeenCalled();
  });
  it('retains authorization entry points as review surfaces in a scoped audit', async () => {
    const r=await call('securityAuditTool',{categories:['authorization']});
    expect(r.candidates).toContainEqual(expect.objectContaining({file:'src/routes.ts',category:'authorization',status:'surface'}));
  });
  it('builds a source-linked validation plan without claiming it ran a pentest', async () => {
    const r=await call('pentestPlanTool',{categories:['command_execution']});
    expect(r.executed).toBe(false); expect(r.checks).toHaveLength(1);
    expect(r.checks[0]).toMatchObject({category:'command_execution', evidence:[expect.objectContaining({file:'src/run.py',line:2})]});
    expect(r.checks[0].validation.length).toBeGreaterThan(0); expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects unknown projects, unsupported categories and unbounded requests', async () => {
    expect((await call('securityAuditTool',{project_name:'missing'})).error).toBeTruthy();
    expect((await call('securityAuditTool',{categories:['typo']})).error).toBeTruthy();
    expect((await call('securityContextTool',{query:''})).error).toBeTruthy();
    expect((await call('securityAuditTool',{limit:0})).error).toBeTruthy();
  });
  it('keeps source line evidence correct after multiline private-key redaction', async () => {
    const source='const pem = `-----BEGIN PRIVATE KEY-----\n'+ ('A'.repeat(50)+'\n').repeat(8)+'-----END PRIVATE KEY-----`;\neval(req.body.code);';
    fs.writeFileSync(path.join(root,'src/db.ts'),source);
    const r=await call('securityAuditTool',{file_pattern:'src/db.ts'});
    const hit=r.candidates.find((e: {rule:string})=>e.rule==='shell');
    expect(hit).toMatchObject({line:11}); expect(hit.excerpt).toContain('eval(req.body.code)');
    expect(JSON.stringify(r)).not.toContain('A'.repeat(50));
  });
  it('enforces the token budget while reporting omitted candidates', async () => {
    fs.writeFileSync(path.join(root,'src/db.ts'),Array.from({length:120},()=> 'eval(req.body.code);').join('\n'));
    const r=await call('securityAuditTool',{limit:100,token_budget:1000,file_pattern:'src/db.ts',query:'界'.repeat(1800)});
    const {graphTokenCount}=await import('../src/tools/code-graph.js');
    expect(graphTokenCount(JSON.stringify(r,null,2))).toBeLessThanOrEqual(1000);
    expect(r.outputTruncated).toBe(true); expect(r.coverage.matchedCandidates).toBe(120);
  });
  it('reports omitted overlong source lines instead of implying full rule coverage', async () => {
    fs.writeFileSync(path.join(root,'src/db.ts'),'x'.repeat(17000)+'; eval(req.body.code);');
    const r=await call('securityAuditTool',{file_pattern:'src/db.ts'});
    expect(r.coverage.skippedLongLines).toBe(1); expect(r.coverage.truncated).toBe(true);
  });
  it('redacts unquoted YAML credentials in adjacent context before reranking', async () => {
    const value='opaque-'+'z9'.repeat(18);
    fs.writeFileSync(path.join(root,'src/db.ts'),'PASSWORD: '+value+'\neval(request.body.code);\nfetch(request.url);');
    let sent='';
    vi.stubGlobal('fetch',vi.fn(async(_url,options)=>{sent=options.body;return {ok:true,json:async()=>({scores:JSON.parse(sent).documents.map(()=>1)})};}));
    const r=await call('securityAuditTool',{file_pattern:'src/db.ts',rerank:true});
    expect(JSON.stringify(r)).not.toContain(value); expect(sent).not.toContain(value);
    expect(r.candidates.some((e: {category:string})=>e.category==='secrets')).toBe(true);
  });
  it('does not read an indexed path that now resolves outside the project', async () => {
    const outside=path.join(temp,'outside'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside,'external.ts'),'eval(request.body)');
    fs.symlinkSync(outside,path.join(root,'link'),'junction');
    db.insertChunks([{id:'outside',projectName:'p',filePath:'link/external.ts',absolutePath:path.join(root,'link/external.ts'),chunkIndex:0,startLine:1,endLine:1,content:'eval(request.body)',language:'typescript',fileHash:'old',indexedAt:new Date().toISOString()}]);
    const r=await call('securityAuditTool');
    expect(r.candidates.some((c: {file:string})=>c.file==='link/external.ts')).toBe(false);
  });
});
