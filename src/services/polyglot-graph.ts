import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import type { Node as SyntaxNode, Language, Parser } from 'web-tree-sitter';
import type { CodeGraph, GraphNode, GraphEdgeKind, GraphSource } from './code-graph.js';

const require = createRequire(import.meta.url);
const registry = require('../../graph-languages.json') as {extensions:Record<string,string>;labels:Record<string,string>};
const languages = registry.extensions;
export const CODE_GRAPH_LANGUAGES = Object.values(registry.labels);
export const POLYGLOT_LANGUAGES = [...new Set(Object.values(languages))];
export function graphLanguage(file: string): string | undefined { return languages[path.extname(file).slice(1).toLowerCase()]; }
export function isGraphFile(file: string): boolean { return /\.(?:[cm]?[jt]s|[jt]sx)$/i.test(file)||!!graphLanguage(file); }
type Runtime={Parser:typeof Parser;grammars:Map<string,Language>};
const runtimeKey=Symbol.for('vibe-hnindex.tree-sitter.0.27.1.grammars.2.0.4');
const runtimeCache=globalThis as unknown as Record<symbol,Promise<Runtime>|undefined>;
// Preload local assets once at module initialization, retaining the synchronous graph/store API.
// The cache also prevents duplicate WASM instances across module resets in a single process.
const runtime=await(runtimeCache[runtimeKey]??=(async()=>{
  const api=await import('web-tree-sitter');
  const assets=await import('tree-sitter-wasm');
  await api.Parser.init();
  const grammars=new Map<string,Language>();
  for(const language of POLYGLOT_LANGUAGES)grammars.set(language,await api.Language.load(assets.getWasmPath((language==='csharp'?'c_sharp':language) as Parameters<typeof assets.getWasmPath>[0])));
  return {Parser:api.Parser,grammars};
})());
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
type Syntax={type:string;start:number;end:number;line:number;endLine:number;column:number;parent:number;children:number[];fields:Record<string,number>;text:string};
type Unit={input:GraphSource;language:string;ast:Syntax[];file:GraphNode;declarations:Map<number,GraphNode>;owners:Map<number,GraphNode>;names:Set<number>;shadow:Map<string,Set<string>>;imports:Map<string,{file:string;files?:string[];name?:string}>;receivers:Map<string,{name:string;typeId:string}>;qualified:Map<string,{scope:string;start:number}>;namespace:string};
const identifiers=new Set(['identifier','name','simple_identifier','type_identifier','field_identifier','property_identifier','constant']);
const declarationKinds:Record<string,string>={function_definition:'function',function_declaration:'function',function_item:'function',method_declaration:'method',constructor_declaration:'method',method:'method',singleton_method:'method',class_definition:'class',class_declaration:'class',class_specifier:'class',struct_specifier:'class',struct_item:'class',struct_declaration:'class',interface_declaration:'interface',interface_definition:'interface',trait_item:'interface',enum_declaration:'enum',enum_specifier:'enum',enum_item:'enum',object_definition:'class',object_declaration:'class',namespace_definition:'namespace',namespace_declaration:'namespace',module:'namespace',module_definition:'namespace',mod_item:'namespace',type_alias:'type',type_alias_declaration:'type',type_spec:'type'};
const callTypes=new Set(['call','call_expression','function_call_expression','method_call_expression','member_call_expression','scoped_call_expression','method_invocation','invocation_expression','function_call','object_creation_expression','new_expression']);
const fields=['name','declarator','body','function','method','object','receiver','operand','argument','field','attribute','scope','type','arguments','parameters','path'];

