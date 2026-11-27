export function hasAmoCredentials(env?: Record<string, string | undefined>): boolean;

export function createAmoJwt(options: {
  issuer: string;
  secret: string;
  nowSec?: number;
}): string;

export function publishToFirefoxAmo(options?: {
  zipPath?: string;
  manifestPath?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  maxPolls?: number;
  retryOptions?: { maxRetries?: number; baseDelayMs?: number };
  channel?: string;
}): Promise<{
  skipped: boolean;
  reason?: string;
  addonId?: string;
  uuid?: string;
  version?: unknown;
}>;
