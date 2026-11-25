/** Optional filters toggle off; required fields retain the selected value. */
export function filterSelection(current: string, next: string, optional: boolean): string {
  return optional && current === next ? "" : next;
}