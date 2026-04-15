'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ActionResult = {
  ok: boolean;
  error?: string;
};

export function SetPromptLabelDialog({
  availableVersions,
  setPromptLabelAction,
}: {
  availableVersions: number[];
  setPromptLabelAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Set label</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set prompt label</DialogTitle>
          <DialogDescription>
            Assign a stable label such as production or staging to a specific prompt version so release decisions become explicit and auditable.
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
              const result = await setPromptLabelAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to set prompt label right now.');
                return;
              }
              setSuccessMessage('Prompt label updated. Refreshing release posture…');
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="prompt-label">Label</Label>
            <Input id="prompt-label" name="label" required placeholder="production" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prompt-version-number">Version</Label>
            <select id="prompt-version-number" name="versionNumber" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
              <option value="">Select version</option>
              {availableVersions.map((version) => (
                <option key={version} value={String(version)}>v{version}</option>
              ))}
            </select>
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending || availableVersions.length === 0}>{isPending ? 'Saving…' : 'Set label'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
