import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const APP_DIR = join(ROOT, 'app');

function walk(dir) {
  const entries = readdirSync(dir).sort();
  const files = [];

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

function checkFile(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const rel = relative(ROOT, filePath);
  const issues = [];

  const hasSyncParamsType = /params\s*:\s*\{[^}]+\}/s.test(source);
  const hasAsyncParamsType = /params\s*:\s*Promise<\{[^}]+\}>/s.test(source);
  const resolvesParams = /await\s+params\b/.test(source) || /Promise\.all\([^)]*\bparams\b[^)]*\)/s.test(source);

  const hasSyncSearchParamsType = /searchParams\s*:\s*\{[^}]+\}/s.test(source);
  const hasAsyncSearchParamsType = /searchParams\s*:\s*Promise<\{[^}]+\}>/s.test(source);
  const resolvesSearchParams = /await\s+searchParams\b/.test(source) || /Promise\.all\([^)]*\bsearchParams\b[^)]*\)/s.test(source);

  if (hasSyncParamsType) {
    issues.push(`${rel}: synchronous params type found; use Promise<{ ... }>`);
  }

  if (hasAsyncParamsType && !resolvesParams) {
    issues.push(`${rel}: params typed as Promise but never resolved`);
  }

  if (hasSyncSearchParamsType) {
    issues.push(`${rel}: synchronous searchParams type found; use Promise<{ ... }>`);
  }

  if (hasAsyncSearchParamsType && !resolvesSearchParams) {
    issues.push(`${rel}: searchParams typed as Promise but never resolved`);
  }

  return issues;
}

const pageFiles = walk(APP_DIR);
const issues = pageFiles.flatMap(checkFile);

if (issues.length > 0) {
  console.error('Route prop contract check failed:\n');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`Route prop contract check passed for ${pageFiles.length} page.tsx file(s).`);
