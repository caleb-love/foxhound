'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type ActionResult = {
  ok: boolean;
  error?: string;
};

export function CreateDatasetDialog({
  createDatasetAction,
}: {
  createDatasetAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Create dataset</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create dataset</DialogTitle>
          <DialogDescription>
            Add a reusable dataset so production traces can be turned into evaluation coverage and experiment inputs.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setSuccessMessage(null);
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await createDatasetAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to create dataset right now.');
                return;
              }
              setSuccessMessage('Dataset created. Refreshing dataset inventory…');
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="dataset-name">Dataset name</Label>
            <Input id="dataset-name" name="name" required placeholder="support-routing-regressions" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dataset-description">Description</Label>
            <Textarea id="dataset-description" name="description" placeholder="Explain what evidence this dataset captures and why it matters." />
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create dataset'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateEvaluatorDialog({
  createEvaluatorAction,
}: {
  createEvaluatorAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Create evaluator</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create evaluator</DialogTitle>
          <DialogDescription>
            Define a new scoring template so traces and experiments can be reviewed with a reusable judge configuration.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setSuccessMessage(null);
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await createEvaluatorAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to create evaluator right now.');
                return;
              }
              setSuccessMessage('Evaluator created. Refreshing evaluator inventory…');
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2 md:grid-cols-2 md:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="evaluator-name">Evaluator name</Label>
              <Input id="evaluator-name" name="name" required placeholder="helpfulness-judge" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="evaluator-model">Model</Label>
              <Input id="evaluator-model" name="model" required placeholder="gpt-4o-mini" />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 md:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="evaluator-scoring-type">Scoring type</Label>
              <select id="evaluator-scoring-type" name="scoringType" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="numeric">numeric</option>
                <option value="categorical">categorical</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="evaluator-labels">Labels (comma separated, optional)</Label>
              <Input id="evaluator-labels" name="labels" placeholder="correct, incorrect, partial" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="evaluator-prompt-template">Prompt template</Label>
            <Textarea id="evaluator-prompt-template" name="promptTemplate" required placeholder="You are grading an agent run. Return a numeric score between 0 and 1..." />
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create evaluator'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CurateDatasetFromTracesDialog({
  datasets,
  curateDatasetAction,
}: {
  datasets: Array<{ id: string; name: string }>;
  curateDatasetAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Curate from traces</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Curate dataset from traces</DialogTitle>
          <DialogDescription>
            Pull production traces into a dataset using a score threshold so you can build reusable evaluation coverage from real failures or low-scoring runs.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setSuccessMessage(null);
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await curateDatasetAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to curate dataset items right now.');
                return;
              }
              setSuccessMessage('Dataset curation started. Refreshing evidence inventory…');
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="curate-dataset-id">Dataset</Label>
            <select id="curate-dataset-id" name="datasetId" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
              <option value="">Select dataset</option>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-3 md:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="score-name">Score name</Label>
              <Input id="score-name" name="scoreName" required placeholder="helpfulness" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="score-operator">Operator</Label>
              <select id="score-operator" name="scoreOperator" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="lt">lt</option>
                <option value="lte">lte</option>
                <option value="gt">gt</option>
                <option value="gte">gte</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="score-threshold">Threshold</Label>
              <Input id="score-threshold" name="scoreThreshold" type="number" step="0.01" required placeholder="0.6" />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 md:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="since-days">Since days</Label>
              <Input id="since-days" name="sinceDays" type="number" min="1" placeholder="7" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="curation-limit">Limit</Label>
              <Input id="curation-limit" name="limit" type="number" min="1" max="500" placeholder="100" />
            </div>
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending || datasets.length === 0}>{isPending ? 'Curating…' : 'Curate dataset'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TriggerEvaluatorRunsDialog({
  evaluators,
  triggerEvaluatorRunsAction,
}: {
  evaluators: Array<{ id: string; name: string }>;
  triggerEvaluatorRunsAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Trigger runs</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Trigger evaluator runs</DialogTitle>
          <DialogDescription>
            Queue evaluator runs against one or more traces so you can turn production evidence into fresh scoring output.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setSuccessMessage(null);
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await triggerEvaluatorRunsAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to trigger evaluator runs right now.');
                return;
              }
              setSuccessMessage('Evaluator runs queued. Refreshing evaluator posture…');
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="trigger-evaluator-id">Evaluator</Label>
            <select id="trigger-evaluator-id" name="evaluatorId" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
              <option value="">Select evaluator</option>
              {evaluators.map((evaluator) => (
                <option key={evaluator.id} value={evaluator.id}>{evaluator.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="trace-ids">Trace IDs (comma separated)</Label>
            <Textarea id="trace-ids" name="traceIds" required placeholder="trace_123, trace_456" />
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending || evaluators.length === 0}>{isPending ? 'Queueing…' : 'Trigger runs'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateExperimentDialog({
  datasets,
  createExperimentAction,
}: {
  datasets: Array<{ id: string; name: string }>;
  createExperimentAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Create experiment</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create experiment</DialogTitle>
          <DialogDescription>
            Launch a new experiment against an existing dataset so you can compare candidate prompt or routing behavior against real evaluation cases.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setSuccessMessage(null);
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await createExperimentAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to create experiment right now.');
                return;
              }
              setSuccessMessage('Experiment created. Refreshing experiment workbench…');
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="experiment-name">Experiment name</Label>
            <Input id="experiment-name" name="name" required placeholder="support-routing-v13-candidate" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="experiment-dataset">Dataset</Label>
            <select id="experiment-dataset" name="datasetId" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
              <option value="">Select dataset</option>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="experiment-config">Experiment config JSON</Label>
            <Textarea id="experiment-config" name="config" required placeholder='{"candidatePromptVersion": 13, "baselinePromptVersion": 12}' />
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending || datasets.length === 0}>{isPending ? 'Creating…' : 'Create experiment'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