function syntaxTree(source:GraphSource,language:string):{ast:Syntax[];errors:boolean} {
  const parser=new runtime.Parser();
  parser.setLanguage(runtime.grammars.get(language)!);
  const tree=parser.parse(source.content);
  if(!tree){parser.delete();throw new Error('Parser returned no tree');}
  const ast:Syntax[]=[];
  const keys=new Map<string,number>();
  const fieldKeys:Array<Record<string,string>>=[];
  const key=(n:SyntaxNode)=>`${n.startIndex}:${n.endIndex}:${n.type}`;
  function visit(n:SyntaxNode,parent:number,depth:number):number {
      if(depth>600||ast.length>=200000)throw new Error('AST node/depth budget exceeded');
      const index=ast.length,start=n.startIndex,end=n.endIndex,p=n.startPosition,q=n.endPosition;
      const line=p.row+1,endLine=q.row+1,column=p.column+1;
      const type=n.type;
      ast.push({type,start,end,line,endLine,column,parent,children:[],fields:{},text:''});
      keys.set(key(n),index);
      const wanted:Record<string,string>={};
      if(declarationKinds[type]||callTypes.has(type)||type==='class'||/import|include|attribute|member|selector|scoped|field_expression|assignment|declarator|parameter|type_spec/.test(type))
        for(const name of fields){const child=n.childForFieldName(name);if(child)wanted[name]=key(child);}
      fieldKeys[index]=wanted;
      for(let i=0;i<n.namedChildCount;i++){const child=n.namedChild(i);if(child)ast[index].children.push(visit(child,index,depth+1));}
      if(identifiers.has(type)||/string|dotted_name|qualified_name|scoped_identifier|package_clause|package_header|package_declaration|namespace_name/.test(type))ast[index].text=source.content.slice(start,end);
      return index;
  }
  try {
    const root=tree.rootNode;const errors=root.hasError;visit(root,-1,0);
    for(let i=0;i<ast.length;i++)for(const [name,k]of Object.entries(fieldKeys[i])){const index=keys.get(k);if(index!==undefined)ast[i].fields[name]=index;}
    return {ast,errors};
  }finally{tree.delete();parser.delete();}
}

