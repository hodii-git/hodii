/** How long a staff queue item has waited, against the target set in admin Settings. */
export type Wait = { hours: number; overdue: boolean; label: string };

export function waiting(since: string | Date | null | undefined, slaHours: number, now = Date.now()): Wait {
  const t = since ? new Date(since).getTime() : now;
  const hours = Math.max(0, Math.floor((now - t) / 3_600_000));
  const label = hours < 1 ? "under an hour" : hours < 48 ? `${hours} hour${hours === 1 ? "" : "s"}` : `${Math.floor(hours / 24)} days`;
  return { hours, overdue: slaHours > 0 && hours >= slaHours, label };
}
