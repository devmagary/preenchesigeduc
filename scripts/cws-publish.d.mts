export function hasCwsCredentials(env?: Record<string, string | undefined>): boolean;

export function publishToChromeWebStore(options?: {
  zipPath?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<{ skipped: boolean; reason?: string; upload?: unknown; publish?: unknown }>;
