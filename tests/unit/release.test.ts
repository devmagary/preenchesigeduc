import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeNextVersion } from '../../scripts/release.mjs';

const rootDir = path.resolve(__dirname, '../..');

describe('release script & manifest version sync', () => {
  it('calcula corretamente versões patch, minor, major e explícitas', () => {
    expect(computeNextVersion('1.0.0', 'patch')).toBe('1.0.1');
    expect(computeNextVersion('1.0.0', 'minor')).toBe('1.1.0');
    expect(computeNextVersion('1.0.0', 'major')).toBe('2.0.0');
    expect(computeNextVersion('1.0.0', 'v1.2.3')).toBe('1.2.3');
    expect(computeNextVersion('1.0.0', '2.5.0')).toBe('2.5.0');
    expect(() => computeNextVersion('1.0.0', 'invalida')).toThrow(/Especificação de versão inválida/);
  });

  it('mantém manifest.json de dist/chrome e dist/firefox sincronizados com package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    for (const target of ['chrome', 'firefox']) {
      const mPath = path.join(rootDir, 'dist', target, 'manifest.json');
      if (fs.existsSync(mPath)) {
        const manifest = JSON.parse(fs.readFileSync(mPath, 'utf8'));
        expect(manifest.version).toBe(pkg.version);
      }
    }
  });
});
