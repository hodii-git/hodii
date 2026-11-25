import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Keeps the floating buttons (List/Map, Feedback, Guide) from sitting on top of the footer.
 * As the footer scrolls into view they ride up with its top edge, and once it takes over most of the screen they fade away.
 * Sets --lift (px) and data-footer-near on <html>; the buttons read them in styles.css.
 */
export function FloatLift() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const run = () => {
      raf = 0;
      const foot = document.querySelector("footer");
      const vh = window.innerHeight;
      const top = foot ? foot.getBoundingClientRect().top : vh;
      const lift = Math.max(0, vh - top);
      root.style.setProperty("--lift", `${Math.min(lift, vh)}px`);
      if (lift > vh * 0.55) root.setAttribute("data-footer-near", ""); else root.removeAttribute("data-footer-near");
    };
    const tick = () => { if (!raf) raf = requestAnimationFrame(run); };
    run();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    const ro = new ResizeObserver(tick); ro.observe(document.body);
    return () => { window.removeEventListener("scroll", tick); window.removeEventListener("resize", tick); ro.disconnect(); if (raf) cancelAnimationFrame(raf); root.style.removeProperty("--lift"); root.removeAttribute("data-footer-near"); };
  }, [path]);
  return null;
}
