/** Default MCP server label in JSON */
export const DEFAULT_SERVER_NAME = 'vibe-hnindex';

/** npx-based server block (matches docs) */
export function defaultServerBlock(env: Record<string, string>) {
  return {
    command: 'npx',
    args: ['-y', 'vibe-hnindex'],
    env,
  };
}

export function defaultEnv(options: {
  ollamaUrl: string;
  ollamaModel: string;
  qdrantUrl: string;
  qdrantApiKey?: string;
}): Record<string, string> {
  const env: Record<string, string> = {
    OLLAMA_URL: options.ollamaUrl,
    OLLAMA_MODEL: options.ollamaModel,
    QDRANT_URL: options.qdrantUrl,
  };
  if (options.qdrantApiKey) {
    env.QDRANT_API_KEY = options.qdrantApiKey;
  }
  return env;
}
