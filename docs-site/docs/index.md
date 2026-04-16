---
slug: /
title: Foxhound Documentation
sidebar_label: Overview
---

# Foxhound

**Compliance-grade observability for AI agent fleets.**

Foxhound gives you deep visibility into every AI agent call — traces, evals, cost, latency, and policy violations — so you can ship AI safely at scale.

## Explore the docs

| Section                                                    | Description                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| [Getting Started](/getting-started/installation)           | Install Foxhound and send your first trace in minutes             |
| [TypeScript SDK](/sdk/typescript)                          | Full API reference for the Node.js / TypeScript SDK               |
| [Python SDK](/sdk/python)                                  | Full API reference for the Python SDK                             |
| [Integrations](/integrations/langgraph)                    | Drop-in wrappers for LangGraph, CrewAI, Mastra, and more          |
| [MCP Server](/mcp-server/setup)                            | Use Foxhound tools from any MCP-compatible AI assistant           |
| [Prompt Management](/sdk/python#prompt-management)         | Versioned prompt registry with labels, caching, and trace linking |
| [CI/CD Quality Gate](/ci-cd/quality-gate-action)           | Block deploys when eval scores regress                            |
| [Evaluation Cookbook](/evaluation-cookbook/manual-scoring) | Recipes for scoring, judging, and curating eval datasets          |

## Live sandbox

Explore Foxhound without setting up infrastructure. The sandbox ships with 568 seeded traces across a realistic seven-day operating story:

```bash
git clone https://github.com/caleb-love/foxhound.git
cd foxhound && pnpm install
pnpm dev:web:demo
# Open http://localhost:3001/sandbox
```

The sandbox includes fleet overview, trace investigation, run diff, session replay, regression detection, experiments, budgets, SLAs, prompt management, and an SDK ingestion simulator.

## Quick install

```bash
# TypeScript / Node.js
npm install @foxhound-ai/sdk

# Python
pip install foxhound-ai
```

## Why Foxhound?

- **Full-trace observability** — every LLM call, tool invocation, and agent hop captured automatically
- **Policy enforcement** — detect PII leakage, prompt injection, and off-topic responses in real time
- **Eval pipelines** — score outputs with LLM-as-a-judge or human review, then gate deploys on those scores
- **OpenTelemetry native** — works with your existing OTel stack; no lock-in
- **Audit-ready** — structured logging of every agent action for review and debugging
