#!/usr/bin/env node

/**
 * Unit test for score comparison logic.
 * This validates the aggregation and threshold enforcement without requiring API calls.
 */

// Mock score data matching ExperimentComparisonResponse structure
const mockScores = [
  // Baseline experiment scores (experimentRunId maps to run1)
  {
    id: "s1",
    name: "accuracy",
    value: 0.85,
    source: "llm_judge" as const,
    experimentRunId: "run1",
  },
  {
    id: "s2",
    name: "accuracy",
    value: 0.87,
    source: "llm_judge" as const,
    experimentRunId: "run1",
  },
  {
    id: "s3",
    name: "coherence",
    value: 0.75,
    source: "llm_judge" as const,
    experimentRunId: "run1",
  },

  // Current experiment scores (experimentRunId maps to run2)
  { id: "s4", name: "accuracy", value: 0.9, source: "llm_judge" as const, experimentRunId: "run2" },
  {
    id: "s5",
    name: "accuracy",
    value: 0.88,
    source: "llm_judge" as const,
    experimentRunId: "run2",
  },
  {
    id: "s6",
    name: "coherence",
    value: 0.65,
    source: "llm_judge" as const,
    experimentRunId: "run2",
  },
];

const mockRuns = [
  { id: "run1", experimentId: "baseline-exp" },
  { id: "run2", experimentId: "current-exp" },
];

const baselineExperimentId = "baseline-exp";
const currentExperimentId = "current-exp";
const threshold = 0.7;

// Replicate the aggregation logic from run.ts
const scoresByEvaluator = new Map<string, { baseline: number[]; current: number[] }>();

for (const score of mockScores) {
  if (score.source !== "llm_judge") continue;
  if (score.value === undefined) continue;

  const run = mockRuns.find((r) => r.id === score.experimentRunId);
  if (!run) continue;

  const isBaseline = run.experimentId === baselineExperimentId;
  const isCurrent = run.experimentId === currentExperimentId;

  if (!isBaseline && !isCurrent) continue;

  if (!scoresByEvaluator.has(score.name)) {
    scoresByEvaluator.set(score.name, { baseline: [], current: [] });
  }

  const bucket = scoresByEvaluator.get(score.name)!;
  if (isBaseline) bucket.baseline.push(score.value);
  if (isCurrent) bucket.current.push(score.value);
}

// Compute means and check threshold
console.log("Score Aggregation Test\n");
let violations = 0;

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

  console.log(`${name}:`);
  console.log(`  Baseline: ${baselineMean.toFixed(3)} (from ${buckets.baseline.length} samples)`);
  console.log(`  Current:  ${currentMean.toFixed(3)} (from ${buckets.current.length} samples)`);
  console.log(`  Delta:    ${delta >= 0 ? "+" : ""}${delta.toFixed(3)}`);

  if (currentMean < threshold) {
    console.log(`  ❌ VIOLATION: ${currentMean.toFixed(3)} < ${threshold}`);
    violations++;
  } else {
    console.log(`  ✅ PASS: ${currentMean.toFixed(3)} >= ${threshold}`);
  }
  console.log();
}

console.log(`Threshold: ${threshold}`);
console.log(`Violations: ${violations}`);

// Verify expected results
const expectedAccuracy = (0.85 + 0.87) / 2; // 0.86
const expectedCurrentAccuracy = (0.9 + 0.88) / 2; // 0.89
const expectedCoherence = 0.75;
const expectedCurrentCoherence = 0.65;

if (
  Math.abs(
    scoresByEvaluator.get("accuracy")!.baseline.reduce((a, b) => a + b) / 2 - expectedAccuracy,
  ) < 0.001
) {
  console.log("✅ Baseline accuracy computed correctly");
} else {
  console.error("❌ Baseline accuracy computation error");
  process.exit(1);
}

if (
  Math.abs(
    scoresByEvaluator.get("accuracy")!.current.reduce((a, b) => a + b) / 2 -
      expectedCurrentAccuracy,
  ) < 0.001
) {
  console.log("✅ Current accuracy computed correctly");
} else {
  console.error("❌ Current accuracy computation error");
  process.exit(1);
}

// Coherence should violate threshold (0.65 < 0.70)
if (violations === 1) {
  console.log("✅ Threshold violation detected correctly (coherence degraded)");
} else {
  console.error(`❌ Expected 1 violation, got ${violations}`);
  process.exit(1);
}

console.log("\n✅ All tests passed!");
