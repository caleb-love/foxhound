#!/usr/bin/env node

import { FoxhoundApiClient } from "@foxhound/api-client";

/**
 * Parse GitHub Actions input from environment variables.
 * GitHub Actions passes inputs via INPUT_* env vars (uppercase, dashes become underscores).
 */
function getInput(name: string, required: boolean = false): string {
  const envKey = `INPUT_${name.toUpperCase().replace(/-/g, "_")}`;
  const value = process.env[envKey] || "";

  if (required && !value) {
    throw new Error(`Missing required input: ${name}`);
  }

  return value;
}

/**
 * Set GitHub Actions output.
 * Outputs are written to GITHUB_OUTPUT file in key=value format.
 */
function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    console.log(`::set-output name=${name}::${value}`);
    return;
  }

  const fs = require("fs");
  fs.appendFileSync(outputFile, `${name}=${value}\n`);
}

/**
 * Write to GitHub Actions step summary.
 * Summary markdown is written to GITHUB_STEP_SUMMARY file.
 */
function appendStepSummary(markdown: string): void {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) {
    console.log("--- Step Summary ---");
    console.log(markdown);
    return;
  }

  const fs = require("fs");
  fs.appendFileSync(summaryFile, markdown + "\n");
}

/**
 * Poll experiment for completion with exponential backoff.
 */
async function pollExperiment(
  client: FoxhoundApiClient,
  experimentId: string,
  timeoutMs: number,
): Promise<import("@foxhound/api-client").ExperimentWithRuns> {
  const startTime = Date.now();
  let delay = 2000; // Start with 2s
  const maxDelay = 30000; // Max 30s
  let attempt = 0;

  while (true) {
    attempt++;
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    const experiment = await client.getExperiment(experimentId);

    console.log(`[poll ${attempt}] status=${experiment.status}, elapsed=${elapsed}s`);

    if (experiment.status === "completed") {
      return experiment;
    }

    if (experiment.status === "failed") {
      throw new Error(`Experiment failed: ${experimentId}`);
    }

    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        `Experiment timed out after ${Math.round(timeoutMs / 1000)}s, last status: ${experiment.status}`,
      );
    }

    // Wait with exponential backoff
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, maxDelay);
  }
}

/**
 * Parse experiment config input, adding timeout if provided.
 */
