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

export function ConfigureBudgetDialog({
  configureBudgetAction,
}: {
  configureBudgetAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Configure budget</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Configure budget</DialogTitle>
          <DialogDescription>
            Set a cost budget for an agent workflow so spend spikes can be tracked and governed directly from the console.
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
              const result = await configureBudgetAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to configure budget right now.');
                return;
              }
              setSuccessMessage('Budget saved. Refreshing governance posture…');
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="budget-agent-id">Agent id</Label>
            <Input id="budget-agent-id" name="agentId" required placeholder="planner-agent" />
          </div>
          <div className="grid gap-2 md:grid-cols-3 md:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cost-budget-usd">Budget USD</Label>
              <Input id="cost-budget-usd" name="costBudgetUsd" type="number" step="0.01" required placeholder="300" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cost-alert-threshold-pct">Alert threshold %</Label>
              <Input id="cost-alert-threshold-pct" name="costAlertThresholdPct" type="number" min="1" max="100" placeholder="80" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="budget-period">Budget period</Label>
              <select id="budget-period" name="budgetPeriod" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="monthly">monthly</option>
                <option value="weekly">weekly</option>
                <option value="daily">daily</option>
              </select>
            </div>
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : 'Save budget'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfigureSlaDialog({
  configureSlaAction,
}: {
  configureSlaAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Configure SLA</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Configure SLA</DialogTitle>
          <DialogDescription>
            Set latency and reliability guardrails for an agent workflow so breach risk can be inspected against real traces and replay paths.
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
              const result = await configureSlaAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to configure SLA right now.');
                return;
              }
              setSuccessMessage('SLA saved. Refreshing reliability posture…');
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="sla-agent-id">Agent id</Label>
            <Input id="sla-agent-id" name="agentId" required placeholder="planner-agent" />
          </div>
          <div className="grid gap-2 md:grid-cols-2 md:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="max-duration-ms">Max duration ms</Label>
              <Input id="max-duration-ms" name="maxDurationMs" type="number" min="1" placeholder="3000" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="min-success-rate">Min success rate (0-1)</Label>
              <Input id="min-success-rate" name="minSuccessRate" type="number" min="0" max="1" step="0.01" placeholder="0.97" />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 md:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="evaluation-window-ms">Evaluation window ms</Label>
              <Input id="evaluation-window-ms" name="evaluationWindowMs" type="number" min="1" placeholder="86400000" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="min-sample-size">Min sample size</Label>
              <Input id="min-sample-size" name="minSampleSize" type="number" min="1" placeholder="10" />
            </div>
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : 'Save SLA'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateNotificationChannelDialog({
  createNotificationChannelAction,
}: {
  createNotificationChannelAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Create channel</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create notification channel</DialogTitle>
          <DialogDescription>
            Add a new Slack notification channel so alerts can be routed to the right operational owners.
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
              const result = await createNotificationChannelAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to create notification channel right now.');
                return;
              }
              setSuccessMessage('Notification channel created. Refreshing routing inventory…');
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="channel-name">Channel name</Label>
            <Input id="channel-name" name="name" required placeholder="ops-slack" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="webhook-url">Slack webhook URL</Label>
            <Input id="webhook-url" name="webhookUrl" required placeholder="https://hooks.slack.com/services/..." />
          </div>
          <div className="grid gap-2 md:grid-cols-2 md:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="channel-slug">Slack channel (optional)</Label>
              <Input id="channel-slug" name="channel" placeholder="#ops-alerts" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dashboard-base-url">Dashboard base URL (optional)</Label>
              <Input id="dashboard-base-url" name="dashboardBaseUrl" placeholder="https://app.example.com" />
            </div>
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create channel'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateNotificationRuleDialog({
  channels,
  createNotificationRuleAction,
}: {
  channels: Array<{ id: string; name: string }>;
  createNotificationRuleAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Create rule</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create alert rule</DialogTitle>
          <DialogDescription>
            Route a specific alert event and severity threshold to one of your configured notification channels.
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
              const result = await createNotificationRuleAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to create alert rule right now.');
                return;
              }
              setSuccessMessage('Alert rule created. Refreshing routing posture…');
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="rule-channel-id">Channel</Label>
            <select id="rule-channel-id" name="channelId" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
              <option value="">Select channel</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>{channel.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-2 md:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="event-type">Event type</Label>
              <select id="event-type" name="eventType" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="agent_failure">agent_failure</option>
                <option value="anomaly_detected">anomaly_detected</option>
                <option value="cost_spike">cost_spike</option>
                <option value="compliance_violation">compliance_violation</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="min-severity">Minimum severity</Label>
              <select id="min-severity" name="minSeverity" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </div>
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending || channels.length === 0}>{isPending ? 'Creating…' : 'Create rule'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TestNotificationDialog({
  channels,
  testNotificationAction,
}: {
  channels: Array<{ id: string; name: string }>;
  testNotificationAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Send test</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Send test notification</DialogTitle>
          <DialogDescription>
            Send a live test notification through one configured channel to verify routing and delivery before the next real incident.
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
              const result = await testNotificationAction(formData);
              if (!result.ok) {
                setError(result.error ?? 'Unable to send test notification right now.');
                return;
              }
              setSuccessMessage('Test notification sent. Refreshing channel posture…');
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="test-channel-id">Channel</Label>
            <select id="test-channel-id" name="channelId" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
              <option value="">Select channel</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>{channel.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-2 md:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="test-event-type">Event type</Label>
              <select id="test-event-type" name="eventType" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="agent_failure">agent_failure</option>
                <option value="anomaly_detected">anomaly_detected</option>
                <option value="cost_spike">cost_spike</option>
                <option value="compliance_violation">compliance_violation</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="test-severity">Severity</Label>
              <select id="test-severity" name="severity" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </div>
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-500">{successMessage}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending || channels.length === 0}>{isPending ? 'Sending…' : 'Send test'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
