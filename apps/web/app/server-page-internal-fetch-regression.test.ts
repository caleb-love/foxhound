import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function walk(dir: string): string[] {
  const entries = readdirSync(dir).sort();
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry === 'page.tsx') {
      files.push(fullPath);
    }
  }

  return files;
}

describe('server page internal fetch regression guard', () => {
  const appRoot = resolve(__dirname);
  const pageFiles = walk(appRoot);

  it('finds page.tsx files to audit', () => {
    expect(pageFiles.length).toBeGreaterThan(0);
  });

  for (const file of pageFiles) {
    const relativePath = file.slice(appRoot.length + 1);

    it(`${relativePath} avoids relative or hardcoded localhost internal API fetches`, () => {
      const source = readFileSync(file, 'utf8');

      expect(source).not.toContain("fetch('/api/");
      expect(source).not.toContain('fetch(`/api/');
      expect(source).not.toContain('http://localhost:3001/api/');
    });
  }
});
