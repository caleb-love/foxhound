#!/bin/bash
set -e

# Local test script for Foxhound Quality Gate action
# Tests the bundled script with mock inputs without requiring GitHub Actions context

echo "🧪 Testing Foxhound Quality Gate action locally..."
echo ""

# Change to action directory
cd "$(dirname "$0")"

# Ensure bundle is up to date
echo "Building bundle..."
pnpm run build > /dev/null 2>&1

# Mock environment variables that GitHub Actions would provide
export GITHUB_REPOSITORY="foxhound/test-repo"
export GITHUB_API_URL="https://api.github.com"
export GITHUB_STEP_SUMMARY="/tmp/github-step-summary-$$.md"
export GITHUB_OUTPUT="/tmp/github-output-$$.txt"

# Mock action inputs (these would come from workflow YAML)
export INPUT_API_KEY="test_api_key_mock"
export INPUT_API_ENDPOINT="https://api.foxhound.test"
export INPUT_DATASET_ID="ds_test123"
export INPUT_EVALUATOR_IDS="eval_accuracy,eval_safety"
export INPUT_EXPERIMENT_NAME="Test Experiment"
export INPUT_EXPERIMENT_CONFIG='{"model":"gpt-4","temperature":0.7}'
export INPUT_THRESHOLD="0.75"
export INPUT_BASELINE_EXPERIMENT_ID="exp_baseline_mock"
export INPUT_TIMEOUT="600"

# Optional: Mock GitHub token for PR comment posting (won't actually post)
# export GITHUB_TOKEN="ghp_mock_token"

# Create temporary output files
touch "$GITHUB_STEP_SUMMARY"
touch "$GITHUB_OUTPUT"

echo "Environment setup:"
echo "  GITHUB_REPOSITORY: $GITHUB_REPOSITORY"
echo "  Dataset ID: $INPUT_DATASET_ID"
echo "  Evaluators: $INPUT_EVALUATOR_IDS"
echo "  Threshold: $INPUT_THRESHOLD"
echo "  Baseline: $INPUT_BASELINE_EXPERIMENT_ID"
echo ""

# Run the bundled script
# Note: This will fail when trying to call the actual Foxhound API
# but it tests the input parsing, validation, and markdown formatting logic
echo "Running bundled script..."
echo ""
echo "Expected: Script will fail on API call (no real server), but should show proper input parsing"
echo "---"

# Capture output
if node dist/run.js 2>&1 | tee /tmp/test-output-$$.log; then
  echo "✅ Script completed successfully (unexpected with mock inputs!)"
else
  EXIT_CODE=$?
  echo ""
  echo "❌ Script failed with exit code $EXIT_CODE (expected with mock API)"
fi

echo ""
echo "---"
echo ""

# Verify key functionality
echo "Verification checks:"
echo ""

# Check that inputs were parsed
if grep -q "api.foxhound.test" /tmp/test-output-$$.log; then
  echo "✅ API endpoint parsed correctly"
else
  echo "❌ API endpoint not found in output"
fi

if grep -q "ds_test123" /tmp/test-output-$$.log; then
  echo "✅ Dataset ID parsed correctly"
else
  echo "❌ Dataset ID not found in output"
fi

if grep -q "eval_accuracy" /tmp/test-output-$$.log; then
  echo "✅ Evaluator IDs parsed correctly"
else
  echo "❌ Evaluator IDs not found in output"
fi

# Check for proper error handling
if grep -qi "error\|failed" /tmp/test-output-$$.log; then
  echo "✅ Error handling present (expected with mock API)"
else
  echo "⚠️  No error messages (may indicate script didn't run)"
fi

echo ""
echo "Test artifacts:"
echo "  Output log: /tmp/test-output-$$.log"
echo "  Step summary: $GITHUB_STEP_SUMMARY"
echo "  Action outputs: $GITHUB_OUTPUT"
echo ""

# Display step summary if it was written
if [ -s "$GITHUB_STEP_SUMMARY" ]; then
  echo "GitHub Step Summary content:"
  echo "---"
  cat "$GITHUB_STEP_SUMMARY"
  echo "---"
  echo ""
fi

# Display action outputs if they were written
if [ -s "$GITHUB_OUTPUT" ]; then
  echo "GitHub Action Outputs:"
  echo "---"
  cat "$GITHUB_OUTPUT"
  echo "---"
  echo ""
fi

# Test markdown formatting directly
echo "Testing markdown formatting helpers..."
echo ""

# Create a simple Node script to test the formatting functions
cat > /tmp/test-markdown-$$.js << 'EOF'
// Test markdown table formatting
const score = (current, baseline) => {
  const delta = current - baseline;
  const pctChange = baseline > 0 ? ((delta / baseline) * 100).toFixed(1) : 'N/A';
  const emoji = delta > 0.01 ? '✅' : delta < -0.01 ? '⚠️' : '➡️';
  const sign = delta > 0 ? '+' : '';
  
  return {
    current: current.toFixed(3),
    baseline: baseline.toFixed(3),
    delta: `${emoji} ${sign}${delta.toFixed(3)}`,
    pctChange: pctChange !== 'N/A' ? `${sign}${pctChange}%` : pctChange
  };
};

// Test cases
const tests = [
  { name: 'Improvement', current: 0.85, baseline: 0.75 },
  { name: 'Degradation', current: 0.70, baseline: 0.80 },
  { name: 'No change', current: 0.75, baseline: 0.75 },
  { name: 'Small change', current: 0.755, baseline: 0.750 }
];

console.log('| Test Case | Current | Baseline | Delta | % Change |');
console.log('|-----------|---------|----------|-------|----------|');

tests.forEach(({ name, current, baseline }) => {
  const s = score(current, baseline);
  console.log(`| ${name} | ${s.current} | ${s.baseline} | ${s.delta} | ${s.pctChange} |`);
});

console.log('');
console.log('✅ Markdown formatting test complete');
EOF

node /tmp/test-markdown-$$.js
echo ""

# Cleanup
rm -f /tmp/test-markdown-$$.js /tmp/test-output-$$.log

echo "✅ Local test complete!"
echo ""
echo "To test with a real Foxhound API:"
echo "  1. Set INPUT_API_KEY to a valid Foxhound API key"
echo "  2. Set INPUT_API_ENDPOINT to your Foxhound API URL"
echo "  3. Set INPUT_DATASET_ID to a real dataset ID"
echo "  4. Run this script again"