function parseExperimentConfig(): { config: Record<string, unknown>; timeout: number } {
  const timeoutRaw = getInput("timeout") || "600";
  const timeout = Number(timeoutRaw);
  if (isNaN(timeout) || timeout <= 0) {
    throw new Error(`Invalid timeout value: ${timeoutRaw}`);
  }

  const experimentConfigRaw = getInput("experiment-config", true);
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(experimentConfigRaw);
  } catch (err) {
    throw new Error(
      `Invalid experiment-config JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { config, timeout };
}

/**
 * Get experiment name from input or default to PR context.
 */
function getExperimentName(): string {
  const name = getInput("experiment-name");
  if (name) return name;

  // Try to extract PR number from GitHub context
  const prNumber = process.env.GITHUB_REF?.match(/pull\/(\d+)/)?.[1];
  if (prNumber) return `PR #${prNumber}`;

  // Fallback to ref name
  return process.env.GITHUB_REF?.replace("refs/heads/", "") || "unknown";
}

/**
 * Main action entrypoint.
 *
 * 1. Creates an experiment via the Foxhound API
 * 2. Polls for completion with exponential backoff
 * 3. Compares scores against the baseline experiment (if provided)
 * 4. Posts or updates a PR comment with rich quality gate results
 * 5. Fails the workflow if any evaluator score drops below threshold
 */
async function main(): Promise<void> {
  console.log("Starting Foxhound quality gate action...");

  // Parse inputs
  const apiKey = getInput("api-key", true);
  const apiEndpoint = getInput("api-endpoint", true);
  const datasetId = getInput("dataset-id", true);
  const experimentName = getExperimentName();
  const { config, timeout } = parseExperimentConfig();

  console.log(`Dataset ID: ${datasetId}`);
  console.log(`API Endpoint: ${apiEndpoint}`);
  console.log(`Experiment Name: ${experimentName}`);
  console.log(`Timeout: ${timeout}s`);

  // Create API client
  const client = new FoxhoundApiClient({
    endpoint: apiEndpoint,
    apiKey: apiKey,
  });

  // Create experiment
  let experimentId: string;
  try {
    console.log("Creating experiment...");
    const response = await client.createExperiment({
      datasetId,
      name: experimentName,
      config,
    });
    experimentId = response.experiment.id;
    console.log(`Experiment created: ${experimentId}`);
    console.log(`Run count: ${response.runCount}`);
  } catch (err: unknown) {
    // Handle specific API error codes
    if (err instanceof Error && err.message.includes("401")) {
      throw new Error("Invalid API key or missing FOXHOUND_API_KEY secret");
    }
    if (err instanceof Error && err.message.includes("403")) {
      throw new Error("Organization lacks 'canEvaluate' entitlement -- upgrade to Pro plan");
    }
    if (err instanceof Error && err.message.includes("404")) {
      throw new Error("Dataset not found -- verify dataset-id input");
    }
    if (err instanceof Error && err.message.includes("500")) {
      throw new Error("Foxhound API server error -- check status.foxhound.dev");
    }
    throw err;
  }

  // Write experiment ID to output
  setOutput("experiment-id", experimentId);

  // Poll for completion
  try {
    console.log(`Polling for experiment completion (timeout: ${timeout}s)...`);
    const experiment = await pollExperiment(client, experimentId, timeout * 1000);
    console.log(`Experiment completed: ${experiment.id}`);
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(`Poll failed: ${err.message}`);
    }
    throw err;
  }

  // Parse comparison inputs
  const baselineExperimentId = getInput("baseline-experiment-id") || null;
  const thresholdRaw = getInput("threshold") || "0.0";
  const threshold = Number(thresholdRaw);
  if (isNaN(threshold)) {
    throw new Error(`Invalid threshold value: ${thresholdRaw}`);
  }

  // Build comparison URL early (used in comment and as output)
  const comparisonUrl = baselineExperimentId
    ? `https://app.foxhound.dev/experiments/compare?ids=${baselineExperimentId},${experimentId}`
    : `https://app.foxhound.dev/experiments/${experimentId}`;

  // Compare scores if baseline provided
  let evaluatorScores: EvaluatorScore[] = [];
  let violations: Array<{ name: string; score: number; threshold: number }> = [];
  let comparisonError: string | undefined;

  if (baselineExperimentId) {
    console.log(`Comparing with baseline experiment: ${baselineExperimentId}`);

    try {
      const comparison = await client.compareExperiments([baselineExperimentId, experimentId]);

      // Group scores by evaluator name and experiment.
      // scores array contains entries like: { id, name, value, label, source, experimentRunId, ... }
      // We compute aggregate per evaluator per experiment.
      const scoresByEvaluator = new Map<string, { baseline: number[]; current: number[] }>();

      for (const score of comparison.scores) {
        // Only use LLM judge scores for comparison
        if (score.source !== "llm_judge") continue;
        if (score.value === undefined) continue;

        // Find which experiment this score belongs to by matching runId.
        // The API returns experimentRunId on comparison scores but the shared
        // Score type does not declare it, so we cast through unknown.
        const scoreWithRun = score as unknown as { experimentRunId?: string };
        const run = comparison.runs.find(
          (r: { id: string }) => r.id === scoreWithRun.experimentRunId,
        );
        if (!run) continue;

        const isBaseline = run.experimentId === baselineExperimentId;
        const isCurrent = run.experimentId === experimentId;

        if (!isBaseline && !isCurrent) continue;

        if (!scoresByEvaluator.has(score.name)) {
          scoresByEvaluator.set(score.name, { baseline: [], current: [] });
        }

        const bucket = scoresByEvaluator.get(score.name)!;
        if (isBaseline) bucket.baseline.push(score.value);
        if (isCurrent) bucket.current.push(score.value);
      }

      // Compute mean scores per evaluator
      for (const [name, buckets] of scoresByEvaluator.entries()) {
        const baselineMean =
          buckets.baseline.length > 0
            ? buckets.baseline.reduce((a, b) => a + b, 0) / buckets.baseline.length
            : 0;
        const currentMean =
          buckets.current.length > 0
            ? buckets.current.reduce((a, b) => a + b, 0) / buckets.current.length
            : 0;
        const delta = currentMean - baselineMean;

        evaluatorScores.push({ name, baseline: baselineMean, current: currentMean, delta });

        // Check threshold violation
        if (currentMean < threshold) {
          violations.push({ name, score: currentMean, threshold });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to compare experiments: ${msg}`);
      comparisonError = `Failed to compare with baseline experiment \`${baselineExperimentId}\`: ${msg}`;
    }
  } else {
    console.log("No baseline provided - posting scores without comparison");
  }

  // Determine pass/fail
  const passed = violations.length === 0 && !comparisonError;

  // Format rich markdown comment
  const comparisonMarkdown = formatQualityGateComment({
    passed,
    experimentId,
    experimentName,
    baselineExperimentId,
    threshold,
    evaluatorScores,
    comparisonUrl,
    errorMessage: comparisonError,
  });

  // Write to step summary
  appendStepSummary(comparisonMarkdown);

  // Post or update PR comment (non-fatal -- errors are logged but do not fail the action)
  const githubToken = getInput("github-token") || process.env.GITHUB_TOKEN || "";
  const prNumber = getPrNumber();
  const repoInfo = parseRepository();

  if (githubToken && prNumber && repoInfo) {
    try {
      await postOrUpdatePrComment(
        repoInfo.owner,
        repoInfo.repo,
        prNumber,
        comparisonMarkdown,
        githubToken,
      );
      console.log(`Posted quality gate comment to PR #${prNumber}`);
    } catch (err: unknown) {
      console.error(
        `Failed to post PR comment: ${err instanceof Error ? err.message : String(err)}`,
      );
      console.log("Quality gate results written to step summary only");
    }
  } else {
    if (!githubToken) console.log("GITHUB_TOKEN not available - skipping PR comment");
    if (!prNumber) console.log("Not a PR context - skipping PR comment");
    if (!repoInfo) console.log("GITHUB_REPOSITORY not set - skipping PR comment");
  }

  // Write outputs
  setOutput("comparison-url", comparisonUrl);

  // Enforce threshold
  if (violations.length > 0) {
    const names = violations.map((v) => `${v.name} (${v.score.toFixed(3)})`).join(", ");
    console.error(
      `Quality gate failed: ${violations.length} evaluator(s) below threshold ${threshold}: ${names}`,
    );
    process.exit(1);
  }

  console.log("Quality gate action complete.");
}

// ── Helper types ────────────────────────────────────────────────────────────

interface EvaluatorScore {
  name: string;
  baseline: number;
  current: number;
  delta: number;
}

interface QualityGateCommentParams {
  passed: boolean;
  experimentId: string;
  experimentName: string;
  baselineExperimentId: string | null;
  threshold: number;
  evaluatorScores: EvaluatorScore[];
  comparisonUrl: string;
  errorMessage?: string;
}

// ── PR context helpers ──────────────────────────────────────────────────────

/**
 * Extract PR number from GitHub context.
 */
function getPrNumber(): number | null {
  // Try INPUT_PR_NUMBER first (explicit input)
  const inputPr = process.env.INPUT_PR_NUMBER;
  if (inputPr) {
    const parsed = Number(inputPr);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // Try GITHUB_REF (e.g., "refs/pull/123/merge")
  const refMatch = process.env.GITHUB_REF?.match(/refs\/pull\/(\d+)\//);
  if (refMatch) return Number(refMatch[1]);

  // Try GITHUB_EVENT_PATH (contains full event payload)
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath) {
    try {
      const fs = require("fs");
      const event = JSON.parse(fs.readFileSync(eventPath, "utf-8"));
      if (event.pull_request?.number) return event.pull_request.number;
      // Also check issue_comment events which reference issues/PRs
      if (event.issue?.pull_request && event.issue?.number) return event.issue.number;
    } catch {
      // Ignore parse errors
    }
  }

  return null;
}

/**
 * Parse GITHUB_REPOSITORY into owner and repo name.
 */
function parseRepository(): { owner: string; repo: string } | null {
  const fullRepo = process.env.GITHUB_REPOSITORY;
  if (!fullRepo) return null;

  const [owner, repo] = fullRepo.split("/");
  if (!owner || !repo) return null;

  return { owner, repo };
}

// ── Markdown formatting ─────────────────────────────────────────────────────

/**
 * Format quality gate results as a rich markdown PR comment.
 *
 * The comment includes:
 * - Pass/fail status header
 * - Score comparison table (when baseline scores exist)
 * - Collapsible experiment details (IDs, threshold, commit, timestamp)
 * - Link to the full Foxhound comparison view
 */
function formatQualityGateComment(params: QualityGateCommentParams): string {
  const {
    passed,
    experimentId,
    experimentName,
    baselineExperimentId,
    threshold,
    evaluatorScores,
    comparisonUrl,
    errorMessage,
  } = params;

  const marker = "<!-- foxhound-quality-gate -->";
  const statusIcon = passed ? "\u2705" : "\u274C";
  const statusText = passed ? "Passed" : "Failed";
  const commitSha = process.env.GITHUB_SHA?.slice(0, 7) || "unknown";
  const timestamp = new Date()
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z/, " UTC");

  const lines: string[] = [marker, ""];
  lines.push(`## ${statusIcon} Foxhound Quality Gate \u2014 ${statusText}`);
  lines.push("");

  // Error banner (comparison failure, etc.)
  if (errorMessage) {
    lines.push(`> **Warning:** ${errorMessage}`);
    lines.push("");
  }

  // Score comparison table
  if (evaluatorScores.length > 0) {
    lines.push(`**Threshold:** \`${threshold.toFixed(3)}\``);
    lines.push("");
    lines.push("| Evaluator | Baseline | Current | Delta | Status |");
    lines.push("|-----------|----------|---------|-------|--------|");

    for (const { name, baseline, current, delta } of evaluatorScores) {
      const deltaStr = delta >= 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3);
      let status: string;
      if (current < threshold) {
        status = "\u274C below threshold";
      } else if (delta < -0.001) {
        status = "\u26A0\uFE0F degraded";
      } else if (delta > 0.001) {
        status = "\u2705 improved";
      } else {
        status = "\u2705 stable";
      }
      lines.push(
        `| ${name} | ${baseline.toFixed(3)} | ${current.toFixed(3)} | ${deltaStr} | ${status} |`,
      );
    }

    lines.push("");
  } else if (!errorMessage && baselineExperimentId) {
    lines.push(
      "> No evaluator scores found (all evaluators may be disabled or no LLM judge scores present)",
    );
    lines.push("");
  } else if (!baselineExperimentId) {
    lines.push(
      "> No baseline experiment provided -- this is the first run. Future PRs will show score deltas.",
    );
    lines.push("");
  }

  // Experiment details (collapsible)
  lines.push("<details>");
  lines.push("<summary>Experiment details</summary>");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|-------|-------|");
  lines.push(`| Experiment | \`${experimentName}\` |`);
  lines.push(`| Experiment ID | \`${experimentId}\` |`);
  if (baselineExperimentId) {
    lines.push(`| Baseline ID | \`${baselineExperimentId}\` |`);
  }
  lines.push(`| Threshold | \`${threshold.toFixed(3)}\` |`);
  lines.push(`| Commit | \`${commitSha}\` |`);
  lines.push(`| Timestamp | ${timestamp} |`);
  lines.push("");
  lines.push("</details>");
  lines.push("");

  // Link to full comparison
  lines.push(`[View full results](${comparisonUrl})`);
  lines.push("");

  return lines.join("\n");
}

// ── GitHub API ──────────────────────────────────────────────────────────────

/**
 * Post or update a PR comment with quality gate results.
 *
 * Uses a hidden HTML marker (`<!-- foxhound-quality-gate -->`) to locate an
 * existing comment so that re-runs update in place rather than creating
 * duplicate comments. Paginates through up to 500 comments to find the marker.
 */
async function postOrUpdatePrComment(
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
  githubToken: string,
): Promise<void> {
  const marker = "<!-- foxhound-quality-gate -->";
  const markedBody = body.includes(marker) ? body : `${marker}\n${body}`;

  const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
  const commentsUrl = `${apiBase}/repos/${owner}/${repo}/issues/${prNumber}/comments`;
  const headers: Record<string, string> = {
    Authorization: `token ${githubToken}`,
    Accept: "application/vnd.github.v3+json",
  };

  // Search existing comments with pagination (up to 5 pages / 500 comments)
  let existingCommentId: number | null = null;
  let page = 1;
  const maxPages = 5;

  while (page <= maxPages) {
    const listRes = await fetch(`${commentsUrl}?per_page=100&page=${page}`, { headers });

    if (!listRes.ok) {
      console.warn(
        `Failed to list PR comments (page ${page}): ${listRes.status} ${listRes.statusText}`,
      );
      break;
    }

    const comments = (await listRes.json()) as Array<{ id: number; body: string }>;
    const existing = comments.find((c) => c.body.includes(marker));

    if (existing) {
      existingCommentId = existing.id;
      break;
    }

    // Stop if fewer results than per_page (last page)
    if (comments.length < 100) break;
    page++;
  }

  if (existingCommentId !== null) {
    // Update existing comment
    const updateRes = await fetch(
      `${apiBase}/repos/${owner}/${repo}/issues/comments/${existingCommentId}`,
      {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ body: markedBody }),
      },
    );

    if (!updateRes.ok) {
      throw new Error(`Failed to update PR comment: ${updateRes.status} ${updateRes.statusText}`);
    }

    return;
  }

  // Create new comment
  const createRes = await fetch(commentsUrl, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ body: markedBody }),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create PR comment: ${createRes.status} ${createRes.statusText}`);
  }
}

// ── Entrypoint ──────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
