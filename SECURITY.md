# Security Policy

Foxhound is a multi-tenant observability platform for AI agent fleets. It handles customer telemetry, API keys, trace metadata, prompts, evaluation results, and billing-linked account state.

Security issues matter here. A single tenant-isolation failure or secret leak is enough to break trust.

## Supported Versions

Security fixes are applied to the latest active branch on GitHub.

At this stage of the project, please assume:

- only the latest `main` branch is supported for security fixes
- older commits, tags, forks, and unpublished local deployments are not guaranteed to receive backports

## Reporting a Vulnerability

Please do **not** open public GitHub issues for suspected vulnerabilities.

Use one of these channels instead:

- GitHub Security Advisory: https://github.com/caleb-love/foxhound/security/advisories/new
- If GitHub Advisories are unavailable for your report, open a private outreach path with the maintainer before public disclosure

When reporting, include:

- affected component or file path
- vulnerability type
- exact reproduction steps
- proof-of-concept request, payload, or trace if safe to share
- impact assessment, especially tenant-isolation or auth bypass impact
- any suggested remediation if you already have one

## Response Expectations

Best effort targets:

- initial acknowledgement: within 3 business days
- triage decision: within 7 business days
- remediation timeline: depends on severity and exploitability

If the report is valid, the goal is to:

1. confirm impact
2. contain exposure
3. patch the issue
4. publish an advisory or release note when safe

## Safe Harbor

If you make a good-faith effort to avoid privacy violations, service disruption, data destruction, and social engineering, we will treat your research as authorized under this policy.

Please do:

- use test accounts or your own data where possible
- minimize data access
- stop once you have demonstrated the issue
- give us reasonable time to remediate before public disclosure

Please do not:

- access, modify, or retain data that is not yours except as minimally necessary to prove the issue
- run denial-of-service attacks
- use phishing, malware, or physical attacks
- attempt extortion or public disclosure before coordination

## High-Priority Vulnerability Classes

Reports are especially valuable if they involve:

- cross-tenant data access or `org_id` isolation bypass
- authn/authz bypasses
- API key scope bypasses
- prompt or trace data exposure across orgs
- secret leakage or plaintext credential storage
- webhook verification flaws
- stored or reflected XSS in dashboard or docs surfaces
- unsafe rendering of prompt or user-controlled content
- remote code execution or command injection
- billing abuse or account-takeover paths

## Security Invariants For Contributors

These are core project rules, not suggestions:

- every multi-tenant query must be scoped by `org_id`
- API keys must be hashed at rest and never logged in plaintext
- prompt content and user-controlled text must be treated as untrusted
- dashboard rendering must escape text by default and avoid unsafe HTML insertion
- JWT-only routes and API-key routes must preserve their trust boundaries clearly
- state-changing or expensive endpoints should have explicit rate limits when abuse risk is meaningful

## Hardening Notes

Current hardening priorities and project state are tracked in:

- `docs/overview/current-status.md`
- `docs/reference/engineering-notes.md`
- `docs/plans/active/`

## Disclosure

Please coordinate disclosure with the maintainers. Public writeups are welcome after remediation or explicit approval.
