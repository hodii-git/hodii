import { createServerFn } from "@tanstack/react-start";
import { createAgencyInput } from "./agency.server";

const server = () => import("./agency.server");
const auth = () => import("./auth.server");

/** Agencies the signed-in person belongs to. Empty for a normal user. */
export const getMyAgencies = createServerFn({ method: "GET" }).handler(async () => {
  const { currentUser } = await auth();
  const me = await currentUser().catch(() => null);
  return me?.agencies ?? [];
});

/** Any signed-in person can start an agency; they become its owner. */
export const createMyAgency = createServerFn({ method: "POST" })
  .inputValidator((d) => createAgencyInput.parse(d))
  .handler(async ({ data }) => {
    const { requireUser, authDb } = await auth();
    const { createAgency } = await server();
    const me = await requireUser();
    const created = await authDb((db) => createAgency(db, me, data));
    return { ok: true as const, ...created };
  });