export function analyzePolyglotGraph(projectName:string,inputs:GraphSource[]):CodeGraph {
  const graph:CodeGraph={nodes:[],edges:[],warnings:[]};
  const units:Unit[]=[];
  const nodeById=new Map<string,GraphNode>();
  const sourceText=(u:Unit,n:Syntax)=>u.input.content.slice(n.start,n.end);
  const add=(u:Unit,source:GraphNode,target:GraphNode|null,kind:GraphEdgeKind,n:Syntax,name:string)=>{
    graph.edges.push({id:hash(`${projectName}|${source.id}|${target?.id??name}|${kind}|${n.start}`),projectName,sourceId:source.id,targetId:target?.id??null,kind,filePath:u.input.filePath,line:n.line,column:n.column,targetName:name,resolution:target?'resolved':'unresolved'});
  };
  for(const input of inputs){
    const language=graphLanguage(input.filePath);if(!language)continue;
    try {
      const {ast,errors}=syntaxTree(input,language);
      const file:GraphNode={id:hash(`${projectName}|file|${input.filePath}`),projectName,filePath:input.filePath,name:input.filePath,kind:'file',startLine:1,endLine:input.content.split('\n').length,column:1,parentId:null,signature:'',exported:false};
      const u:Unit={input,language,ast,file,declarations:new Map(),owners:new Map(),names:new Set(),shadow:new Map(),imports:new Map(),receivers:new Map(),qualified:new Map(),namespace:''};
      graph.nodes.push(file);nodeById.set(file.id,file);units.push(u);
      if(errors)graph.warnings.push(`${input.filePath}: Tree-sitter reported syntax errors; recovered definitions/edges may be incomplete.`);
      for(let i=0;i<ast.length;i++){
        const n=ast[i],owner=u.declarations.get(n.parent)??u.owners.get(n.parent)??file;u.owners.set(i,owner);
        if(/^(?:package_clause|package_header|package_declaration)$/.test(n.type))u.namespace=sourceText(u,n).replace(/^package\s+|;$/g,'').trim();
        if(language==='php'&&n.type==='namespace_definition'&&n.fields.name!==undefined)u.namespace=sourceText(u,ast[n.fields.name]).replace(/\\/g,'.');
        let kind=declarationKinds[n.type]??(language==='ruby'&&n.type==='class'?'class':'');
        if(n.type==='function_declarator'&&['c','cpp'].includes(language)&&['declaration','field_declaration'].includes(ast[n.parent]?.type)&&n.fields.declarator!==undefined&&identifiers.has(ast[n.fields.declarator].type))kind='function';
        if(n.type==='type_spec'&&n.fields.type!==undefined){const type=ast[n.fields.type].type;if(type==='struct_type')kind='class';else if(type==='interface_type')kind='interface';}
        if(n.type==='module'&&language!=='ruby')kind='';
        if(!kind)continue;
        let nameIndex:number|undefined=n.fields.name;
        if(nameIndex===undefined)nameIndex=n.children.find(c=>identifiers.has(ast[c].type));
        if(nameIndex===undefined&&n.fields.declarator!==undefined){
          let d=n.fields.declarator;
          for(let depth=0;depth<12;depth++){if(identifiers.has(ast[d].type)){nameIndex=d;break;}const next=ast[d].fields.declarator??ast[d].fields.name??ast[d].children.find(c=>identifiers.has(ast[c].type));if(next===undefined)break;d=next;}
        }
        if(nameIndex===undefined)continue;
        const name=sourceText(u,ast[nameIndex]).trim();if(!name||name.length>300)continue;
        let qualifiedScope:string|undefined;
        if(language==='cpp'&&n.type==='function_definition'){
          let declarator=n.fields.declarator;
          for(let depth=0;declarator!==undefined&&depth<12;depth++){
            const text=sourceText(u,ast[declarator]);
            if(/qualified_identifier|scoped_identifier/.test(ast[declarator].type)&&text.includes('::')){qualifiedScope=text.slice(0,text.lastIndexOf('::')).replace(/^::/,'');break;}
            declarator=ast[declarator].fields.declarator;
          }
          if(qualifiedScope)kind='method';
        }
        const body=n.fields.body??n.children.find(c=>/^(?:function_body|block|compound_statement|body_statement|template_body|class_body)$/.test(ast[c].type));
        const header=input.content.slice(n.start,body!==undefined?ast[body].start:Math.min(n.end,n.start+1200)).trim();
        if(kind==='function'&&['class','interface'].includes(owner.kind))kind='method';
        const node:GraphNode={id:hash(`${projectName}|${input.filePath}|${n.start}|${kind}|${name}`),projectName,filePath:input.filePath,name,kind,startLine:n.line,endLine:n.endLine,column:n.column,parentId:owner.id,signature:header.slice(0,1000),exported:!name.startsWith('_')};
        u.declarations.set(i,node);u.names.add(nameIndex);u.owners.set(i,owner);graph.nodes.push(node);nodeById.set(node.id,node);add(u,owner,node,'DEFINES',n,name);
        if(qualifiedScope)u.qualified.set(node.id,{scope:qualifiedScope,start:n.start});
      }
      // Parameters and assignments shadow callables; never resolve through an arbitrary object binding.
      for(let i=0;i<ast.length;i++)if(/parameter|assignment|variable_declarator|short_var_declaration|let_declaration/.test(ast[i].type)){
        const scope=u.declarations.get(i)??u.owners.get(i)??file;
        const bindings=u.shadow.get(scope.id)??new Set<string>();
        const candidates=ast[i].children.filter(c=>identifiers.has(ast[c].type)||/variable_name|pattern/.test(ast[c].type));
        for(const c of candidates){const text=sourceText(u,ast[c]);if(/^[\w$]+$/.test(text))bindings.add(text.replace(/^\$/,''));}
        if(ast[i].type==='assignment'){const left=ast[i].children[0];if(left!==undefined&&identifiers.has(ast[left].type))bindings.add(sourceText(u,ast[left]));}
        u.shadow.set(scope.id,bindings);
      }
    }catch{graph.warnings.push(`${input.filePath}: foreign-language AST extraction failed; this file has no graph evidence.`);}
  }
  const unitByFile=new Map(units.map(u=>[u.input.filePath.replace(/\\/g,'/'),u]));
  const unique=(values:GraphNode[])=>values.length===1?values[0]:null;
  const goIndex=new Map<string,GraphNode[]>();
  const goKey=(unit:Unit,name:string,kind:string)=>`${path.posix.dirname(unit.input.filePath)}|${unit.namespace}|${kind}|${name}`;
  for(const node of graph.nodes){const unit=unitByFile.get(node.filePath);if(unit?.language==='go'&&['function','class'].includes(node.kind)){const key=goKey(unit,node.name,node.kind);const group=goIndex.get(key)??[];group.push(node);goIndex.set(key,group);}}
  const reparented=new Map<string,{type:GraphNode;start:number}>();
  const qualifiedName=(node:GraphNode)=>{const names:string[]=[];let current:GraphNode|undefined=node;while(current&&current.kind!=='file'){if(['class','namespace'].includes(current.kind))names.unshift(current.name);current=current.parentId?nodeById.get(current.parentId):undefined;}return names.join('::');};
  for(const u of units)if(u.language==='cpp')for(const [id,entry]of u.qualified){
    const node=nodeById.get(id)!;const parent=node.parentId?nodeById.get(node.parentId):undefined;
    const relative=parent?qualifiedName(parent):'';const scopes=new Set([entry.scope,[relative,entry.scope].filter(Boolean).join('::')]);
    const type=unique(graph.nodes.filter(n=>n.kind==='class'&&unitByFile.get(n.filePath)?.language==='cpp'&&scopes.has(qualifiedName(n))));
    if(type){node.parentId=type.id;reparented.set(node.id,{type,start:entry.start});}
  }
  for(const u of units)if(u.language==='go')for(const [index,node]of u.declarations){
    const receiver=u.ast[index].fields.receiver;if(receiver===undefined)continue;
    const match=sourceText(u,u.ast[receiver]).match(/^\(\s*(\w+)\s+\*?(\w+)\s*\)$/);if(!match)continue;
    const type=unique(goIndex.get(goKey(u,match[2],'class'))??[]);
    if(type){node.parentId=type.id;u.receivers.set(node.id,{name:match[1],typeId:type.id});reparented.set(node.id,{type,start:u.ast[index].start});}
  }
  for(const edge of graph.edges)if(edge.kind==='DEFINES'&&edge.targetId){const parent=reparented.get(edge.targetId);if(parent){edge.sourceId=parent.type.id;edge.id=hash(`${projectName}|${edge.sourceId}|${edge.targetId}|DEFINES|${parent.start}`);}}
  const childIndex=new Map<string,GraphNode[]>();
  for(const node of graph.nodes){const key=`${node.parentId}|${node.name}`;const list=childIndex.get(key)??[];list.push(node);childIndex.set(key,list);}
  const children=(parent:string,name:string)=>childIndex.get(`${parent}|${name}`)??[];
  const findModule=(u:Unit,module:string):Unit|null=>{
    const extensions=Object.keys(languages).filter(ext=>languages[ext]===u.language);
    const base=module.replace(/^['"<]|['">]$/g,'').replace(/\\/g,'/');
    const roots:string[]=[];
    if(u.language==='python'){
      const dots=base.match(/^\.+/)?.[0].length??0;
      const suffix=base.slice(dots).replace(/\./g,'/');
      roots.push(dots?path.posix.join(path.posix.dirname(u.input.filePath),'../'.repeat(Math.max(0,dots-1)),suffix):suffix);
      if(!dots)roots.push('src/'+suffix);
    }else roots.push(path.posix.join(path.posix.dirname(u.input.filePath),base),base);
    const matches=new Set<Unit>();
    if(['java','php','kotlin','csharp'].includes(u.language)){
      const qualified=module.replace(/[\\/]/g,'.');
      for(const candidate of units)if(candidate.language===u.language)
        for(const node of candidate.declarations.values())if(['class','interface','function'].includes(node.kind)){
          const name=[candidate.namespace,node.name].filter(Boolean).join('.');
          if(qualified===name)matches.add(candidate);
        }
    }
    if(u.language==='go'&&base.startsWith('.')){
      const directory=path.posix.normalize(path.posix.join(path.posix.dirname(u.input.filePath),base));
      const candidates=units.filter(candidate=>candidate.language==='go'&&path.posix.dirname(candidate.input.filePath)===directory);
      if(candidates.length&&new Set(candidates.map(c=>c.namespace)).size===1)return candidates.sort((a,b)=>a.input.filePath.localeCompare(b.input.filePath))[0];
    }
    for(const root of roots)for(const candidate of [root,...extensions.flatMap(ext=>[root+'.'+ext,root+'/__init__.'+ext,root+'/mod.'+ext])]){
      const normalized=path.posix.normalize(candidate);if(normalized.startsWith('../'))continue;
      const found=unitByFile.get(normalized);if(found&&(found.language===u.language||(['c','cpp'].includes(found.language)&&['c','cpp'].includes(u.language))))matches.add(found);
    }
    return matches.size===1?[...matches][0]:null;
  };
  for(const u of units)for(let i=0;i<u.ast.length;i++){
    const n=u.ast[i];if(!/import|include|use_declaration/.test(n.type))continue;
    if(u.language==='go'&&n.type==='import_declaration')continue;
    const text=sourceText(u,n);let module='',items:Array<{local:string;name?:string}>=[];
    if(u.language==='python'&&n.type==='import_from_statement'){
      const m=text.match(/^from\s+([\w.]+)\s+import\s+([\s\S]+)/);if(m){module=m[1];items=m[2].replace(/[()]/g,'').split(',').map(s=>{const parts=s.trim().split(/\s+as\s+/);return {local:parts[1]??parts[0],name:parts[0]};});}
    }else if(u.language==='python'&&n.type==='import_statement'){
      const m=text.match(/^import\s+([\w.]+)(?:\s+as\s+(\w+))?$/);if(m){module=m[1];items=[{local:m[2]??module.split('.')[0]}];}
    }else if(/^(?:preproc_include|import_spec|import_declaration|import_header|use_declaration|namespace_use_declaration)$/.test(n.type)){
      const alias=text.match(/\s+as\s+(\w+)\s*;?$/)?.[1];
      const literal=text.match(/["']([^"']+)["']/);module=literal?.[1]??text.replace(/^(?:import\s+(?:static\s+)?|use\s+(?:function\s+|const\s+)?)/,'').replace(/\s+as\s+\w+\s*;?$/,'').replace(/;$/,'').trim();
      const goAlias=u.language==='go'?text.match(/^(\w+)\s+["']/)?.[1]:undefined;
      items=[{local:alias??goAlias??module.split(/[./\\:]/).filter(Boolean).at(-1)??module}];
    }
    if(!module)continue;const target=findModule(u,module);add(u,u.file,target?.file??null,'IMPORTS',n,module);
    if(target)for(const item of items)if(/^[\w$]+$/.test(item.local)&&item.local!=='_'){
      let name=item.name;
      if(!name&&['java','php','kotlin','csharp'].includes(u.language)){
        const qualified=module.replace(/[\\/]/g,'.');
        const declarations=[...target.declarations.values()].filter(node=>[target.namespace,node.name].filter(Boolean).join('.')===qualified);
        if(declarations.length===1)name=declarations[0].name;
      }
      const files=u.language==='go'?units.filter(c=>c.language==='go'&&c.namespace===target.namespace&&path.posix.dirname(c.input.filePath)===path.posix.dirname(target.input.filePath)).map(c=>c.input.filePath):undefined;
      u.imports.set(item.local,{file:target.input.filePath,files,name});
      if(files)for(const file of files)if(file!==target.input.filePath)add(u,u.file,unitByFile.get(file)!.file,'IMPORTS',n,module);
    }
  }
  function lexical(u:Unit,owner:GraphNode,name:string):GraphNode|null {
    let scope:GraphNode|undefined=owner;
    while(scope){
      const skipClass=['python','php'].includes(u.language)&&['class','interface'].includes(scope.kind);
      const matches=skipClass?[]:children(scope.id,name).filter(n=>n.kind!=='method'||scope!.kind!=='file'||u.language==='ruby');
      if(matches.length)return unique(matches);
      if(u.shadow.get(scope.id)?.has(name))return null;
      scope=scope.parentId?nodeById.get(scope.parentId):undefined;
    }
    const imported=u.imports.get(name);
    if(imported){const target=unitByFile.get(imported.file);if(target)return imported.name?unique(children(target.file.id,imported.name)):target.file;}
    if(['c','cpp'].includes(u.language)){
      const declarations=[...u.imports.values()].flatMap(binding=>children(unitByFile.get(binding.file)!.file.id,name));
      return unique([...new Map(declarations.map(n=>[n.id,n])).values()]);
    }
    if(u.language==='go')return unique(goIndex.get(goKey(u,name,'function'))??[]);
    return null;
  }
  function member(u:Unit,owner:GraphNode,receiver:string,name:string):GraphNode|null {
    const declaredReceiver=u.receivers.get(owner.id);
    if(declaredReceiver?.name===receiver)return unique(children(declaredReceiver.typeId,name));
    const imported=u.imports.get(receiver);
    if(imported?.files&&!imported.name&&lexical(u,owner,receiver)?.id===unitByFile.get(imported.file)?.file.id)return unique(imported.files.flatMap(file=>children(unitByFile.get(file)!.file.id,name)));
    if(['self','this','$this','cls','Self'].includes(receiver)){
      let parent:GraphNode|undefined=owner;while(parent&&!['class','interface'].includes(parent.kind))parent=parent.parentId?nodeById.get(parent.parentId):undefined;
      return parent?unique(children(parent.id,name)):null;
    }
    const binding=lexical(u,owner,receiver);
    return binding&&['file','class','namespace','interface'].includes(binding.kind)?unique(children(binding.id,name)):null;
  }
  for(const u of units)for(let i=0;i<u.ast.length;i++){
    const n=u.ast[i],owner=u.owners.get(i)??u.file;
    if(callTypes.has(n.type)){
      const callee=n.fields.function??n.fields.method??n.fields.name??n.children[0];if(callee===undefined)continue;
      const expression=u.ast[callee];let name=sourceText(u,expression),target:GraphNode|null=null,location=expression;
      const object=n.fields.object??n.fields.receiver??n.fields.scope??expression.fields.object??expression.fields.receiver??expression.fields.operand??expression.fields.argument??expression.fields.scope;
      const selected=expression.fields.attribute??expression.fields.field??expression.fields.name;
      if(object!==undefined||selected!==undefined){
        const nameIndex=selected??callee;name=sourceText(u,u.ast[nameIndex]);location=u.ast[nameIndex];
        const receiver=object!==undefined?sourceText(u,u.ast[object]):'';target=member(u,owner,receiver,name);
      }else if(identifiers.has(expression.type))target=lexical(u,owner,name);
      else {
        const simple=name.match(/^([\w$]+)(?:\.|::|->)([\w$]+)$/);
        if(simple){name=simple[2];target=member(u,owner,simple[1],name);}
      }
      if(target&&['file','namespace','interface','type'].includes(target.kind))target=null;
      add(u,owner,target,'CALLS',location,name);
      if(target)add(u,owner,target,'REFERENCES',location,name);
    }else if(identifiers.has(n.type)&&!u.names.has(i)){
      const parent=u.ast[n.parent];if(parent&&callTypes.has(parent.type))continue;
      if(parent&&/attribute|selector|field_expression|member|scoped_identifier/.test(parent.type)&&[parent.fields.attribute,parent.fields.field,parent.fields.name].includes(i))continue;
      const target=lexical(u,owner,n.text);if(target)add(u,owner,target,'REFERENCES',n,n.text);
    }
  }
  graph.edges=[...new Map(graph.edges.map(e=>[e.id,e])).values()];
  return graph;
}
