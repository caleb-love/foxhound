import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { ExperimentsDashboard, type ExperimentRecord } from '@/components/experiments/experiments-dashboard';

export default function SandboxExperimentsPage() {
  const demo = buildLocalReviewDemo();

  const experiments: ExperimentRecord[] = demo.experiments.map((e) => ({
    id: e.id,
    name: e.name,
    datasetId: e.datasetId,
    status: e.status,
    summary: e.summary,
    winningCandidate: e.winningCandidate,
  }));

  return <ExperimentsDashboard experiments={experiments} baseHref="/sandbox" />;
}
