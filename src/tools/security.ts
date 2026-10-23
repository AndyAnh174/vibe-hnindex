import { z } from 'zod';
import { minimatch } from 'minimatch';
import { config } from '../config.js';
import { getProject } from '../services/sqlite.js';
import { projectFiles, readWorkspaceFile, snapshotHash } from '../services/workspace.js';
import { SECURITY_CATEGORIES, SECURITY_RULES, redactSecurityText, hasUnquotedCredential, type SecurityCategory } from '../services/security.js';
import { rerankSearchResults } from '../services/rerank.js';
import { graphTokenCount } from './code-graph.js';
import type { SearchResult } from '../types.js';

export const securityArgs = {
  project_name:z.string().min(1).max(256),
  file_pattern:z.string().min(1).max(500).optional().describe('Repository-relative glob; filters before reading/reranking'),
  categories:z.array(z.enum(SECURITY_CATEGORIES)).min(1).max(12).optional(),
  query:z.string().trim().min(1).max(2000).optional().describe('Security review focus; no target URL is fetched'),
  limit:z.number().int().min(1).max(100).default(20),
  max_files:z.number().int().min(1).max(5000).default(1000),
  token_budget:z.number().int().min(1000).max(20000).default(6000),
  rerank:z.boolean().optional().describe('Follows SEARCH_RERANK and configured Voyage/HTTP reranker; false forces local order'),
};
const schema=z.object(securityArgs);
type Args=z.input<typeof schema>;
type Evidence={ id:string; file:string; line:number; endLine:number; category:SecurityCategory; rule:string; cwe:string; title:string; status:'needs_review'|'surface'; source:'live'; snapshotHash:string; excerpt:string; reviewPriority:number; validation:string[] };
const response=(value:unknown)=>({content:[{type:'text' as const,text:JSON.stringify(value,null,2)}]});

