import { useEffect, type RefObject } from "react";

/**
 * Fixed sidebars scroll on their own, but only after the page itself has
 * scrolled all the way down (so the footer is reached first). Until then the
 * wheel is handed to the page.
 */
export function useSidebarScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      const canScroll = el.scrollHeight > el.clientHeight + 1;
      if (!canScroll) return;
      const doc = document.documentElement;
      const pageAtEnd = window.scrollY + window.innerHeight >= doc.scrollHeight - 2;
      const atTop = el.scrollTop <= 0;
      if (e.deltaY > 0 && !pageAtEnd) { e.preventDefault(); window.scrollBy({ top: e.deltaY }); return; }
      if (e.deltaY < 0 && atTop) { e.preventDefault(); window.scrollBy({ top: e.deltaY }); }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
}
