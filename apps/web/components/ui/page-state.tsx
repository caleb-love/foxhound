import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface PageStateProps {
  title: string;
  message: string;
  detail?: string;
  tone?: 'default' | 'warning' | 'error';
}

const toneClasses: Record<NonNullable<PageStateProps['tone']>, string> = {
  default: 'border-border bg-background',
  warning: 'border-yellow-200 bg-yellow-50',
  error: 'border-red-200 bg-red-50',
};

const detailClasses: Record<NonNullable<PageStateProps['tone']>, string> = {
  default: 'text-muted-foreground',
  warning: 'text-yellow-700',
  error: 'text-red-700',
};

export function PageState({
  title,
  message,
  detail,
  tone = 'default',
}: PageStateProps) {
  return (
    <Card className={toneClasses[tone]}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="text-foreground/80">{message}</CardDescription>
      </CardHeader>
      {detail ? (
        <CardContent>
          <p className={`text-xs ${detailClasses[tone]}`}>{detail}</p>
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
