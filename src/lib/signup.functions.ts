import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { MAX_ACCOUNTS_PER_ADDRESS, SIGNUP_WINDOW_HOURS, signupLimitReached } from "./signup-rules";
import { LIMITS } from "./community-rules";
import { TERMS_VERSION, generateRecoveryCodes, normalizeRecoveryCode, RECOVERY_CODE_COUNT } from "./recovery";
import { createAgencyInput } from "./agency.server";

const auth = () => import("./auth.server");

const signUpInput = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(LIMITS.passwordMax),
  username: z.string().trim().min(3).max(30),
  /** "user" looks for property; "agency" lists it. Anyone can create an agency later, whichever they pick here. */
  accountType: z.enum(["user", "agency"]).default("user"),
  /** The terms and privacy policy must be accepted; the time and version are stored. */
  acceptTerms: z.literal(true, { message: "Accept the terms and privacy policy to continue" }),
  /** Required when accountType is "agency". */
  agency: createAgencyInput.optional(),
}).refine((v) => v.accountType !== "agency" || v.agency, { path: ["agency"], message: "Enter your agency details" });

const clientIp = () =>
  getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

/** Who is signed in (from the httpOnly session cookie), or null. */
export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { currentUser } = await auth();
  return currentUser().catch(() => null);
});

/**
 * Creates an account instantly and signs it in; no email is ever sent. A network address
 * that already created MAX_ACCOUNTS_PER_ADDRESS accounts in the window is refused.
 */
export const instantSignUp = createServerFn({ method: "POST" })
  .inputValidator((d) => signUpInput.parse(d))
  .handler(async ({ data }) => {
    await (await import("./admin.server")).assertEnabled("signups_enabled");
    const { authDb, users, emailHash, encrypt, hashPassword, startSession, sha256 } = await auth();
    const ipHash = await sha256(`hodii-signup:${clientIp()}`);
    return authDb(async (db) => {
      const since = new Date(Date.now() - SIGNUP_WINDOW_HOURS * 3600_000);
      const count = await db.collection("signupAttempts").countDocuments({ ipHash, createdAt: { $gte: since } });
      if (signupLimitReached(count)) return { status: "limited" as const, limit: MAX_ACCOUNTS_PER_ADDRESS };
      const id = crypto.randomUUID();
      const recoveryCodes = generateRecoveryCodes();
      try {
        await users(db).insertOne({
          _id: id, emailHash: await emailHash(data.email), emailEnc: await encrypt(data.email.toLowerCase()),
          username: data.username, passwordHash: await hashPassword(data.password), blocked: false, createdAt: new Date(), lastSignInAt: null,
          accountType: data.accountType,
          termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION,
          recoveryHashes: await Promise.all(recoveryCodes.map((c) => sha256(`hodii-recovery:${c}`))), recoveryIssuedAt: new Date(),
        });
      } catch (e) {
        const dup = e as { code?: number; keyPattern?: Record<string, unknown> };
        if (dup.code === 11000) throw new Error(dup.keyPattern?.["username"] ? "That username is taken. Choose another." : "An account with this email already exists. Try signing in instead.");
        throw e;
      }
      await (await import("./dashboard.server")).attachInvitations(db, id, await emailHash(data.email)).catch((e: unknown) => console.error("attach invitations", e));
      await db.collection("signupAttempts").insertOne({ ipHash, createdAt: new Date() });
      // The agency is created after the account so a clash on its name never loses the sign-up; if it fails the person can retry from their account.
      let agency: { id: string; slug: string } | null = null;
      if (data.accountType === "agency" && data.agency) {
        const { createAgency } = await import("./agency.server");
        agency = await createAgency(db, { id, email: data.email }, data.agency).catch((e: unknown) => { console.error("signup: agency creation failed", e); return null; });
      }
      await startSession(db, id);
      return { status: "created" as const, agency, recoveryCodes };
    });
  });

/** Signs in with email + password; explains precisely whether the account or the password is wrong. */
export const signIn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, users, emailHash, verifyPassword, startSession } = await auth();
    return authDb(async (db) => {
      const u = await users(db).findOne({ emailHash: await emailHash(data.email) });
      if (!u) return { ok: false as const, error: "There's no account with this email. Check the spelling or create an account." };
      if (!(await verifyPassword(data.password, u.passwordHash))) return { ok: false as const, error: "Incorrect password for this email. Check it and try again." };
      if (u.blocked) return { ok: false as const, error: "This account has been suspended. Please contact us for help." };
      await startSession(db, u._id);
      return { ok: true as const };
    });
  });

export const signOut = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ everywhere: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { endUserSession } = await auth();
    await endUserSession(data.everywhere);
    return { ok: true };
  });

