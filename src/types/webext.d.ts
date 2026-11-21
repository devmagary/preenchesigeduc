export {};

declare global {
  interface Window {
    A4J?: {
      AJAX?: {
        Submit?: (...args: unknown[]) => unknown;
      };
    };
    confirmacaoSenhaDialog?: {
      show?: () => void;
      hide?: () => void;
    };
  }

  const chrome: {
    runtime: {
      id: string;
      getURL(path: string): string;
      onMessage: {
        addListener(
          callback: (
            message: unknown,
            sender: unknown,
            sendResponse: (response?: unknown) => void
          ) => boolean | void
        ): void;
      };
      sendMessage(message: unknown): Promise<unknown>;
    };
    tabs: {
      query(queryInfo: { active?: boolean; currentWindow?: boolean }): Promise<Array<{ id?: number; url?: string }>>;
      sendMessage(tabId: number, message: unknown): Promise<unknown>;
      create(createProperties: { url: string }): Promise<unknown>;
    };
  };

  const browser: typeof chrome | undefined;
}
