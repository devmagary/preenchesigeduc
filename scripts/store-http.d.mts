export function fetchWithRetry(
  fetchImpl: typeof fetch,
  url: string,
  options?: RequestInit,
  retryOptions?: { maxRetries?: number; baseDelayMs?: number }
): Promise<Response>;

export function sleepMs(ms: number): Promise<void>;
