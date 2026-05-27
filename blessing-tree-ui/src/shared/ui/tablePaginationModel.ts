export function clampTablePage(page: number, totalItems: number, pageSize: number): number {
  return Math.min(Math.max(page, 1), Math.max(1, Math.ceil(totalItems / pageSize)));
}
