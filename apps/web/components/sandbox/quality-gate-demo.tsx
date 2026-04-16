'use client';

import { useCallback, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Check, X, Loader2, GitPullRequest } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EvalResult {
  evaluator: string;
  baseline: number;
  current: number;
  delta: number;
  passed: boolean;
}

const MOCK_RESULTS: EvalResult[] = [
  { evaluator: 'helpfulness-judge', baseline: 0.87, current: 0.91, delta: 0.04, passed: true },
  { evaluator: 'factual-accuracy', baseline: 0.93, current: 0.89, delta: -0.04, passed: true },
  { evaluator: 'refund-policy-compliance', baseline: 0.82, current: 0.68, delta: -0.14, passed: false },
  { evaluator: 'tone-and-empathy', baseline: 0.79, current: 0.84, delta: 0.05, passed: true },
];

type SimStage = 'idle' | 'creating' | 'polling' | 'comparing' | 'commenting' | 'done';

const STAGE_LABELS: Record<SimStage, string> = {
  idle: 'Ready to run',
  creating: 'Creating experiment from dataset...',
  polling: 'Running evaluators on 24 traces...',
  comparing: 'Comparing against baseline...',
  commenting: 'Posting PR comment...',
  done: 'Quality gate complete',
};

export function QualityGateDemo() {
  const [stage, setStage] = useState<SimStage>('idle');
  const [results, setResults] = useState<EvalResult[] | null>(null);

  const runSimulation = useCallback(() => {
    setResults(null);
    setStage('creating');

    const stages: SimStage[] = ['creating', 'polling', 'comparing', 'commenting', 'done'];
    let i = 0;

    const timer = setInterval(() => {
      i++;
      if (i >= stages.length) {
        clearInterval(timer);
        setStage('done');
        setResults(MOCK_RESULTS);
        const allPassed = MOCK_RESULTS.every((r) => r.passed);
        if (allPassed) {
          toast.success('Quality gate passed', { description: 'All evaluators above threshold.' });
        } else {
          toast.error('Quality gate failed', { description: '1 evaluator below threshold. PR blocked.' });
        }
        return;
      }
      setStage(stages[i]!);
    }, 1200);
  }, []);

  const allPassed = results?.every((r) => r.passed) ?? false;
  const isRunning = stage !== 'idle' && stage !== 'done';

  return (
    <Card className="backdrop-blur-xl" style={{ color: 'var(--tenant-text-primary)', borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', boxShadow: 'var(--tenant-shadow-panel)' }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4 text-tenant-accent" />
              CI Quality Gate
            </CardTitle>
            <CardDescription className="text-tenant-text-muted">
              Foxhound runs evaluators on every PR. Scores are compared against a baseline and the workflow fails if quality drops below threshold.
            </CardDescription>
          </div>
          {stage === 'done' ? (
            <Badge
              style={allPassed
                ? { background: 'color-mix(in srgb, var(--tenant-success) 14%, transparent)', color: 'var(--tenant-success)', borderColor: 'color-mix(in srgb, var(--tenant-success) 30%, transparent)' }
                : { background: 'color-mix(in srgb, var(--tenant-danger) 14%, transparent)', color: 'var(--tenant-danger)', borderColor: 'color-mix(in srgb, var(--tenant-danger) 30%, transparent)' }
              }
            >
              {allPassed ? 'Passed' : 'Failed'}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Simulated workflow YAML */}
        <pre
          className="overflow-auto rounded-lg border p-4 font-mono text-xs"
          style={{ background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-secondary)', borderColor: 'var(--tenant-panel-stroke)' }}
        >
{`# .github/workflows/quality-gate.yml
- uses: foxhound-ai/quality-gate-action@v1
  with:
    api-key: \${{ secrets.FOXHOUND_API_KEY }}
    api-endpoint: https://api.foxhound.dev
    dataset-id: ds_returns_regressions
    threshold: "0.75"
    baseline-experiment-id: exp_baseline_v17`}
        </pre>

        {/* Progress stages */}
        <div className="space-y-2">
          {(['creating', 'polling', 'comparing', 'commenting', 'done'] as SimStage[]).map((s) => {
            const isActive = s === stage;
            const isCompleted = (['creating', 'polling', 'comparing', 'commenting', 'done'].indexOf(s) <
              ['creating', 'polling', 'comparing', 'commenting', 'done'].indexOf(stage)) ||
              (stage === 'done');
            const isPending = !isActive && !isCompleted;

            return (
              <div
                key={s}
                className={cn('flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-all', isActive && 'border-tenant-accent')}
                style={{
                  borderColor: isActive ? 'var(--tenant-accent)' : 'var(--tenant-panel-stroke)',
                  background: isActive ? 'color-mix(in srgb, var(--tenant-accent) 8%, var(--card))' : 'transparent',
                  opacity: isPending ? 0.4 : 1,
                }}
              >
                {isCompleted && s !== stage ? (
                  <Check className="h-4 w-4 text-tenant-success" />
                ) : isActive && stage !== 'idle' && stage !== 'done' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-tenant-accent" />
                ) : s === 'done' && stage === 'done' ? (
                  allPassed ? <Check className="h-4 w-4 text-tenant-success" /> : <X className="h-4 w-4 text-tenant-danger" />
                ) : (
                  <div className="h-4 w-4 rounded-full border" style={{ borderColor: 'var(--tenant-panel-stroke)' }} />
                )}
                <span className="text-tenant-text-secondary">{STAGE_LABELS[s]}</span>
              </div>
            );
          })}
        </div>

        {/* Results table */}
        {results ? (
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--tenant-panel-alt)' }}>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-tenant-text-muted">Evaluator</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-tenant-text-muted">Baseline</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-tenant-text-muted">Current</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-tenant-text-muted">Delta</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-tenant-text-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
                {results.map((r) => (
                  <tr key={r.evaluator}>
                    <td className="px-3 py-2 font-mono text-tenant-text-primary">{r.evaluator}</td>
                    <td className="px-3 py-2 text-right font-mono text-tenant-text-secondary">{(r.baseline * 100).toFixed(0)}%</td>
                    <td className="px-3 py-2 text-right font-mono text-tenant-text-primary">{(r.current * 100).toFixed(0)}%</td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: r.delta >= 0 ? 'var(--tenant-success)' : 'var(--tenant-danger)' }}>
                      {r.delta >= 0 ? '+' : ''}{(r.delta * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.passed ? (
                        <Badge variant="outline" style={{ background: 'color-mix(in srgb, var(--tenant-success) 12%, transparent)', color: 'var(--tenant-success)', borderColor: 'color-mix(in srgb, var(--tenant-success) 25%, transparent)' }}>Pass</Badge>
                      ) : (
                        <Badge variant="outline" style={{ background: 'color-mix(in srgb, var(--tenant-danger) 12%, transparent)', color: 'var(--tenant-danger)', borderColor: 'color-mix(in srgb, var(--tenant-danger) 25%, transparent)' }}>Fail</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2 text-xs text-tenant-text-muted" style={{ background: 'var(--tenant-panel-alt)' }}>
              Threshold: 75% · Dataset: ds_returns_regressions (24 items) · refund-policy-compliance dropped below threshold
            </div>
          </div>
        ) : null}

        <Button onClick={runSimulation} disabled={isRunning} size="sm" className="gap-2">
          {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {isRunning ? 'Running...' : stage === 'done' ? 'Run again' : 'Simulate CI run'}
        </Button>
      </CardContent>
    </Card>
  );
}
