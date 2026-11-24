import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCrx3Buffer,
  deriveCrxIdAndExtensionId,
  loadOrCreateCrxPrivateKey,
  verifyCrx3Buffer,
} from '../../scripts/crx3.mjs';

describe('crx3 packaging & signing', () => {
  it('gera CRX3 válido com header Cr24 v3, ID estável [a-p]{32} e assinatura RSA-SHA256 verificável', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preenche-crx3-test-'));
    const keyPath = path.join(tmpDir, 'test-ext.pem');

    const first = loadOrCreateCrxPrivateKey({ keyPath, pemEnv: '' });
    expect(first.created).toBe(true);
    expect(fs.existsSync(keyPath)).toBe(true);

    const second = loadOrCreateCrxPrivateKey({ keyPath, pemEnv: '' });
    expect(second.created).toBe(false);

    const sampleZip = Buffer.from('PK\x03\x04dummy-zip-payload-for-crx3-signing', 'binary');
    const built1 = buildCrx3Buffer(sampleZip, first.privateKey);
    const built2 = buildCrx3Buffer(sampleZip, second.privateKey);

    expect(built1.extensionId).toMatch(/^[a-p]{32}$/);
    expect(built2.extensionId).toBe(built1.extensionId);
    expect(built1.crxBuffer.subarray(0, 4).toString('ascii')).toBe('Cr24');
    expect(built1.crxBuffer.readUInt32LE(4)).toBe(3);

    const verified = verifyCrx3Buffer(built1.crxBuffer);
    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.extensionId).toBe(built1.extensionId);
      expect(verified.zipBuffer.equals(sampleZip)).toBe(true);
    }

    // Adulteração de 1 byte deve falhar na verificação RSA-SHA256
    const tampered = Buffer.from(built1.crxBuffer);
    tampered[tampered.length - 1] ^= 0xff;
    const failed = verifyCrx3Buffer(tampered);
    expect(failed.valid).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('suporta chave PEM via variável de ambiente CRX_PRIVATE_KEY_PEM', () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const loaded = loadOrCreateCrxPrivateKey({ pemEnv: privateKey.replace(/\n/g, '\\n') });
    expect(loaded.source).toBe('env:CRX_PRIVATE_KEY_PEM');
    const pubDer = crypto.createPublicKey(loaded.privateKey).export({ type: 'spki', format: 'der' });
    const { extensionId } = deriveCrxIdAndExtensionId(pubDer);
    expect(extensionId).toMatch(/^[a-p]{32}$/);
  });
});
