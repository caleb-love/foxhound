#!/usr/bin/env bash
# Regenerate TypeScript + Python bindings from the canonical .proto sources.
#
# Prereqs (operator action; not runnable by a CI agent without them):
#   brew install bufbuild/buf/buf          # macOS
#   # or: curl -sSL https://...buf...      # Linux
#
# This script is the authoritative regen command referenced by RFC-003
# and by `buf.gen.yaml`. It is a no-op wrapper today so the command
# surface is stable; operator-installed `buf` does the real work.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

if ! command -v buf >/dev/null 2>&1; then
  echo "buf: not installed."
  echo "Install: https://buf.build/docs/installation"
  echo "Skipping codegen. Committed hand-aligned bindings in src/v1/ remain canonical."
  exit 0
fi

echo "==> buf lint"
buf lint

echo "==> buf breaking (against main branch if accessible)"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git rev-parse --verify main >/dev/null 2>&1; then
    buf breaking --against ".git#branch=main,subdir=packages/proto" || {
      echo
      echo "BREAKING CHANGE detected against main."
      echo "Either revert the .proto change or bump to v2 per RFC-003."
      exit 1
    }
  else
    echo "main branch not available locally; skipping breaking-change check"
  fi
fi

echo "==> buf generate"
buf generate

echo "==> done. Review diffs in src/v1/gen/ and ../sdk-py/foxhound_sdk/_proto/."
