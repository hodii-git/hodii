import { createServerFn } from "@tanstack/react-start";

/** Public: the live numbers from admin Settings, so the pricing page can never disagree with what is actually charged. */
export const getPublicPricing = createServerFn({ method: "GET" }).handler(async () => {
  const { getSettings } = await import("./settings.server");
  return { v: await getSettings() };
});
