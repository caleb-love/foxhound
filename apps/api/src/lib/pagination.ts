export function paginatedResponse<T>(data: T[], page: number, limit: number, count: number) {
  return {
    data,
    pagination: {
      page,
      limit,
      count,
    },
  };
}
