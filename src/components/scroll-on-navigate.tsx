import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

/** When a link goes to a different page, jump to the top straight away so the loader (not the footer) is what you see while it loads. */
export function ScrollOnNavigate() {
  const router = useRouter();
  useEffect(() => router.subscribe("onBeforeNavigate", (e) => {
    if (e.pathChanged && !e.hrefChanged === false && typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }), [router]);
  return null;
}
