import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, Heart, Home, MessageCircle, UserRound } from "lucide-react";
import { getTabBadges } from "@/lib/notifications.functions";
import { useAuthReturn } from "@/lib/auth-return";
import { useAuth } from "@/hooks/use-auth";
import { isSearchPage, setSheet, toggleSheet, useSheetOpen } from "@/lib/search-sheet";

/**
 * Phone-only bottom bar used across the whole app: Home, Explore, Saved, Inquiries, Profile. It slides away when you scroll down
 * and comes back as soon as you scroll up (it stays put on listing pages, where the action dock sits above it).
 */
export function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const signedIn = !!user;
  const [hidden, setHidden] = useState(false);
  const sheet = useSheetOpen();
  const back = useAuthReturn();
  useEffect(() => { if (!isSearchPage(path)) setSheet(false); }, [path]);
  const last = useRef(0);
  const nav = useRef<HTMLElement>(null);
  /** The keyboard covers the page instead of pushing the bar up; --kb tells the search sheet how high the keyboard is so it can rest on top of it. */
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return;
    const root = document.documentElement;
    const f = () => { const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); root.style.setProperty("--kb", kb > 120 ? `${Math.round(kb)}px` : "0px"); };
    f(); vv.addEventListener("resize", f); vv.addEventListener("scroll", f);
    return () => { vv.removeEventListener("resize", f); vv.removeEventListener("scroll", f); root.style.removeProperty("--kb"); };
  }, []);
  useEffect(() => {
    last.current = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      const d = y - last.current;
      if (Math.abs(d) < 8) return;
      setHidden(d > 0 && y > 80);
      last.current = y;
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { setHidden(false); }, [path]);
  const isListing = path.startsWith("/property/");
  const hide = hidden && !sheet && !isListing;
  useEffect(() => {
    const shown = !hide;
    const root = document.documentElement;
    root.dataset["tabbar"] = shown ? "shown" : "hidden";
    // The real height of the bar (it differs by phone and by safe area), so nothing floats behind it or leaves a gap above it.
    const set = () => root.style.setProperty("--tab-h", shown ? `${nav.current?.offsetHeight ?? 58}px` : "0px");
    set();
    const ro = typeof ResizeObserver !== "undefined" && nav.current ? new ResizeObserver(set) : null;
    if (ro && nav.current) ro.observe(nav.current);
    return () => { ro?.disconnect(); root.style.removeProperty("--tab-h"); delete root.dataset["tabbar"]; };
  }, [hide]);

  const isPropertyPage = path.startsWith("/property/");
  const badges = useQuery({ queryKey: ["saved", "tab-badges", user?.id ?? null], queryFn: () => getTabBadges(), enabled: signedIn, refetchInterval: 30_000, refetchOnWindowFocus: true, staleTime: 10_000 }).data;
  const savedCount = signedIn ? badges?.saved ?? 0 : 0;
  const hasEnquiryNotes = signedIn && (badges?.enquiries ?? 0) > 0;

  // On a listing page the person is looking at one property, so no tab is lit.
  const on = {
    home: !isPropertyPage && path === "/",
    explore: !isPropertyPage && (path.startsWith("/properties") || sheet),
    saved: !isPropertyPage && path.startsWith("/saved"),
    inquiries: !isPropertyPage && path.startsWith("/notifications"),
    profile: !isPropertyPage && (path.startsWith("/profile") || path.startsWith("/auth")),
  };
  const item = (active: boolean) => `flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1.5 text-[0.7rem] font-medium transition-colors ${active ? "text-primary" : "text-zinc-400 hover:text-zinc-200"}`;
  const ico = (active: boolean) => ({ className: `size-[22px] ${active ? "text-primary" : ""}`, strokeWidth: active ? 2.2 : 1.8, "aria-hidden": true as const });
  const current = (active: boolean) => (active ? ("page" as const) : undefined);
  const inquiryInner = (
    <>
      <span className="relative">
        <MessageCircle {...ico(on.inquiries)} />
        {hasEnquiryNotes && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[#ff385c]" aria-label="New enquiry updates" />}
      </span>
      Inquiries
    </>
  );

  return (
    <nav ref={nav} aria-label="Main" data-floating className={`mobile-tabbar mobile-tabbar-dark fixed inset-x-0 bottom-0 z-[45] flex items-center justify-around border-t border-white/10 bg-black px-1 pb-[env(safe-area-inset-bottom)] transition-transform duration-300 md:hidden ${hide ? "translate-y-full" : "translate-y-0"}`}>
      <Link to="/" className={item(on.home)} aria-current={current(on.home)}>
        <Home {...ico(on.home)} className={`size-[22px] fill-current ${on.home ? "text-primary" : ""}`} />Home
      </Link>
      <Link to="/properties" className={item(on.explore)} aria-current={current(on.explore)} aria-expanded={sheet}
        onClick={(e) => { if (path === "/properties") { e.preventDefault(); toggleSheet(); } else setSheet(true); }}>
        <Compass {...ico(on.explore)} />Explore
      </Link>
      <Link to="/saved" className={item(on.saved)} aria-current={current(on.saved)}>
        <span className="relative">
          <Heart {...ico(on.saved)} />
          {savedCount > 0 && <span className="absolute -right-3 -top-2 grid min-w-[1.15rem] place-items-center rounded-full bg-[#fbbf24] px-1 text-[0.6rem] font-extrabold leading-[1.1rem] text-black" aria-label={`${savedCount > 99 ? "More than 99" : savedCount} saved`}>{savedCount > 99 ? "99+" : savedCount}</span>}
        </span>
        Saved
      </Link>
      {signedIn ? (
        <Link to="/notifications" className={item(on.inquiries)} aria-current={current(on.inquiries)}>{inquiryInner}</Link>
      ) : isPropertyPage ? (
        <a href="#enquiry-form" onClick={(e) => { e.preventDefault(); const el = document.getElementById("enquiry-form"); if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); const inp = el.querySelector<HTMLElement>("input,textarea"); inp?.focus({ preventScroll: true }); } }} className={item(false)}>{inquiryInner}</a>
      ) : (
        <Link to="/auth" search={back} className={item(false)}>{inquiryInner}</Link>
      )}
      <Link to={signedIn ? "/profile" : "/auth"} search={signedIn ? {} : back} className={item(on.profile)} aria-current={current(on.profile)}>
        <UserRound {...ico(on.profile)} />Profile
      </Link>
    </nav>
  );
}
