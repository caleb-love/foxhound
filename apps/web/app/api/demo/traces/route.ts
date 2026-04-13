/**
 * Demo API endpoint for testing the dashboard without a real API server
 */

import { NextResponse } from 'next/server';
import { DEMO_TRACES } from '@/lib/demo-data-advanced';

export async function GET() {
  // Return first 50 traces from the 100 generated
  const traces = DEMO_TRACES.slice(0, 50);
  
  return NextResponse.json({
    data: traces,
    pagination: {
      page: 1,
      limit: 50,
      count: traces.length,
    },
  });
}
