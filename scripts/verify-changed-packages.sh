#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "git is required" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required" >&2
  exit 1
fi

BASE_REF="${1:-main}"

if [[ "${BASE_REF}" == "-h" || "${BASE_REF}" == "--help" ]]; then
  cat <<'EOF'
Usage: scripts/verify-changed-packages.sh [base-ref]

Runs lint and typecheck only for packages/apps changed relative to the given base ref.
Defaults to: main

Examples:
  scripts/verify-changed-packages.sh
  scripts/verify-changed-packages.sh origin/main
  scripts/verify-changed-packages.sh HEAD~1
EOF
  exit 0
fi

if ! git rev-parse --verify "${BASE_REF}" >/dev/null 2>&1; then
  echo "Base ref not found: ${BASE_REF}" >&2
  exit 1
fi

changed_paths="$(git diff --name-only "${BASE_REF}"...HEAD -- apps packages)"

if [[ -z "${changed_paths}" ]]; then
  echo "No changed files under apps/ or packages/ relative to ${BASE_REF}."
  exit 0
fi

workspaces="$(printf '%s\n' "${changed_paths}" | awk -F/ '($1 == "apps" || $1 == "packages") && $2 != "" { print $1 "/" $2 }' | sort -u)"

if [[ -z "${workspaces}" ]]; then
  echo "No changed workspaces detected under apps/ or packages/."
  exit 0
fi

echo "Changed workspaces relative to ${BASE_REF}:"
printf ' - %s\n' ${workspaces}

has_script() {
  local workspace="$1"
  local script_name="$2"
  node -e '
const fs = require("fs");
const path = require("path");
const pkg = JSON.parse(fs.readFileSync(path.join(process.argv[1], "package.json"), "utf8"));
process.exit(pkg.scripts && pkg.scripts[process.argv[2]] ? 0 : 1);
' "$workspace" "$script_name"
}

while IFS= read -r workspace; do
  [[ -z "${workspace}" ]] && continue

  echo
  if has_script "$workspace" "lint"; then
    echo "==> ${workspace}: lint"
    pnpm --filter "./${workspace}" lint
  else
    echo "==> ${workspace}: lint (skipped, no script)"
  fi

  if has_script "$workspace" "typecheck"; then
    echo "==> ${workspace}: typecheck"
    pnpm --filter "./${workspace}" typecheck
  else
    echo "==> ${workspace}: typecheck (skipped, no script)"
  fi
done <<< "${workspaces}"

echo
echo "Changed-package verification complete."
