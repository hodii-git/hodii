import { useRouterState } from "@tanstack/react-router";

/** Search params for a link to /auth that brings the person back to the page they are on (and what they were about to do there). */
export function useAuthReturn(): { redirect?: string } {
  const href = useRouterState({ select: (s) => s.location.href });
  return href.startsWith("/auth") || href === "/" ? {} : { redirect: href };
}
