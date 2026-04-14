# S03: GitHub Actions Quality Gate — UAT

**Milestone:** M001
**Written:** 2026-04-10T06:41:22.035Z

S03 UAT script covers: (1) Structure & Configuration tests (action.yml validity, bundle verification, documentation complete) — local, low complexity. (2) Dry-Run Local tests (input parsing, markdown formatting/unit tests) — local. (3) E2E Integration tests (workflow dispatch, first run without baseline, second run with baseline comparison, threshold enforcement, API error handling, timeout handling) — manual on real PR. UAT Pass Criteria: all low-complexity tests pass, medium-complexity tests executed with documented results, at least 3 E2E tests pass for end-to-end workflow validation. Known limitations: GitHub Actions runner availability, Foxhound API availability, branch protection rules may block test PRs, idempotent updates testable only with multiple pushes to same PR.
