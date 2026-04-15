'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type ActionResult = {
  ok: boolean;
  error?: string;
};

export function CompareRegressionDialog({
  baselines,
  compareRegressionAction,
}: {
  baselines: Array<{ agentId: string; version: string }>;
  compareRegressionAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const uniqueAgents = Array.from(new Set(baselines.map((baseline) => baseline.agentId))).sort();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Compare versions</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Compare regression baselines</DialogTitle>
          <DialogDescription>
            Choose an agent and two baseline versions to inspect structural behavior drift using the real regression comparison API.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await compareRegressionAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to compare regressions right now.');
                return;
              }
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="regression-agent-id">Agent</Label>
            <select id="regression-agent-id" name="agentId" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
              <option value="">Select agent</option>
              {uniqueAgents.map((agentId) => (
                <option key={agentId} value={agentId}>{agentId}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-2 md:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="version-a">Baseline version</Label>
              <select id="version-a" name="versionA" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
                <option value="">Select baseline</option>
                {baselines.map((baseline) => (
                  <option key={`${baseline.agentId}-${baseline.version}-a`} value={baseline.version}>{baseline.agentId} · {baseline.version}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="version-b">Comparison version</Label>
              <select id="version-b" name="versionB" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
                <option value="">Select comparison</option>
                {baselines.map((baseline) => (
                  <option key={`${baseline.agentId}-${baseline.version}-b`} value={baseline.version}>{baseline.agentId} · {baseline.version}</option>
                ))}
              </select>
            </div>
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending || baselines.length < 2}>{isPending ? 'Comparing…' : 'Run comparison'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
