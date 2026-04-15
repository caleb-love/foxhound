import { PremiumActionLink, PremiumActions, PremiumMetricCard } from '@/components/sandbox/primitives';
import type { MetricTileData } from './chart-types';

export function MetricTile({ label, value, supportingText, href }: MetricTileData) {
  return (
    <div className="flex h-full flex-col gap-3">
      <PremiumMetricCard className="h-full" label={label} value={value} supportingText={supportingText ?? ''} />
      {href ? (
        <PremiumActions>
          <PremiumActionLink href={href}>Open</PremiumActionLink>
        </PremiumActions>
      ) : null}
    </div>
  );
}
