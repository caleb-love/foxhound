import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface PageStateProps {
  title: string;
  message: string;
  detail?: string;
  tone?: 'default' | 'warning' | 'error';
}

const toneStyles: Record<NonNullable<PageStateProps['tone']>, React.CSSProperties> = {
  default: { borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' },
  warning: { borderColor: 'color-mix(in srgb, var(--tenant-warning) 24%, white)', background: 'color-mix(in srgb, var(--tenant-warning) 10%, white)' },
  error: { borderColor: 'color-mix(in srgb, var(--tenant-danger) 24%, white)', background: 'color-mix(in srgb, var(--tenant-danger) 10%, white)' },
};

const detailStyles: Record<NonNullable<PageStateProps['tone']>, React.CSSProperties> = {
  default: { color: 'var(--tenant-text-muted)' },
  warning: { color: 'var(--tenant-warning)' },
  error: { color: 'var(--tenant-danger)' },
};

export function PageState({
  title,
  message,
  detail,
  tone = 'default',
}: PageStateProps) {
  return (
    <Card style={toneStyles[tone]}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription style={{ color: 'var(--tenant-text-secondary)' }}>{message}</CardDescription>
      </CardHeader>
      {detail ? (
        <CardContent>
          <p className="text-xs" style={detailStyles[tone]}>{detail}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function PageErrorState(props: Omit<PageStateProps, 'tone'>) {
  return <PageState {...props} tone="error" />;
}

export function PageWarningState(props: Omit<PageStateProps, 'tone'>) {
  return <PageState {...props} tone="warning" />;
}
