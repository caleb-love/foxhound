export const SEGMENT_QUERY_KEY = 'segment';

export function readSegmentFromSearchParams(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.get(SEGMENT_QUERY_KEY);
}

export function upsertSegmentInUrl(url: string, segmentName: string | null) {
  const next = new URL(url, 'http://localhost');
  if (!segmentName || segmentName === 'All traffic') {
    next.searchParams.delete(SEGMENT_QUERY_KEY);
  } else {
    next.searchParams.set(SEGMENT_QUERY_KEY, segmentName);
  }
  return `${next.pathname}${next.search}`;
}
