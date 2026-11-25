import { useEffect } from "react";

/**
 * Tints the page background with colours taken from a listing's cover photo, laid out as
 * directional gradients (not one flat colour). Does nothing if the image can't be read.
 */
export function useCoverWash(url: string | undefined) {
  useEffect(() => {
    if (!url || typeof document === "undefined") return;
    let dead = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const n = 6;
        const c = document.createElement("canvas");
        c.width = n; c.height = n;
        const g = c.getContext("2d", { willReadFrequently: true });
        if (!g || dead) return;
        g.drawImage(img, 0, 0, n, n);
        const px = (x: number, y: number) => {
          const d = g.getImageData(x, y, 1, 1).data;
          // Lift toward white so text stays readable.
          const m = (v = 0) => Math.round(v + (255 - v) * 0.78);
          return `rgb(${m(d[0])} ${m(d[1])} ${m(d[2])} / 0.85)`;
        };
        const tl = px(0, 0), tr = px(n - 1, 0), mid = px(3, 3), bl = px(0, n - 1), br = px(n - 1, n - 1);
        const wash = `linear-gradient(115deg, ${tl} 0%, transparent 42%), linear-gradient(245deg, ${tr} 0%, transparent 45%), radial-gradient(60rem 40rem at 50% 45%, ${mid}, transparent 70%), linear-gradient(60deg, ${bl} 0%, transparent 40%), linear-gradient(300deg, ${br} 0%, transparent 40%), oklch(0.985 0.005 250)`;
        document.documentElement.style.setProperty("--page-wash", wash);
      } catch { /* cross-origin image: keep the default background */ }
    };
    img.src = url;
    return () => { dead = true; document.documentElement.style.removeProperty("--page-wash"); };
  }, [url]);
}
