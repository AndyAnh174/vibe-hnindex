import { getProject } from '../services/sqlite.js';
import { getGitHead } from '../services/git.js';
import { getOrBuildBriefingMarkdown } from './project-briefing.js';
import { formatProjectStatsSection } from './project-stats.js';
import { formatRecentChangesSection } from './recent-changes.js';

const DEFAULT_MAX_CHARS = 10_000;

export async function onboardingPromptTool(args: {
  project_name: string;
  max_chars?: number;
  include_recent?: boolean;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: Project "${args.project_name}" not found. Run index_codebase first.`,
        },
      ],
    };
  }

  const maxChars = args.max_chars ?? DEFAULT_MAX_CHARS;
  const includeRecent = args.include_recent ?? true;

  const { markdown: briefing } = getOrBuildBriefingMarkdown(args.project_name, false);
  const statsPart = formatProjectStatsSection(args.project_name) ?? '';
  let recentPart = '';
  if (includeRecent) {
    recentPart = (await formatRecentChangesSection(args.project_name, 7, 10)) ?? '';
  }

  const parts: string[] = [
    `# Onboarding: ${args.project_name}`,
    '',
  ];

  const currentHead = await getGitHead(project.rootPath);
  const indexedHead = project.indexedGitHead;
  if (
    currentHead &&
    indexedHead &&
    currentHead !== indexedHead
  ) {
    parts.push('## Index freshness');
    parts.push('');
    parts.push(
      `The index was built at git commit \`${indexedHead.slice(0, 7)}\`, but the repository HEAD is now \`${currentHead.slice(0, 7)}\`. Run \`index_codebase\` again after pulling or merging so search matches the current tree.`,
    );
    parts.push('');
  }

  parts.push(briefing);
  parts.push('');
  parts.push('## Stack & stats');
  parts.push(statsPart);

  if (includeRecent && recentPart) {
    parts.push('');
    parts.push(recentPart);
  }

  let text = parts.filter(p => p !== undefined).join('\n');
  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + '\n\n… (truncated)';
  }

  return { content: [{ type: 'text', text }] };
}
