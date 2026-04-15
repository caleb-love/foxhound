import { PremiumActionLink, PremiumActions, PremiumMetricCard } from '@/components/sandbox/primitives';
import type { MetricTileData } from './chart-types';

export function MetricTile({ label, value, supportingText, href }: MetricTileData) {
  return (
    <div className="space-y-3">
      <PremiumMetricCard label={label} value={value} supportingText={supportingText ?? ''} />
      {href ? (
        <PremiumActions>
          <PremiumActionLink href={href}>Open</PremiumActionLink>
        </PremiumActions>
      ) : null}
    </div>
  );
}
