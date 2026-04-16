import { ChartPanel, ChartRecord } from './chart-shell';
import type { ChartStatusTone } from './chart-types';

export interface ComparisonScorecardItem {
  label: string;
  current: string;
  supportingText: string;
  tone?: ChartStatusTone;
}

export function ComparisonScorecard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: ComparisonScorecardItem[];
}) {
  return (
    <ChartPanel title={title} description={description}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <ChartRecord
            key={item.label}
            title={item.label}
            status={item.tone}
            description={
              <div>
                <div className="text-base font-semibold text-tenant-text-primary">{item.current}</div>
                <div className="mt-1 text-sm text-tenant-text-secondary">{item.supportingText}</div>
              </div>
            }
          />
        ))}
      </div>
    </ChartPanel>
  );
}