async function collect(input:Args, kind:'audit'|'context'|'plan') {
  const parsed=schema.safeParse(input);
  if(!parsed.success) return {error:'Invalid security tool arguments', details:parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`)};
  const args=parsed.data;
  if(kind==='context'&&!args.query) return {error:'security_context requires a nonempty query.'};
  const project=getProject(args.project_name);
  if(!project) return {error:'Project not indexed. Run index_codebase or index_code_graph first.'};
  const files=projectFiles(args.project_name);
  const scoped=files.filter(f=>!args.file_pattern||minimatch(f,args.file_pattern,{dot:true}));
  const rules=SECURITY_RULES.filter(r=>!args.categories||args.categories.includes(r.category));
  const evidence:Evidence[]=[];
  const skipped:Array<{file:string;reason:string}>=[];
  let scanned=0, linesScanned=0, skippedLongLines=0, scanTruncated=false;
  // Caps bound I/O, matching work and candidate memory independently of output limits.
  const lineCap=200000, candidateCap=2000;
  for(const file of scoped.slice(0,args.max_files)) {
    if(linesScanned>=lineCap||evidence.length>=candidateCap){scanTruncated=true;break;}
    if(/(^|\/)(?:\.env(?:\..*)?|\.mcp\.json|\.npmrc|\.pypirc|\.netrc)$|\.(?:pem|key|p12|pfx)$/i.test(file)){skipped.push({file,reason:'credential container'});continue;}
    const content=readWorkspaceFile(project.rootPath,file,config.maxFileSize);
    if(content===null){skipped.push({file,reason:'unreadable, excluded, oversized, binary or outside root'});continue;}
    scanned++;
    const lines=content.split('\n'), safeLines=redactSecurityText(content).split('\n'), hash=snapshotHash(content);
    for(let i=0;i<lines.length;i++) {
      if(linesScanned>=lineCap||evidence.length>=candidateCap){scanTruncated=true;break;}
      linesScanned++;
      const line=lines[i];
      // A single minified/generated line cannot monopolize regex matching or output.
      if(line.length>16000){skippedLongLines++;scanTruncated=true;continue;}
      for(const rule of rules) if(rule.pattern.test(line)||(rule.id==='credential'&&hasUnquotedCredential(line))) {
        const start=Math.max(0,i-2), end=Math.min(lines.length,i+3);
        // Redact the complete file first so multiline private keys cannot leak via excerpt boundaries.
        evidence.push({id:`${rule.id}:${file}:${i+1}`,file,line:i+1,endLine:i+1,category:rule.category,rule:rule.id,cwe:rule.cwe,title:rule.title,status:rule.kind==='candidate'?'needs_review':'surface',source:'live',snapshotHash:hash,excerpt:safeLines.slice(start,end).join('\n').slice(0,1400),reviewPriority:rule.priority,validation:rule.validation});
        if(evidence.length>=candidateCap) break;
      }
    }
  }
  const query=redactSecurityText(args.query??'Review source security boundaries and prioritize evidence for manual validation');
  const words=[...new Set(query.toLowerCase().match(/[\p{L}\p{N}_]{3,}/gu)??[])].slice(0,40);
  const score=(e:Evidence)=>e.reviewPriority+words.reduce((n,w)=>n+(`${e.file} ${e.category} ${e.title} ${e.excerpt}`.toLowerCase().includes(w)?20:0),0);
  evidence.sort((a,b)=>score(b)-score(a)||a.file.localeCompare(b.file)||a.line-b.line||a.rule.localeCompare(b.rule));
  const pool=evidence.slice(0,Math.min(200,Math.max(args.limit,config.searchRerankPool)));
  const hits:SearchResult[]=pool.map(e=>({id:e.id,filePath:e.file,absolutePath:'',chunkIndex:0,startLine:e.line,endLine:e.endLine,language:'text',content:`${e.category}: ${e.title}\n${e.excerpt}`,score:score(e),matchType:'keyword'}));
  const enabled=args.rerank!==false&&config.searchRerankEnabled&&config.rerankProvider!=='none';
  let ranked=hits;
  let status='disabled';
  if(enabled&&hits.length>1){ranked=await rerankSearchResults(query,hits);status=ranked===hits?'fallback':'applied';}
  else if(enabled) status='insufficient_candidates';
  const byId=new Map(pool.map(e=>[e.id,e]));
  const selected=ranked.slice(0,args.limit).map(hit=>byId.get(hit.id)!);
  const coverage={indexedFiles:files.length,scopedFiles:scoped.length,scannedFiles:scanned,skippedFiles:skipped.length,linesScanned,skippedLongLines,matchedCandidates:evidence.length,truncated:scanTruncated||scoped.length>scanned+skipped.length,skipped:skipped.slice(0,20),scope:'live content of indexed paths only',limitations:['Pattern-based leads require source/dataflow and runtime validation; no exploitability verdict or clean bill of health.', 'Unindexed/ignored files are outside coverage. Graph-only projects contain JS/TS paths only; index_codebase includes other languages.', 'Matches can include comments, fixtures and safe uses. Multiline/indirect flows and custom APIs may be missed. No dependency advisory lookup or network pentest is performed.']};
  return {args,query,evidence:selected,coverage,rerank:{status,provider:config.rerankProvider,documents:hits.length},project:project.projectName,workspace:project.rootPath,matched:evidence.length};
}

function format(data:Awaited<ReturnType<typeof collect>>, kind:'audit'|'context'|'plan') {
  if('error' in data) return response(data);
  const key=kind==='audit'?'candidates':kind==='context'?'evidence':'checks';
  const items:unknown[]=kind==='plan'?[...new Set(data.evidence.map(e=>e.category))].map(category=>({category,evidence:data.evidence.filter(e=>e.category===category).map(({file,line,rule})=>({file,line,rule})),validation:[...new Set(data.evidence.filter(e=>e.category===category).flatMap(e=>e.validation))]})):data.evidence;
  const result={project:data.project,workspace:data.workspace,query:data.query.slice(0,200),queryTruncated:data.query.length>200,...(kind==='plan'?{executed:false}:{}),coverage:data.coverage,rerank:data.rerank,[key]:items,outputTruncated:data.matched>data.evidence.length,note:'Review evidence, not confirmed findings. CWE labels classify review topics, not exploitability. Rerank scores express relevance, not severity. External reranking receives best-effort-redacted snippets when enabled; use rerank:false to keep this operation local.'};
  let text=JSON.stringify(result,null,2);
  // Binary search avoids re-encoding a long result once per removed candidate.
  if(graphTokenCount(text)>data.args.token_budget){
    result.outputTruncated=true;
    const original=[...items]; let low=0,high=items.length;
    while(low<high){const mid=Math.ceil((low+high)/2);items.splice(0,items.length,...original.slice(0,mid));if(graphTokenCount(JSON.stringify(result,null,2))<=data.args.token_budget)low=mid;else high=mid-1;}
    items.splice(0,items.length,...original.slice(0,low));
    text=JSON.stringify(result,null,2);
  }
  if(graphTokenCount(text)>data.args.token_budget){result.query='';result.queryTruncated=true;result.coverage.skipped=[];text=JSON.stringify(result,null,2);}
  if(graphTokenCount(text)>data.args.token_budget)return response({project:data.project,outputTruncated:true,error:'Metadata exceeds token_budget; narrow scope or increase the budget.'});
  return {content:[{type:'text' as const,text}]};
}
export async function securityAuditTool(args:Args){return format(await collect(args,'audit'),'audit');}
export async function securityContextTool(args:Args){return format(await collect(args,'context'),'context');}
export async function pentestPlanTool(args:Args){return format(await collect(args,'plan'),'plan');}
