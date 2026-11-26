import { themeBootScript } from "@/components/theme-toggle";
import { absUrl, CONTACT_EMAIL, SITE_NAME } from "@/lib/site";
import { BRAND } from "@/lib/brand";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { LiveUpdates } from "@/components/live-updates";
import { SiteHeader } from "@/components/site-header";
import { DashHeader, isDashboardPath, isFramedPath } from "@/components/dashboard/dash-header";
import { FloatLift } from "@/components/float-lift";
import { FloatDismiss } from "@/components/float-dismiss";
import { ScrollOnNavigate } from "@/components/scroll-on-navigate";
import { InstallPrompt } from "@/components/install-prompt";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { InputGuards } from "@/components/input-guards";
import { TourRunner } from "@/components/tour/tour-runner";
import { PageLoader } from "@/components/page-loader";
import { WbFooter } from "@/components/wb/shell";
import { installImageFallback } from "@/lib/image-fallback";
import { reportBrowserError } from "@/lib/error-report.functions";
import { CompareTray } from "@/components/property/compare-tray";
import { ColorGlow } from "@/components/color-glow";
import appCss from "../styles.css?url";
import { useQuery } from "@tanstack/react-query";
import { getSiteStatus } from "@/lib/admin.functions";
import { installGoogleAnalytics, trackPageView } from "@/lib/site-tracking";
import { gaIdQuery } from "@/lib/analytics.functions";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { THEME } from "@/lib/theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
    // Tell us, so a broken page is fixed even if nobody writes in. Never allowed to fail the error page itself.
    const e = error instanceof Error ? error : new Error(String(error));
    reportBrowserError({ data: { message: e.message.slice(0, 300), stack: e.stack?.slice(0, 2000) ?? null, path: window.location.pathname.slice(0, 200) } }).catch(() => {});
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, interactive-widget=resizes-visual" },
      { title: `${BRAND.name} — ${BRAND.tagline}` },
      { name: "description", content: BRAND.description },
      { name: "theme-color", content: THEME.background },
      { name: "color-scheme", content: "dark" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Hodii" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: "en_GB" },
      { name: "twitter:card", content: "summary_large_image" },
          ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Geist:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-startup-image", href: "/splash/1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/1242x2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/828x1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
    // Google tag (gtag.js) is loaded in RootComponent once the measurement ID arrives from the server.
    scripts: [
      { type: "application/ld+json", children: JSON.stringify([
        { "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, legalName: BRAND.legalName, url: absUrl("/"), logo: absUrl("/icon-512.png"), email: CONTACT_EMAIL, areaServed: { "@type": "Country", name: BRAND.country } },
        { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: absUrl("/"), potentialAction: { "@type": "SearchAction", target: `${absUrl("/properties")}?q={search_term_string}`, "query-input": "required name=search_term_string" } },
      ]) },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang={BRAND.locale} data-listing-dark="1" style={{ backgroundColor: THEME.background, colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  useEffect(() => trackPageView(pathname), [pathname]);
  // Missing or broken photos are swapped for a colour gradient instead of the browser's broken-image mark.
  useEffect(() => installImageFallback(), []);
  // Installable app support: a small service worker (public/sw.js). Production only, and never a reason for the page to fail.
  useEffect(() => { if (import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);
  const { data: ga } = useQuery(gaIdQuery, queryClient);
  useEffect(() => { if (ga?.gaId) installGoogleAnalytics(ga.gaId); }, [ga?.gaId]);
  const { data: site } = useQuery({ queryKey: ["site-status"], queryFn: () => getSiteStatus(), staleTime: 60_000 }, queryClient);
  if (pathname.startsWith("/admin")) {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster position="top-center" className="toaster-center" />
      </QueryClientProvider>
    );
  }
  const paused = !!site?.maintenance_mode;

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <AuthProvider>
      <TooltipProvider delayDuration={150}>
        <div className="app-shell aurora flex min-h-screen flex-col overflow-x-clip">
          <PageLoader />
          <a href="#main" className="sr-only z-[100] rounded-full bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4" onClick={(e) => { e.preventDefault(); const m = document.querySelector("main"); if (m) { m.setAttribute("tabindex", "-1"); m.focus(); m.scrollIntoView(); } }}>Skip to main content</a>
          <ColorGlow />
          <LiveUpdates />
          {isFramedPath(pathname) ? null : isDashboardPath(pathname) ? <DashHeader /> : !pathname.startsWith("/info/") && <SiteHeader />}
          {paused ? (
            <main className="flex flex-1 items-center justify-center px-4 pt-28 pb-24">
              <div className="empty-card max-w-lg p-8 text-center">
                <h1 className="text-3xl">We'll be right back</h1>
                <p className="mt-3 text-muted-foreground">{site?.maintenance_message || "The site is paused for maintenance."}</p>
              </div>
            </main>
          ) : <Outlet />}
          {!isFramedPath(pathname) && <WbFooter />}
          <CompareTray />
          <FeedbackButton />
          {!isDashboardPath(pathname) && !pathname.startsWith("/info/") && !pathname.startsWith("/auth") && !pathname.startsWith("/list-property") && <MobileTabBar />}
          <InputGuards />
          <TourRunner />
          <FloatLift /><FloatDismiss /><ScrollOnNavigate />
          {!isFramedPath(pathname) && !isDashboardPath(pathname) && <InstallPrompt />}
        </div>
        <Toaster position="top-center" className="toaster-center" />
        <VercelAnalytics />
      </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
