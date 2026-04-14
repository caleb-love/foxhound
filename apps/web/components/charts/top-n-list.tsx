import { ChartPanel, ChartRecord } from './chart-shell';
import type { TopListItem } from './chart-types';

export function TopNList({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: TopListItem[];
}) {
  return (
    <ChartPanel title={title} description={description}>
      {items.map((item) => (
        <ChartRecord
          key={item.title}
          title={item.title}
          description={item.description}
          status={item.status}
          href={item.href}
          cta={item.href ? 'Open' : undefined}
          badge={item.badge}
          meta={item.metric}
        />
      ))}
    </ChartPanel>
  );
}
