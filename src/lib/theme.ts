/**
 * JS-side mirror of src/theme.css (the single source of truth for colours).
 * Only values that must exist outside CSS live here: browser theme colour, PWA manifest, logo gradient.
 */
export const THEME = {
  background: "#000000",
  surface: "#141416",
  foreground: "#f4f4f5",
  brandA: "#fd267a",
  brandB: "#ff6036",
  brandGradient: "linear-gradient(135deg, #fd267a, #ff6036)",
} as const;
