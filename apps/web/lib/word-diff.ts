/**
 * Word-level diff using longest common subsequence.
 * Splits on whitespace boundaries to produce readable chunks.
 * Used by both the full prompt diff page and inline version diffs.
 */

export interface DiffSegment {
  type: "equal" | "added" | "removed";
  text: string;
}

export function computeWordDiff(before: string, after: string): DiffSegment[] {
  const wordsA = before.split(/(\s+)/);
  const wordsB = after.split(/(\s+)/);

  const m = wordsA.length;
  const n = wordsB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (wordsA[i - 1] === wordsB[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  let i = m;
  let j = n;
  const rawSegments: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
      rawSegments.push({ type: "equal", text: wordsA[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      rawSegments.push({ type: "added", text: wordsB[j - 1]! });
      j--;
    } else {
      rawSegments.push({ type: "removed", text: wordsA[i - 1]! });
      i--;
    }
  }

  rawSegments.reverse();

  // Merge consecutive segments of the same type
  const segments: DiffSegment[] = [];
  for (const seg of rawSegments) {
    const last = segments[segments.length - 1];
    if (last && last.type === seg.type) {
      last.text += seg.text;
    } else {
      segments.push({ ...seg });
    }
  }

  return segments;
}
