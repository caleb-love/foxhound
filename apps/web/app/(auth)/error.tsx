'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Auth error:', error);
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          Authentication Error
        </h2>
        <p className="text-sm text-gray-600">
          We encountered an error during authentication.
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
            Return home
          </Button>
        </div>
      </div>
    </div>
  );
}
