export async function fetchWithRetry(
  fetchImpl,
  url,
  options = {},
  { maxRetries = 3, baseDelayMs = 500 } = {}
) {
  let attempt = 0;
  while (true) {
    const res = await fetchImpl(url, options);
    const shouldRetry = res.status === 429 || (res.status >= 500 && res.status <= 599);
    if (!shouldRetry || attempt >= maxRetries) {
      return res;
    }
    const retryAfter = Number(res.headers?.get?.('retry-after'));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 15000)
        : baseDelayMs * 2 ** attempt;
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    attempt++;
  }
}

export async function sleepMs(ms) {
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
