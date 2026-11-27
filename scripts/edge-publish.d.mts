export function hasEdgeCredentials(env?: Record<string, string | undefined>): boolean;

export function publishToEdgeAddons(options?: {
  zipPath?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  maxPolls?: number;
  retryOptions?: { maxRetries?: number; baseDelayMs?: number };
  notes?: string;
}): Promise<{
  skipped: boolean;
  reason?: string;
  operationId?: string;
  uploadStatus?: unknown;
  publishOperation?: string;
}>;
