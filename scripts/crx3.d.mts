import type { KeyObject } from 'node:crypto';

export function deriveCrxIdAndExtensionId(publicKeyDer: Buffer): {
  crxId: Buffer;
  extensionId: string;
};

export function loadOrCreateCrxPrivateKey(options?: {
  keyPath?: string;
  pemEnv?: string;
}): {
  privateKey: KeyObject;
  source: string;
  created: boolean;
};

export function buildCrx3Buffer(
  zipBuffer: Buffer,
  privateKeyInput: KeyObject | string | Buffer
): {
  crxBuffer: Buffer;
  extensionId: string;
  headerSize: number;
};

export function verifyCrx3Buffer(crxBuffer: Buffer):
  | {
      valid: true;
      version: number;
      headerSize: number;
      extensionId: string;
      zipBuffer: Buffer;
    }
  | {
      valid: false;
      reason: string;
    };