export const changePassword = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ current: z.string().min(1).max(200), next: z.string().min(8).max(LIMITS.passwordMax) }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, authDb, users, verifyPassword, hashPassword } = await auth();
    const me = await requireUser();
    return authDb(async (db) => {
      const u = await users(db).findOne({ _id: me.id });
      if (!u || !(await verifyPassword(data.current, u.passwordHash))) return { ok: false as const, error: "Your current password is incorrect" };
      await users(db).updateOne({ _id: me.id }, { $set: { passwordHash: await hashPassword(data.next) } });
      return { ok: true as const };
    });
  });

/* ---------- Recovery, email change ---------- */

const RECOVERY_TRIES_PER_HOUR = 8;
const newPassword = z.string().min(8).max(LIMITS.passwordMax);

/** Resets a forgotten password with one of the codes shown at sign-up. Each code works once. */
export const recoverAccount = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().trim().email().max(254), code: z.string().trim().min(8).max(40), password: newPassword }).parse(d))
  .handler(async ({ data }) => {
    const { authDb, users, emailHash, hashPassword, sha256, startSession } = await auth();
    const wrong = { ok: false as const, error: "That email and recovery code do not match. Check them and try again." };
    const ipKey = await sha256(`hodii-recover-ip:${clientIp()}`), mailKey = await emailHash(data.email);
    return authDb(async (db) => {
      const attempts = db.collection("recoveryAttempts");
      const since = new Date(Date.now() - 3600_000);
      const [byIp, byMail] = await Promise.all([attempts.countDocuments({ key: ipKey, createdAt: { $gte: since } }), attempts.countDocuments({ key: `m:${mailKey}`, createdAt: { $gte: since } })]);
      if (byIp >= RECOVERY_TRIES_PER_HOUR || byMail >= RECOVERY_TRIES_PER_HOUR) return { ok: false as const, error: "Too many attempts. Wait an hour and try again, or contact support." };
      await attempts.insertMany([{ key: ipKey, createdAt: new Date() }, { key: `m:${mailKey}`, createdAt: new Date() }]);
      const code = normalizeRecoveryCode(data.code);
      const u = await users(db).findOne({ emailHash: mailKey });
      if (!code || !u || u.blocked) return wrong;
      const digest = await sha256(`hodii-recovery:${code}`);
      if (!(u.recoveryHashes ?? []).includes(digest)) return wrong;
      // Pulling the digest in the same update means a code cannot be used twice, even by two requests at once.
      const used = await users(db).updateOne({ _id: u._id, recoveryHashes: digest }, { $pull: { recoveryHashes: digest }, $set: { passwordHash: await hashPassword(data.password) } });
      if (!used.modifiedCount) return wrong;
      await db.collection("userSessions").deleteMany({ userId: u._id });
      await startSession(db, u._id);
      return { ok: true as const, codesLeft: (u.recoveryHashes ?? []).length - 1 };
    });
  });

/** New set of recovery codes, replacing the old ones. Needs the password so a borrowed phone cannot do it. */
export const regenerateRecoveryCodes = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, authDb, users, verifyPassword, sha256 } = await auth();
    const me = await requireUser();
    return authDb(async (db) => {
      const u = await users(db).findOne({ _id: me.id });
      if (!u || !(await verifyPassword(data.password, u.passwordHash))) return { ok: false as const, error: "Your password is incorrect" };
      const codes = generateRecoveryCodes();
      await users(db).updateOne({ _id: me.id }, { $set: { recoveryHashes: await Promise.all(codes.map((c) => sha256(`hodii-recovery:${c}`))), recoveryIssuedAt: new Date() } });
      return { ok: true as const, codes };
    });
  });

export const getSecurityStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser, authDb, users } = await auth();
  const me = await requireUser();
  return authDb(async (db) => {
    const u = await users(db).findOne({ _id: me.id }, { projection: { recoveryHashes: 1, termsAcceptedAt: 1 } });
    return { codesLeft: u?.recoveryHashes?.length ?? 0, codesTotal: RECOVERY_CODE_COUNT, termsAcceptedAt: u?.termsAcceptedAt?.toISOString() ?? null };
  });
});

/** Changes the sign-in email. The password is required, and the new address must not belong to anyone else. */
export const changeEmail = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(200), email: z.string().trim().email().max(254) }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, authDb, users, verifyPassword, emailHash, encrypt } = await auth();
    const me = await requireUser();
    return authDb(async (db) => {
      const u = await users(db).findOne({ _id: me.id });
      if (!u || !(await verifyPassword(data.password, u.passwordHash))) return { ok: false as const, error: "Your password is incorrect" };
      try {
        await users(db).updateOne({ _id: me.id }, { $set: { emailHash: await emailHash(data.email), emailEnc: await encrypt(data.email.toLowerCase()) } });
      } catch (e) {
        if ((e as { code?: number }).code === 11000) return { ok: false as const, error: "Another account already uses that email" };
        throw e;
      }
      return { ok: true as const };
    });
  });
