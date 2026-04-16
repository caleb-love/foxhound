---
title: Evaluation Cookbook
sidebar_label: Overview
slug: /evaluation-cookbook
---

# Evaluation Cookbook

Foxhound provides a layered evaluation system that lets you move from quick manual feedback all the way to automated regression prevention in CI. This cookbook covers each layer with practical how-to guides.

## Evaluation Philosophy

The best evaluation strategy combines multiple signals:

| Layer            | Speed   | Scale       | Use Case                       |
| ---------------- | ------- | ----------- | ------------------------------ |
| Manual scoring   | Seconds | Low         | Quick spot-checks, calibration |
| LLM-as-a-Judge   | Minutes | Medium–High | Automated quality assessment   |
| Dataset curation | Ongoing | High        | Building reliable test suites  |
| CI quality gates | Per PR  | High        | Regression prevention          |

Start with manual scoring to build intuition, use LLM-as-a-Judge evaluators to scale, curate a dataset from your best examples, then lock quality in with CI gates.

## What Foxhound Evaluates

Foxhound evaluates **traces** — complete records of an agent run from start to finish, including every LLM call, tool invocation, and memory read. Scores are attached to traces at one or more named dimensions (e.g. `helpfulness`, `accuracy`, `safety`).

Scores are always in the range **0.0–1.0** (higher is better) and can have a text rationale explaining the verdict.

## Guides in This Section

- **[Manual Scoring](/evaluation-cookbook/manual-scoring)** — Score traces from your IDE using the MCP tools `foxhound_score_trace` and `foxhound_get_trace_scores`.
- **[LLM-as-a-Judge](/evaluation-cookbook/llm-as-a-judge)** — Set up and run automated evaluators that score traces using an LLM judge.
- **[Dataset Curation](/evaluation-cookbook/dataset-curation)** — Build evaluation datasets from production traces using score thresholds and bulk curation.
- **[CI Quality Gates](/evaluation-cookbook/ci-quality-gates)** — Automate quality enforcement on pull requests with the Foxhound GitHub Action.

## Prerequisites

- Foxhound SDK instrumented in your agent (see [Installation](../getting-started/installation))
- At least one trace visible in the Foxhound dashboard
- Foxhound MCP server connected to your IDE (see [MCP Server Setup](../mcp-server/setup))
