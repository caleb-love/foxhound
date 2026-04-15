import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const defaultIgnoredPathFragments = [
  `${join('components', 'demo')}`,
  `${join('components', 'sandbox', 'primitives.tsx')}`,
  `${join('components', 'sandbox', 'theme.tsx')}`,
];

export const defaultIgnoredExactLines = [];

export function shouldIgnorePath(rootDir, filePath, ignoredPathFragments = defaultIgnoredPathFragments) {
  const rel = relative(rootDir, filePath);
  return ignoredPathFragments.some((fragment) => rel === fragment || rel.startsWith(`${fragment}/`));
}

export function collectSandboxCanonicalViolations({
  rootDir,
  includeRoots,
  ignoredPathFragments = defaultIgnoredPathFragments,
  ignoredExactLines = defaultIgnoredExactLines,
}) {
  const violations = [];

  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!/\.(ts|tsx|js|jsx)$/.test(fullPath)) continue;
      if (shouldIgnorePath(rootDir, fullPath, ignoredPathFragments)) continue;
      if (/\.test\.(ts|tsx|js|jsx)$/.test(fullPath)) continue;

      const content = readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (/['"`]\/demo(?:\/|['"`?])/.test(line) && !ignoredExactLines.includes(line.trim())) {
          violations.push(`${relative(rootDir, fullPath)}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  }

  for (const root of includeRoots) {
    walk(root);
  }

  return violations;
}
