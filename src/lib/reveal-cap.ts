/** How many different listings' phone numbers one visitor, and one network, may reveal per day. Signed-in people get more. Set in admin Settings. */
export async function revealLimits(signedIn: boolean) {
  const { getSettings } = await import("./settings.server");
  const v = await getSettings();
  return { perVisitor: Number(signedIn ? v["reveal.userPerDay"] : v["reveal.guestPerDay"]), perNetwork: Number(v["reveal.networkPerDay"]) };
}
