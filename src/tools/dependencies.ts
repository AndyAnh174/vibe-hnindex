import { getProject, getDependencies, getDependents, getAllProjectFiles } from '../services/sqlite.js';

export async function getDependenciesTool(args: {
  project_name: string;
  file_path: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{ type: 'text', text: `Error: Project "${args.project_name}" not found. Run index_codebase first.` }],
    };
  }

  const deps = getDependencies(args.project_name, args.file_path);

  if (deps.length === 0) {
    return {
      content: [{ type: 'text', text: `No dependencies found for "${args.file_path}" in project "${args.project_name}".` }],
    };
  }

  const lines = deps.map(d => {
    const specs = d.importSpecifiers ? ` → { ${d.importSpecifiers.join(', ')} }` : '';
    const typeTag = d.importType !== 'static' ? ` [${d.importType}]` : '';
    return `- ${d.targetFile}${specs}${typeTag}`;
  });

  const text = [
    `## Dependencies of: ${args.file_path}`,
    `**Total imports:** ${deps.length}`,
    '',
    ...lines,
  ].join('\n');

  return { content: [{ type: 'text', text }] };
}

export async function getDependentsTool(args: {
  project_name: string;
  file_path: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{ type: 'text', text: `Error: Project "${args.project_name}" not found. Run index_codebase first.` }],
    };
  }

  const dependents = getDependents(args.project_name, args.file_path);

  if (dependents.length === 0) {
    return {
      content: [{ type: 'text', text: `No files depend on "${args.file_path}" in project "${args.project_name}".` }],
    };
  }

  const lines = dependents.map(d => {
    const specs = d.importSpecifiers ? ` → { ${d.importSpecifiers.join(', ')} }` : '';
    return `- ${d.sourceFile}${specs}`;
  });

  const text = [
    `## Files that depend on: ${args.file_path}`,
    `**Total dependents:** ${dependents.length}`,
    '',
    ...lines,
  ].join('\n');

  return { content: [{ type: 'text', text }] };
}

export async function impactAnalysisTool(args: {
  project_name: string;
  file_path: string;
  depth?: number;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{ type: 'text', text: `Error: Project "${args.project_name}" not found. Run index_codebase first.` }],
    };
  }

  const maxDepth = Math.min(args.depth ?? 3, 5);
  const visited = new Set<string>();
  const tree: string[] = [];

  // BFS
  interface QueueItem { file: string; depth: number; prefix: string }
  const queue: QueueItem[] = [{ file: args.file_path, depth: 0, prefix: '' }];
  visited.add(args.file_path);
  let totalImpacted = 0;

  tree.push(args.file_path);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    const dependents = getDependents(args.project_name, current.file);
    const newDeps = dependents.filter(d => !visited.has(d.sourceFile));

    for (let i = 0; i < newDeps.length; i++) {
      const dep = newDeps[i];
      visited.add(dep.sourceFile);
      totalImpacted++;

      const isLast = i === newDeps.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = current.prefix + (isLast ? '    ' : '│   ');

      const depthTag = current.depth === 0 ? '(direct)' : `(depth ${current.depth + 1})`;
      tree.push(`${current.prefix}${connector}${dep.sourceFile} ${depthTag}`);

      queue.push({ file: dep.sourceFile, depth: current.depth + 1, prefix: childPrefix });
    }
  }

  const directCount = getDependents(args.project_name, args.file_path).length;

  const text = [
    `## Impact Analysis: ${args.file_path}`,
    `**Direct dependents:** ${directCount} files`,
    `**Transitive impact:** ${totalImpacted} files (max depth ${maxDepth})`,
    '',
    '### Dependency Tree',
    '```',
    ...tree,
    '```',
  ].join('\n');

  return { content: [{ type: 'text', text }] };
}
