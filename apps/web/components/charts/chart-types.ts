import type { ReactNode } from "react";

export type ChartStatusTone = "default" | "healthy" | "warning" | "critical";

export interface SparkPoint {
  value: number;
  label?: string;
}

export interface MetricTileData {
  label: string;
  value: string;
  supportingText?: string;
  delta?: string;
  tone?: ChartStatusTone;
  sparklineData?: SparkPoint[];
  href?: string;
}

export interface TrendSeriesPoint {
  label: string;
  value: number;
}

export interface TrendSeries {
  id: string;
  label: string;
  values: TrendSeriesPoint[];
  tone?: Exclude<ChartStatusTone, "default">;
}

export interface TopListItem {
  title: string;
  description?: string;
  metric?: string;
  status?: ChartStatusTone;
  href?: string;
  badge?: ReactNode;
}

export interface TimelineItem {
  title: string;
  description: string;
  status?: ChartStatusTone;
  meta?: string;
  href?: string;
  cta?: string;
}
