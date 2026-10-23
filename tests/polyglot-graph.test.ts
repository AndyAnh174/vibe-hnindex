import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { analyzeCodeGraph } from '../src/services/code-graph.js';

export const polyglotFixtures = [
  { filePath:'demo.py', content:'def target():\n    return 1\ndef caller():\n    return target()\n', line:4 },
  { filePath:'demo.php', content:'<?php\nfunction target() { return 1; }\nfunction caller() { return target(); }\n', line:3 },
  { filePath:'demo.go', content:'package demo\nfunc target() int { return 1 }\nfunc caller() int { return target() }\n', line:3 },
  { filePath:'Demo.java', content:'class Demo {\n static int target() { return 1; }\n static int caller() { return target(); }\n}\n', line:3 },
  { filePath:'demo.c', content:'int target() { return 1; }\nint caller() { return target(); }\n', line:2 },
  { filePath:'demo.cpp', content:'int target() { return 1; }\nint caller() { return target(); }\n', line:2 },
  { filePath:'Demo.cs', content:'class Demo {\n static int target() { return 1; }\n static int caller() { return target(); }\n}\n', line:3 },
  { filePath:'demo.rs', content:'fn target() -> i32 { 1 }\nfn caller() -> i32 { target() }\n', line:2 },
  { filePath:'demo.rb', content:'def target\n  1\nend\ndef caller\n  target()\nend\n', line:5 },
  { filePath:'demo.kt', content:'fun target(): Int = 1\nfun caller(): Int = target()\n', line:2 },
  { filePath:'demo.swift', content:'func target() -> Int { return 1 }\nfunc caller() -> Int { return target() }\n', line:2 },
  { filePath:'demo.scala', content:'object Demo {\n def target(): Int = 1\n def caller(): Int = target()\n}\n', line:3 },
  { filePath:'demo.lua', content:'function target() return 1 end\nfunction caller() return target() end\n', line:2 },
];
const root=path.resolve('polyglot-fixture');
describe('multilingual AST code graph',()=>{
  it.each(polyglotFixtures)('indexes actual definitions and calls in $filePath',fixture=>{
    const graph=analyzeCodeGraph('poly',root,[fixture]);
    const target=graph.nodes.find(n=>n.name==='target'&&n.kind!=='file');
    const caller=graph.nodes.find(n=>n.name==='caller'&&n.kind!=='file');
    expect(target,fixture.filePath).toBeDefined();expect(caller).toBeDefined();
    expect(graph.edges).toContainEqual(expect.objectContaining({kind:'CALLS',sourceId:caller!.id,targetId:target!.id,filePath:fixture.filePath,line:fixture.line,resolution:'resolved'}));
    expect(graph.edges).toContainEqual(expect.objectContaining({kind:'DEFINES',targetId:target!.id}));
    expect(graph.edges).toContainEqual(expect.objectContaining({kind:'REFERENCES',targetId:target!.id,line:fixture.line}));
  });
  it('uses Python import aliases rather than guessing across unrelated same-name functions',()=>{
    const graph=analyzeCodeGraph('poly',root,[
      {filePath:'util.py',content:'def target():\n return 1\n'},
      {filePath:'other.py',content:'def target():\n return 2\n'},
      {filePath:'main.py',content:'from util import target as chosen\ndef caller():\n return chosen()\n'},
    ]);
    const target=graph.nodes.find(n=>n.filePath==='util.py'&&n.name==='target')!;
    expect(graph.edges).toContainEqual(expect.objectContaining({kind:'CALLS',filePath:'main.py',line:3,targetId:target?.id,resolution:'resolved'}));
    expect(graph.edges).toContainEqual(expect.objectContaining({kind:'IMPORTS',filePath:'main.py',resolution:'resolved'}));
  });
  it('leaves arbitrary receiver calls and external functions unresolved',()=>{
    const graph=analyzeCodeGraph('poly',root,[{filePath:'demo.py',content:'class Service:\n def target(self): pass\ndef caller(unknown):\n unknown.target()\n external()\n'}]);
    const calls=graph.edges.filter(e=>e.kind==='CALLS');
    expect(calls).toHaveLength(2);expect(calls.every(e=>e.resolution==='unresolved'&&e.targetId===null)).toBe(true);
  });
  it('does not mislabel an unknown object member as a reference to a global function',()=>{
    const graph=analyzeCodeGraph('poly',root,[{filePath:'demo.py',content:'def target(): return 1\ndef caller(obj):\n return obj.target()\n'}]);
    const target=graph.nodes.find(n=>n.name==='target')!;
    expect(graph.edges.filter(e=>e.kind==='CALLS')[0].targetId).toBeNull();
    expect(graph.edges.some(e=>e.kind==='REFERENCES'&&e.line===3&&e.targetId===target.id)).toBe(false);
  });
  it('does not turn a module binding into a resolved callable',()=>{
    const graph=analyzeCodeGraph('poly',root,[{filePath:'util.py',content:'def helper(): return 1\n'},{filePath:'main.py',content:'import util\ndef caller(): return util()\n'}]);
    expect(graph.edges.find(e=>e.kind==='CALLS'&&e.filePath==='main.py')?.resolution).toBe('unresolved');
  });
  it('does not treat comments or strings as definitions/calls',()=>{
    const graph=analyzeCodeGraph('poly',root,[{filePath:'demo.py',content:'# def fake():\ntext = "fake()"\ndef actual():\n return 1\n'}]);
    expect(graph.nodes.some(n=>n.name==='actual')).toBe(true);
    expect(graph.nodes.some(n=>n.name==='fake')).toBe(false);
    expect(graph.edges.some(e=>e.kind==='CALLS')).toBe(false);
  });
  it.each([
    {filePath:'demo.py',content:'class Service:\n def target(self): return 1\n def caller(self): return self.target()\n',line:3},
    {filePath:'demo.php',content:'<?php\nclass Service { function target() { return 1; }\nfunction caller() { return $this->target(); } }',line:3},
    {filePath:'Demo.java',content:'class Service { int target() { return 1; }\nint caller() { return this.target(); } }',line:2},
    {filePath:'demo.cpp',content:'class Service { int target() { return 1; }\nint caller() { return this->target(); } };',line:2},
    {filePath:'demo.rb',content:'class Service\n def target\n  1\n end\n def caller\n  self.target()\n end\nend',line:6},
    {filePath:'demo.go',content:'package demo\ntype Service struct {}\nfunc (s *Service) target() int { return 1 }\nfunc (s *Service) caller() int { return s.target() }',line:4},
  ])('resolves explicit self receivers in $filePath',fixture=>{
    const graph=analyzeCodeGraph('poly',root,[fixture]);
    const target=graph.nodes.find(n=>n.name==='target')!;
    const caller=graph.nodes.find(n=>n.name==='caller')!;
    expect(target).toBeDefined();expect(caller).toBeDefined();
    expect(graph.edges).toContainEqual(expect.objectContaining({kind:'CALLS',sourceId:caller.id,targetId:target.id,line:fixture.line,resolution:'resolved'}));
  });
  it('resolves Go package functions across files in the same package/directory',()=>{
    const graph=analyzeCodeGraph('poly',root,[{filePath:'util.go',content:'package demo\nfunc target() int { return 1 }'},{filePath:'main.go',content:'package demo\nfunc caller() int { return target() }'}]);
    const target=graph.nodes.find(n=>n.filePath==='util.go'&&n.name==='target')!;
    expect(target).toBeDefined();
    expect(graph.edges).toContainEqual(expect.objectContaining({kind:'CALLS',filePath:'main.go',targetId:target.id,resolution:'resolved'}));
  });
  it.each([
    {language:'Java',sources:[{filePath:'util/Tools.java',content:'package util; public class Tools { public static int target() { return 1; } }'},{filePath:'App.java',content:'import util.Tools; class App { int caller() { return Tools.target(); } }'}],caller:'App.java',target:'util/Tools.java'},
    {language:'PHP',sources:[{filePath:'Tools.php',content:'<?php namespace App; class Tools { static function target() { return 1; } }'},{filePath:'Service.php',content:'<?php namespace App; use App\\Tools as T; function caller() { return T::target(); }'}],caller:'Service.php',target:'Tools.php'},
    {language:'Go',sources:[{filePath:'util/helpers.go',content:'package util\nfunc Target() int { return 1 }'},{filePath:'util/extra.go',content:'package util\nfunc Extra() int { return 2 }'},{filePath:'main.go',content:'package main\nimport u "./util"\nfunc caller() int { return u.Target() }'}],caller:'main.go',target:'util/helpers.go'},
  ])('resolves explicit local module/class imports in $language',fixture=>{
    const graph=analyzeCodeGraph('poly',root,fixture.sources);
    const target=graph.nodes.find(n=>n.filePath===fixture.target&&n.name.toLowerCase()==='target')!;
    expect(target).toBeDefined();
    expect(graph.edges).toContainEqual(expect.objectContaining({kind:'IMPORTS',filePath:fixture.caller,resolution:'resolved'}));
    expect(graph.edges).toContainEqual(expect.objectContaining({kind:'CALLS',filePath:fixture.caller,targetId:target.id,resolution:'resolved'}));
  });
  it('does not resolve Python bare calls through a class or through a shadowing parameter',()=>{
    const graph=analyzeCodeGraph('poly',root,[{filePath:'demo.py',content:'def global_target(): return 1\nclass Service:\n def target(self): return 1\n def caller(self, global_target):\n  target()\n  global_target()\n'}]);
    const calls=graph.edges.filter(e=>e.kind==='CALLS');expect(calls).toHaveLength(2);expect(calls.every(e=>e.targetId===null)).toBe(true);
  });
  it('indexes C++ out-of-class method implementations with their declared class',()=>{
    const graph=analyzeCodeGraph('poly',root,[{filePath:'service.cpp',content:'class Service { public: int target(); };\nint Service::target() { return 1; }\n'}]);
    const service=graph.nodes.find(n=>n.kind==='class'&&n.name==='Service')!;
    expect(service).toBeDefined();
    expect(graph.nodes).toContainEqual(expect.objectContaining({name:'target',kind:'method',startLine:2,parentId:service.id}));
  });
  it('connects a C call to a prototype in an explicitly included local header',()=>{
    const graph=analyzeCodeGraph('poly',root,[{filePath:'api.h',content:'int target(void);\n'},{filePath:'main.c',content:'#include "api.h"\nint caller(void) { return target(); }\n'}]);
    const target=graph.nodes.find(n=>n.filePath==='api.h'&&n.name==='target')!;
    expect(target).toBeDefined();
    expect(graph.edges).toContainEqual(expect.objectContaining({kind:'CALLS',filePath:'main.c',targetId:target.id,resolution:'resolved'}));
  });
  it('reports parser recovery warnings instead of promising a complete graph',()=>{
    const graph=analyzeCodeGraph('poly',root,[{filePath:'broken.py',content:'def target(:\n return 1\n'}]);
    expect(graph.warnings.some(w=>w.includes('broken.py')&&w.includes('syntax'))).toBe(true);
  });
  it('parses a realistic-size Unicode Python module without poisoning later parsers',()=>{
    const functions=Array.from({length:700},(_,i)=>`def helper_${i}():\n    \"\"\"Hàm kiểm tra dữ liệu tiếng Việt cho module thực tế.\"\"\"\n    return ${i}\n`).join('\n');
    const content=functions+'\ndef target():\n return 1\ndef caller():\n return target()\n';
    expect(Buffer.byteLength(content)).toBeGreaterThan(64000);
    const graph=analyzeCodeGraph('poly',root,[{filePath:'large.py',content},{filePath:'small.py',content:'def after_large():\n return 1\n'}]);
    expect(graph.warnings).toEqual([]);
    expect(graph.nodes.some(n=>n.name==='caller')).toBe(true);
    expect(graph.nodes.some(n=>n.name==='after_large')).toBe(true);
    expect(graph.edges).toContainEqual(expect.objectContaining({kind:'CALLS',filePath:'large.py',targetName:'target',resolution:'resolved'}));
  });
  it('keeps JS/TS compiler resolution independent from foreign-language names',()=>{
    const graph=analyzeCodeGraph('poly',root,[
      {filePath:'demo.ts',content:'export function target() { return 1; }\nexport function caller() { return target(); }'},
      {filePath:'demo.py',content:'def target():\n return 2\ndef caller():\n return target()\n'},
    ]);
    for(const file of ['demo.ts','demo.py']){
      const target=graph.nodes.find(n=>n.filePath===file&&n.name==='target')!;
      expect(graph.edges).toContainEqual(expect.objectContaining({kind:'CALLS',filePath:file,targetId:target?.id,resolution:'resolved'}));
    }
  });
});
