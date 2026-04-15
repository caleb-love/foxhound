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

export function CreatePromptDialog({
  createPromptAction,
}: {
  createPromptAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Create prompt</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create prompt</DialogTitle>
          <DialogDescription>
            Add a new prompt family so you can start versioning, comparing, and connecting prompt changes back to traces and release decisions.
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
              const result = await createPromptAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to create prompt right now.');
                return;
              }
              setSuccessMessage('Prompt created. Refreshing prompt catalog…');
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="prompt-name">Prompt name</Label>
            <Input id="prompt-name" name="name" required placeholder="support-routing" />
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create prompt'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreatePromptVersionDialog({
  createPromptVersionAction,
}: {
  createPromptVersionAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Create version</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create prompt version</DialogTitle>
          <DialogDescription>
            Add a new version to this prompt family so you can compare it against earlier versions and connect changes back to traces, experiments, and release decisions.
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
              const result = await createPromptVersionAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to create prompt version right now.');
                return;
              }
              setSuccessMessage('Prompt version created. Refreshing version history…');
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="prompt-model">Model (optional)</Label>
            <Input id="prompt-model" name="model" placeholder="gpt-4o-mini" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prompt-content">Prompt content</Label>
            <Textarea id="prompt-content" name="content" required placeholder="You are a support routing system..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prompt-config">Config JSON (optional)</Label>
            <Textarea id="prompt-config" name="config" placeholder='{"temperature": 0.2}' />
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create version'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
