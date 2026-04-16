'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useExperimentCompareStore } from '@/lib/stores/experiment-compare-store';

type ExperimentOption = {
  id: string;
  name: string;
  status: string;
};

export function CompareExperimentsDialog({
  experiments,
  baseHref = '',
}: {
  experiments: ExperimentOption[];
  baseHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const completedExperiments = experiments.filter((experiment) => experiment.status === 'completed');
  const baselineExperimentId = useExperimentCompareStore((state) => state.baselineExperimentId);
  const candidateExperimentId = useExperimentCompareStore((state) => state.candidateExperimentId);
  const setPair = useExperimentCompareStore((state) => state.setPair);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Compare experiments</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Compare experiments</DialogTitle>
          <DialogDescription>
            Choose a baseline and a candidate experiment to inspect side-by-side run output, score coverage, and promotion posture in the comparison workspace.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            const formData = new FormData(event.currentTarget);
            const baselineId = String(formData.get('baselineExperimentId') ?? '');
            const candidateId = String(formData.get('candidateExperimentId') ?? '');

            if (!baselineId || !candidateId) {
              setError('Choose both a baseline experiment and a candidate experiment.');
              return;
            }

            if (baselineId === candidateId) {
              setError('Choose two different experiments for comparison.');
              return;
            }

            startTransition(async () => {
              setPair(baselineId, candidateId);
              setOpen(false);
              router.push(`${baseHref}/experiments/compare?experimentIds=${encodeURIComponent(`${baselineId},${candidateId}`)}`);
            });
          }}
        >
          <div className="grid gap-2 md:grid-cols-2 md:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="baseline-experiment-id">Baseline experiment</Label>
              <select id="baseline-experiment-id" name="baselineExperimentId" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" defaultValue={baselineExperimentId ?? ''} required>
                <option value="">Select baseline</option>
                {completedExperiments.map((experiment) => (
                  <option key={`${experiment.id}-baseline`} value={experiment.id}>{experiment.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="candidate-experiment-id">Candidate experiment</Label>
              <select id="candidate-experiment-id" name="candidateExperimentId" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" defaultValue={candidateExperimentId ?? ''} required>
                <option value="">Select candidate</option>
                {completedExperiments.map((experiment) => (
                  <option key={`${experiment.id}-candidate`} value={experiment.id}>{experiment.name}</option>
                ))}
              </select>
            </div>
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending || completedExperiments.length < 2}>
              {isPending ? 'Opening…' : 'Open comparison'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
