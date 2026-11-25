// Pictures for the Webbora-style pages. Every picture carries a gradient that shows until the file loads,
// and keeps showing if the file is missing, so a missing image can never leave a hole or crash a page.
// A picture with src: "" has no file at all and is shown as its gradient, nothing else.
export type WbImage = { src: string; alt: string; ph: string };

export const paintings = {
  valley: { src: "", ph: "var(--ph-valley)", alt: "Painting of a green valley with a river, a village and a snow-capped mountain." },
  peaks: { src: "", ph: "var(--ph-peaks)", alt: "Painting of snow-capped mountains glowing at dawn over forested hills and a still lake." },
  pines: { src: "", ph: "var(--ph-pines)", alt: "Painting of layered forested hills sinking into pink and violet mist at sunset." },
  clouds: { src: "", ph: "var(--ph-clouds)", alt: "Painting of soft white clouds on both sides of a calm lavender-blue sky." },
  // Not shipped yet: their gradient shows until the file is added to /public/images.
  founder: { src: "/images/founder-portrait.jpg", ph: "var(--ph-founder)", alt: "Portrait of the Hodii founder." },
  team: { src: "/images/team-nairobi.jpg", ph: "var(--ph-studio)", alt: "The Hodii team at work in Nairobi." },
} satisfies Record<string, WbImage>;

/** Gradient for a picture address, so a slow or missing file still shows colour. */
export const placeholderBySrc: Record<string, string> = Object.fromEntries(
  Object.values(paintings).filter((p) => p.src).map((p) => [p.src, p.ph]),
);
