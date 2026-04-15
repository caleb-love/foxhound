import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  collectSandboxCanonicalViolations,
  shouldIgnorePath,
} from './check-sandbox-canonical-lib.mjs';

describe('check-sandbox-canonical-lib', () => {
  it('ignores known compatibility and bridge paths', () => {
    const rootDir = '/repo';
    expect(shouldIgnorePath(rootDir, '/repo/components/demo/dashboard-primitives.tsx')).toBe(true);
    expect(shouldIgnorePath(rootDir, '/repo/components/sandbox/primitives.tsx')).toBe(true);
    expect(shouldIgnorePath(rootDir, '/repo/components/layout/sidebar.tsx')).toBe(false);
  });

  it('reports active-surface hardcoded /demo route literals', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'sandbox-canonical-'));
    const sandboxDir = join(rootDir, 'app', 'sandbox');
    mkdirSync(sandboxDir, { recursive: true });
    writeFileSync(join(sandboxDir, 'page.tsx'), "export const href = '/demo/traces';\n");

    const violations = collectSandboxCanonicalViolations({
      rootDir,
      includeRoots: [sandboxDir],
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("app/sandbox/page.tsx:1");
  });

  it('ignores test files but reports active runtime /demo literals', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'sandbox-canonical-'));
    const componentsDir = join(rootDir, 'components', 'diff');
    mkdirSync(componentsDir, { recursive: true });

    writeFileSync(join(componentsDir, 'run-diff-view.tsx'), "const sample = '/demo/traces';\n");
    writeFileSync(join(componentsDir, 'run-diff-view.test.tsx'), "const sample = '/demo/traces';\n");

    const violations = collectSandboxCanonicalViolations({
      rootDir,
      includeRoots: [join(rootDir, 'components')],
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('components/diff/run-diff-view.tsx:1');
  });
});
