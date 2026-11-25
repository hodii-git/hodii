import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { usernameSchema } from "./community-rules";

const auth = () => import("./auth.server");
const COLLATION = { locale: "en", strength: 2 } as const;

/** Is this username free? Case-insensitive. Public so the sign-up form can check as people type. */
export const checkUsername = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ username: usernameSchema }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, users, currentUser } = await auth();
    const me = await currentUser().catch(() => null);
    const hit = await authDb((db) => users(db).findOne({ username: data.username }, { collation: COLLATION, projection: { _id: 1 } }));
    return { available: !hit || hit._id === me?.id };
  });

/** Account summary for the profile page. */
export const getMyAccount = createServerFn({ method: "GET" }).handler(async () => {
  const { authDb, users, requireUser } = await auth();
  const me = await requireUser();
  return authDb(async (db) => {
    const { commentStats } = await import("./comments.server");
    const [u, saved, enquiries, searches, comments] = await Promise.all([
      users(db).findOne({ _id: me.id }),
      db.collection("savedProperties").countDocuments({ userId: me.id }),
      db.collection("enquiries").countDocuments({ userId: me.id }),
      db.collection("savedSearches").countDocuments({ userId: me.id }),
      commentStats(db, me.id),
    ]);
    return {
      username: me.username, avatarUrl: me.avatarUrl, email: me.email, accountType: me.accountType, agencies: me.agencies,
      memberSince: (u?.createdAt ?? new Date()).toISOString(), stats: { saved, enquiries, searches }, comments,
    };
  });
});

export const updateMyUsername = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ username: usernameSchema }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, users, requireUser } = await auth();
    const me = await requireUser();
    return authDb(async (db) => {
      const clash = await users(db).findOne({ username: data.username, _id: { $ne: me.id } }, { collation: COLLATION, projection: { _id: 1 } });
      if (clash) return { ok: false as const, error: "That username is taken" };
      try {
        await users(db).updateOne({ _id: me.id }, { $set: { username: data.username } });
      } catch (e) {
        if ((e as { code?: number }).code === 11000) return { ok: false as const, error: "That username is taken" };
        throw e;
      }
      return { ok: true as const };
    });
  });

/** A few wrong passwords in a short time lock deletion for a while, so a borrowed session cannot be used to guess. */
const tries = new Map<string, { n: number; until: number }>();
export const DELETE_PHRASE = "DELETE";

/** People delete their own account here. They must type DELETE and their password; the rules match the admin's deletion. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(200), confirm: z.string().max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, users, requireUser, verifyPassword } = await auth();
    const me = await requireUser();
    if (data.confirm.trim() !== DELETE_PHRASE) throw new Error(`Type ${DELETE_PHRASE} to confirm`);
    const t = tries.get(me.id);
    if (t && t.n >= 5 && t.until > Date.now()) throw new Error("Too many wrong passwords. Try again in a few minutes.");
    const { deleteUserData } = await import("./admin-analytics.server");
    return authDb(async (db) => {
      const u = await users(db).findOne({ _id: me.id });
      if (!u || !(await verifyPassword(data.password, u.passwordHash))) {
        tries.set(me.id, { n: (t && t.until > Date.now() ? t.n : 0) + 1, until: Date.now() + 15 * 60_000 });
        throw new Error("That password is not right");
      }
      tries.delete(me.id);
      try {
        return await deleteUserData(db, me.id);
      } catch (e) {
        throw new Error(e instanceof Error ? e.message.replace("This person is", "You are").replace("Suspend the agency or add another owner first.", "Make someone else an owner first, or delete the agency from its settings.") : "Could not delete the account");
      }
    });
  });

/** Signed parameters for uploading a profile picture straight to Cloudinary. */
export const getAvatarSignature = createServerFn({ method: "POST" }).handler(async () => {
  const { requireUser } = await auth();
  const me = await requireUser();
  const { signUpload } = await import("./images.server");
  return signUpload(me.id, "avatar");
});

/** Saves (or clears, with null) the profile picture. Only an image uploaded to this person's own avatar folder is accepted. */
export const setMyAvatar = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ url: z.string().url().max(500).nullable() }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, users, requireUser } = await auth();
    const me = await requireUser();
    const { isOwnAvatarUrl } = await import("./images.server");
    if (data.url && !isOwnAvatarUrl(data.url, me.id)) throw new Error("Upload a photo from your device");
    await authDb((db) => users(db).updateOne({ _id: me.id }, { $set: { avatar: data.url ? { url: data.url, publicId: null } : null } }));
    return { ok: true as const };
  });

/** "Download my data". The password is asked again, so a borrowed or left-open session cannot take a person's details. */
export const exportMyData = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, users, requireUser, verifyPassword } = await auth();
    const me = await requireUser();
    return authDb(async (db) => {
      const u = await users(db).findOne({ _id: me.id });
      if (!u || !(await verifyPassword(data.password, u.passwordHash))) return { ok: false as const, error: "That password is not right" };
      const { collectMyData } = await import("./my-data.server");
      return { ok: true as const, json: JSON.stringify(await collectMyData(db, me.id), null, 2) };
    });
  });
