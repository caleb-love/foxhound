import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { DatasetsDashboard, type DatasetRecord } from '@/components/datasets/datasets-dashboard';

export default function SandboxDatasetsPage() {
  const demo = buildLocalReviewDemo();

  const datasets: DatasetRecord[] = demo.datasets.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    itemCount: d.itemCount,
    sourceTraceIds: d.sourceTraceIds,
    createdAt: new Date().toISOString(),
  }));

  return <DatasetsDashboard datasets={datasets} baseHref="/sandbox" />;
}
