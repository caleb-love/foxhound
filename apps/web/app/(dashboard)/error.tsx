'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-md space-y-4 rounded-lg border bg-white p-8 text-center shadow-lg">
        <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-600">
          We encountered an error while loading this page.
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <pre className="mt-4 rounded bg-gray-100 p-4 text-left text-xs overflow-auto max-h-40">
            {error.message}
          </pre>
        )}
        <div className="flex flex-col gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
          >
            Return to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
