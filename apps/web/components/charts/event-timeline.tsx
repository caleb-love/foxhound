import { ChartPanel, ChartRecord } from './chart-shell';
import type { TimelineItem } from './chart-types';

export function EventTimeline({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: TimelineItem[];
}) {
  return (
    <ChartPanel title={title} description={description}>
      {items.map((item) => (
        <ChartRecord
          key={`${item.title}-${item.meta ?? item.description}`}
          title={item.title}
          description={item.description}
          status={item.status}
          meta={item.meta}
          href={item.href}
          cta={item.cta}
        />
      ))}
    </ChartPanel>
  );
}
