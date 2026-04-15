#!/usr/bin/env bash
set -euo pipefail

# Fails if tracked or currently present repo noise/secret helper files appear
# outside allowed authored surfaces. Intended for CI and local preflight checks.

if ! command -v git >/dev/null 2>&1; then
  echo "git is required" >&2
  exit 1
fi

bad_paths=()

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  case "$path" in
    apps/web/*) continue ;;
    .github/actions/quality-gate/dist/run.js) continue ;;
  esac
  bad_paths+=("$path")
done < <(
  {
    git ls-files \
      ':(glob)**/.DS_Store' \
      ':(glob)**/.turbo/**' \
      ':(glob)**/coverage/**' \
      ':(glob)**/dist/**' \
      ':(glob)**/*.tsbuildinfo' \
      ':(glob)**/__pycache__/**' \
      ':(glob)**/*.pyc' \
      'docs-site/.docusaurus/**' \
      'docs-site/build/**' \
      '.turbo/**' \
      '.ruff_cache/**' \
      'packages/sdk-py/.coverage' \
      'packages/mcp-server/.mcpregistry_github_token' \
      'packages/mcp-server/.mcpregistry_registry_token' \
      'packages/types/src/index.js' \
      'packages/types/src/index.js.map' \
      'packages/types/src/index.d.ts' \
      'packages/types/src/index.d.ts.map'

    find . \( -path './.git' -o -path './node_modules' -o -path './apps/web' \) -prune -o -type f \( \
      -name '.DS_Store' -o \
      -name '*.tsbuildinfo' -o \
      -name '.coverage' -o \
      -name '*.pyc' -o \
      -path '*/.turbo/*' -o \
      -path '*/coverage/*' -o \
      -path '*/__pycache__/*' -o \
      -path './.turbo/*' -o \
      -path './.ruff_cache/*' -o \
      -path './docs-site/.docusaurus/*' -o \
      -path './docs-site/build/*' -o \
      -path '*/dist/*' -o \
      -path './packages/mcp-server/.mcpregistry_github_token' -o \
      -path './packages/mcp-server/.mcpregistry_registry_token' -o \
      -path './packages/types/src/index.js' -o \
      -path './packages/types/src/index.js.map' -o \
      -path './packages/types/src/index.d.ts' -o \
      -path './packages/types/src/index.d.ts.map' \
    \) -print | sed 's#^./##'
  } | sort -u
)

if [[ ${#bad_paths[@]} -gt 0 ]]; then
  echo "Repo hygiene check failed. Remove generated/local-noise files from tracked/current repo state:" >&2
  printf ' - %s\n' "${bad_paths[@]}" >&2
  exit 1
fi

docs_warnings=()
active_plan_count=$(find docs/plans/active -maxdepth 1 -type f ! -name 'README.md' | wc -l | tr -d ' ')
if [[ ${active_plan_count} -gt 8 ]]; then
  docs_warnings+=("docs/plans/active contains ${active_plan_count} files (target: <= 8 active plans)")
fi

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  docs_warnings+=("active plan artifact should be archived or moved: ${path}")
done < <(find docs/plans/active -maxdepth 1 -type f \( -name '*.html' -o -name '*.json' \) | sort)

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  docs_warnings+=("supporting template/research artifact should usually not stay active: ${path}")
done < <(find docs/plans/active -maxdepth 1 -type f \( -iname '*template*' -o -iname '*tracker*' -o -iname '*interview-guide*' \) | sort)

if [[ ${#docs_warnings[@]} -gt 0 ]]; then
  echo "Repo hygiene check passed with docs warnings:" >&2
  printf ' - %s\n' "${docs_warnings[@]}" >&2
  exit 0
fi

echo "Repo hygiene check passed."
