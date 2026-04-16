'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStep {
  title: string;
  body: string;
  route?: string;
  highlight?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Foxhound',
    body: 'This sandbox tells a realistic story: a returns agent regressed mid-week after a prompt rollout, was detected, investigated, and recovered. Walk through the key surfaces in 60 seconds.',
  },
  {
    title: 'Fleet Overview',
    body: 'The command surface shows platform posture at a glance: active agents, open regressions, modeled spend, and operator focus items. Start here every morning.',
    route: '/sandbox',
  },
  {
    title: 'Traces',
    body: '568 seeded traces across 7 days of realistic operations. Filter by agent, status, or time range. Each trace links to replay, diff, and prompt investigation.',
    route: '/sandbox/traces',
  },
  {
    title: 'Run Diff',
    body: 'Compare two agent runs side by side. See exactly where latency, cost, and behavior diverged. This is how you find the root cause.',
    route: '/sandbox/diff?a=trace_returns_exception_v17_baseline&b=trace_returns_exception_v18_regression',
  },
  {
    title: 'Session Replay',
    body: 'Step through an execution span by span. Watch state evolve, catch the exact moment behavior changed, then jump into diff or prompt review.',
    route: '/sandbox/replay/trace_returns_exception_v18_regression',
  },
  {
    title: 'Regressions',
    body: 'Foxhound detects behavior drift by agent version. This page shows active regressions with linked traces, diffs, and prompt context.',
    route: '/sandbox/regressions',
  },
  {
    title: 'Experiments',
    body: 'Validate recovery candidates with dataset-backed experiments before promoting. The hero story shows support-reply v19 recovering the flagship workflow.',
    route: '/sandbox/experiments',
  },
  {
    title: 'Budgets and SLAs',
    body: 'Set cost budgets and latency/reliability SLAs per agent. Get alerted before thresholds are breached, not after.',
    route: '/sandbox/budgets',
  },
];

export function GuidedTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();

  const step = TOUR_STEPS[currentStep]!;
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const close = useCallback(() => {
    setIsOpen(false);
    router.push('/sandbox');
  }, [router]);

  const next = useCallback(() => {
    if (isLast) {
      close();
      return;
    }
    const nextStep = TOUR_STEPS[currentStep + 1];
    if (nextStep?.route) {
      router.push(nextStep.route);
    }
    setCurrentStep((s) => s + 1);
  }, [currentStep, isLast, close, router]);

  const prev = useCallback(() => {
    if (isFirst) return;
    const prevStep = TOUR_STEPS[currentStep - 1];
    if (prevStep?.route) {
      router.push(prevStep.route);
    }
    setCurrentStep((s) => s - 1);
  }, [currentStep, isFirst, router]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close, next, prev]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setCurrentStep(0);
          setIsOpen(true);
          router.push('/sandbox');
        }}
        className="fixed bottom-6 right-6 z-50 flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-medium shadow-lg backdrop-blur-xl transition-all hover:scale-105"
        style={{
          borderColor: 'var(--tenant-panel-stroke)',
          background: 'var(--card)',
          color: 'var(--tenant-text-secondary)',
        }}
        aria-label="Start guided tour"
      >
        <Sparkles className="h-3.5 w-3.5 text-tenant-accent" />
        Tour
      </button>
    );
  }

  return (
    <>
      {/* Tour card */}
      <div
        className="fixed bottom-8 left-1/2 z-[61] w-full max-w-lg -translate-x-1/2 rounded-2xl border p-6 shadow-2xl backdrop-blur-xl"
        style={{
          borderColor: 'var(--tenant-panel-stroke)',
          background: 'var(--card)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px var(--tenant-panel-stroke)',
        }}
      >
        {/* Step indicator */}
        <div className="mb-4 flex items-center gap-1.5">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={cn('h-1 rounded-full transition-all duration-300', i === currentStep ? 'w-6' : 'w-1.5')}
              style={{
                background: i === currentStep
                  ? 'var(--tenant-accent)'
                  : i < currentStep
                    ? 'var(--tenant-accent)'
                    : 'var(--border)',
                opacity: i <= currentStep ? 1 : 0.4,
              }}
            />
          ))}
          <span className="ml-auto text-xs tabular-nums text-tenant-text-muted">
            {currentStep + 1} / {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={close}
            className="ml-2 rounded-lg p-1 transition-colors hover:bg-muted"
            style={{ color: 'var(--tenant-text-muted)' }}
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-tenant-text-primary">
          {step.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-tenant-text-secondary">
          {step.body}
        </p>

        {/* Navigation */}
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={close}
            className="text-xs font-medium transition-colors"
            style={{ color: 'var(--tenant-text-muted)' }}
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirst ? (
              <button
                type="button"
                onClick={prev}
                className="flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--tenant-panel-stroke)', color: 'var(--tenant-text-primary)' }}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={next}
              className="flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-all hover:brightness-110"
              style={{
                background: 'var(--tenant-accent)',
                color: 'var(--background, #0B1120)',
              }}
            >
              {isLast ? 'Finish' : 'Next'}
              {!isLast ? <ChevronRight className="h-3.5 w-3.5" /> : null}
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <div className="mt-3 text-center text-[10px] text-tenant-text-muted">
          ← → to navigate · Esc to close
        </div>
      </div>
    </>
  );
}
