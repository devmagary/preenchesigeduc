(() => {
  const FLAG = '__preencheSigeducBridgeInstalled';
  if ((window as unknown as Record<string, unknown>)[FLAG]) return;
  (window as unknown as Record<string, unknown>)[FLAG] = true;

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origConfirm = window.confirm.bind(window);

  const metaMap = new WeakMap<XMLHttpRequest, { id: number; method: string; url: string }>();
  let nextXhrId = 1;
  let armedConfirmUntil = 0;

  window.addEventListener('preenche-sigeduc:arm-confirm', (ev: Event) => {
    const custom = ev as CustomEvent<{ ttlMs?: number }>;
    const ttl = Math.min(Math.max(custom.detail?.ttlMs ?? 5000, 500), 15000);
    armedConfirmUntil = Date.now() + ttl;
  });

  window.addEventListener('preenche-sigeduc:disarm-confirm', () => {
    armedConfirmUntil = 0;
  });

  window.confirm = function patchedConfirm(message?: string): boolean {
    if (Date.now() <= armedConfirmUntil) {
      armedConfirmUntil = 0;
      window.dispatchEvent(
        new CustomEvent('preenche-sigeduc:confirm-autoaccepted', {
          detail: { message: message ?? '' },
        })
      );
      return true;
    }
    return origConfirm(message);
  };

  XMLHttpRequest.prototype.open = function patchedOpen(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ): void {
    metaMap.set(this, {
      id: nextXhrId++,
      method: String(method || 'GET').toUpperCase(),
      url: String(url),
    });
    return origOpen.apply(this, [method, url, async ?? true, username ?? null, password ?? null] as Parameters<typeof origOpen>);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null): void {
    const meta = metaMap.get(this) ?? { id: nextXhrId++, method: 'GET', url: '' };
    const startedAt = Date.now();
    window.dispatchEvent(
      new CustomEvent('preenche-sigeduc:xhr-start', {
        detail: { id: meta.id, url: meta.url, method: meta.method, startedAt },
      })
    );
    this.addEventListener('loadend', () => {
      window.dispatchEvent(
        new CustomEvent('preenche-sigeduc:xhr-end', {
          detail: {
            id: meta.id,
            url: meta.url,
            method: meta.method,
            status: this.status,
            startedAt,
          },
        })
      );
    });
    return origSend.call(this, body);
  };
})();
