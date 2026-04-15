import { join } from 'node:path';
import { collectSandboxCanonicalViolations } from './check-sandbox-canonical-lib.mjs';

const ROOT = process.cwd();
const includeRoots = [
  join(ROOT, 'app', 'sandbox'),
  join(ROOT, 'app', '(dashboard)'),
  join(ROOT, 'components'),
];

const violations = collectSandboxCanonicalViolations({
  rootDir: ROOT,
  includeRoots,
});

if (violations.length > 0) {
  console.error('Found non-canonical /demo references in active web surfaces:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Sandbox canonical check passed. No active-surface /demo references found.');
