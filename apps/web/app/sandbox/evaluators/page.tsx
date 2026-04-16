import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { EvaluatorsDashboard, type EvaluatorRecord } from '@/components/evaluators/evaluators-dashboard';

export default function SandboxEvaluatorsPage() {
  const demo = buildLocalReviewDemo();

  const evaluators: EvaluatorRecord[] = demo.evaluators.map((e) => ({
    id: e.id,
    name: e.name,
    scoringType: e.scoringType,
    model: e.model,
    health: e.health,
    summary: e.summary,
    updatedAt: new Date().toISOString(),
  }));

  return <EvaluatorsDashboard evaluators={evaluators} baseHref="/sandbox" />;
}
