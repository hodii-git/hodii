import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { escapeRegex, pageInput, queryWords, sinceDate, toPage } from "./admin-paging";

const srv = () => import("./admin.server");
const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;

/* ---------- Session ---------- */

export const adminMe = createServerFn({ method: "GET" }).handler(async () => {
  const { currentAdmin } = await srv();
  const me = await currentAdmin();
  return me ? { id: me.id, username: me.username, email: me.email, role: me.role, sections: me.sections ?? null, twoFactor: me.twoFactor, twoFactorRequired: (await srv()).twoFactorRequired() } : null;
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ login: z.string().trim().min(1).max(254), password: z.string().min(1).max(200), code: z.string().trim().max(20).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { adminDb, ipHash, audit, createSession, accounts, auditLog, verifyPassword } = await srv();
    const { checkSecondFactor } = await import("./admin-2fa.server");
    const since = new Date(Date.now() - LOCK_MINUTES * 60_000);
    const ip = await ipHash();
    const login = data.login.toLowerCase();
    const r = await adminDb(async (db) => {
      const count = await auditLog(db).countDocuments({ action: "login_failed", ipHash: ip, createdAt: { $gte: since } });
      if (count >= MAX_FAILED_LOGINS) return { kind: "locked" as const };
      const found = await accounts(db).findOne({ $or: [{ usernameLower: login }, { email: login }], disabled: false });
      const acc = found && (await verifyPassword(data.password, found.passwordHash)) ? found : null;
      if (!acc) return { kind: "bad" as const };
      // Guessing codes for one account from many addresses is stopped here, per account.
      if (acc.totp && (await auditLog(db).countDocuments({ action: "login_failed", "detail.accountId": acc._id, createdAt: { $gte: since } })) >= MAX_FAILED_LOGINS) return { kind: "locked" as const };
      if (acc.totp) {
        if (!data.code) return { kind: "needs_code" as const };
        if ((await checkSecondFactor(db, acc, data.code)) !== "ok") return { kind: "bad_code" as const, id: acc._id };
      }
      await accounts(db).updateOne({ _id: acc._id }, { $set: { lastLoginAt: new Date() } });
      return { kind: "ok" as const, acc };
    });
    if (r.kind === "locked") return { ok: false as const, error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.` };
    if (r.kind === "needs_code") return { ok: false as const, needsCode: true as const, error: "" };
    if (r.kind === "bad") { await audit(null, "login_failed", { login: data.login.slice(0, 80) }); return { ok: false as const, error: "Wrong username or password." }; }
    if (r.kind === "bad_code") { await audit(null, "login_failed", { login: data.login.slice(0, 80), accountId: r.id, reason: "second_factor" }); return { ok: false as const, needsCode: true as const, error: "That code is not right. Use the newest code from your app, or a backup code." }; }
    await createSession(r.acc._id);
    await audit({ id: r.acc._id, username: r.acc.username }, "login", r.acc.totp ? { secondFactor: true } : {});
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { endSession, currentAdmin, audit } = await srv();
  const me = await currentAdmin();
  await endSession();
  if (me) await audit(me, "logout");
  return { ok: true };
});

/* ---------- Analytics ---------- */

const analytics = () => import("./admin-analytics.server");

/** Website traffic (page views): paths, devices, referrers. */
export const adminStats = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ days: z.number().int().min(1).max(365) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, viewStats } = await srv();
    await requireAdmin("editor", { section: "overview" });
    return viewStats(data.days);
  });

export const adminOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, adminDb, viewStats, loadSettings, auditLog } = await srv();
  await requireAdmin("editor", { section: "overview" });
  const a = await analytics();
  const [settings, stats, platform, failed] = await Promise.all([
    loadSettings(), viewStats(30), adminDb((db) => a.platformOverview(db)),
    adminDb((db) => auditLog(db).countDocuments({ action: "login_failed", createdAt: { $gte: new Date(Date.now() - 86_400_000) } })),
  ]);
  return { settings, stats, platform, failedLogins24h: failed };
});

export const adminMarketAnalytics = createServerFn({ method: "GET" })
  .inputValidator(async (d) => (await analytics()).analyticsInput.parse(d))
  .handler(async ({ data }) => { const { requireAdmin, adminDb } = await srv(); await requireAdmin("editor", { section: "analytics" }); const a = await analytics(); return adminDb((db) => a.marketAnalytics(db, data.days)); });

/* ---------- Listings, agencies and users ---------- */


export const adminListListings = createServerFn({ method: "GET" })
  .inputValidator(async (d) => (await analytics()).listingsInput.parse(d))
  .handler(async ({ data }) => { const { requireAdmin, adminDb } = await srv(); await requireAdmin("editor", { section: "listings" }); const a = await analytics(); return adminDb((db) => a.adminListings(db, data)); });

export const adminListingAction = createServerFn({ method: "POST" })
  .inputValidator(async (d) => (await analytics()).listingAction.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("editor", { section: "listings" });
    const a = await analytics();
    const r = await adminDb((db) => a.actOnListing(db, data));
    await audit(me, `listing_${data.action}`, { id: data.id });
    return r;
  });

export const adminListAgencies = createServerFn({ method: "GET" })
  .inputValidator(async (d) => (await analytics()).agenciesInput.parse(d))
  .handler(async ({ data }) => { const { requireAdmin, adminDb } = await srv(); await requireAdmin("admin"); const a = await analytics(); return adminDb((db) => a.adminAgencies(db, data)); });

export const adminAgencyAction = createServerFn({ method: "POST" })
  .inputValidator(async (d) => (await analytics()).agencyAction.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("admin");
    const a = await analytics();
    const r = await adminDb((db) => a.actOnAgency(db, data));
    await audit(me, `agency_${data.action}`, { id: data.id });
    return r;
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .inputValidator(async (d) => (await analytics()).usersInput.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb } = await srv();
    await requireAdmin("admin");
    const a = await analytics();
    const { decrypt } = await import("./community.server");
    return adminDb((db) => a.adminUsers(db, data, decrypt));
  });

export const adminSetUserBlocked = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().min(1).max(64), blocked: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, audit } = await srv();
    const me = await requireAdmin("admin");
    const { authDb, users, userSessions } = await import("./auth.server");
    const r = await authDb(async (db) => {
      const r = await users(db).updateOne({ _id: data.id }, { $set: { blocked: data.blocked } });
      if (data.blocked) await userSessions(db).deleteMany({ userId: data.id });
      return r;
    });
    if (!r.matchedCount) throw new Error("This account no longer exists");
    await audit(me, data.blocked ? "user_blocked" : "user_unblocked", { id: data.id });
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("admin");
    const a = await analytics();
    const r = await adminDb((db) => a.deleteUserData(db, data.id));
    await audit(me, "user_deleted", { id: data.id });
    return r;
  });

/* ---------- Security & site controls ---------- */

export const adminSecurity = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, adminDb, loadSettings, sessions: sessCol, accounts } = await srv();
  const me = await requireAdmin("admin");
  const [settings, sessions] = await Promise.all([
    loadSettings(),
    adminDb(async (db) => {
      const list = await sessCol(db).find({ revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 }).limit(50).toArray();
      const names = new Map((await accounts(db).find({ _id: { $in: [...new Set(list.map((s) => s.accountId))] } }, { projection: { username: 1 } }).toArray()).map((a) => [a._id, a.username]));
      return list.map((s) => ({ id: s._id, created_at: s.createdAt.toISOString(), last_seen_at: s.lastSeenAt.toISOString(), expires_at: s.expiresAt.toISOString(), user_agent: s.userAgent, admin_accounts: { username: names.get(s.accountId) ?? "removed" } }));
    }),
  ]);
  return {
    settings,
    currentSessionId: me.sessionId,
    sessions: sessions.map((s) => ({ id: s.id, createdAt: s.created_at, lastSeen: s.last_seen_at, expires: s.expires_at, device: s.user_agent ?? "", username: (s.admin_accounts as unknown as { username: string }).username })),
  };
});

/* ---------- Activity: what the team did ---------- */

export const ADMIN_ACTIONS = [
  "login", "login_failed", "logout", "listing_approve", "listing_reject", "listing_pause", "listing_resume", "listing_feature", "listing_unfeature",
  "agency_verify", "agency_reject", "agency_suspend", "agency_reinstate", "report_dismiss", "report_pause_listing", "report_remove_listing",
  "user_blocked", "user_unblocked", "user_deleted", "settings_changed", "session_revoked", "all_sessions_revoked",
  "comment_removed", "editor_added", "editor_updated", "editor_removed", "account_updated",
] as const;

export const adminActivityLog = createServerFn({ method: "GET" })
  .inputValidator((d) => pageInput.extend({ who: z.string().max(100).default("all"), action: z.string().max(60).default("all") }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, auditLog, accounts } = await srv();
    await requireAdmin("admin");
    const and: Record<string, unknown>[] = [];
    const since = sinceDate(data.days);
    if (since) and.push({ createdAt: { $gte: since } });
    if (data.who !== "all") and.push({ username: data.who === "—" ? null : data.who });
    if (data.action !== "all") and.push({ action: data.action });
    for (const w of queryWords(data.q)) { const rx = { $regex: escapeRegex(w), $options: "i" }; and.push({ $or: [{ username: rx }, { action: rx }] }); }
    const filter = and.length ? { $and: and } : {};
    const { log, count, people } = await adminDb(async (db) => {
      const [log, count, people] = await Promise.all([
        auditLog(db).find(filter).sort({ createdAt: -1 }).skip(data.offset).limit(data.limit).toArray(),
        auditLog(db).countDocuments(filter),
        data.offset === 0 ? accounts(db).find({}, { projection: { username: 1 } }).sort({ usernameLower: 1 }).toArray().then((r) => r.map((a) => a.username)) : Promise.resolve(null),
      ]);
      return { log, count, people };
    });
    const rows = log.map((l) => ({ id: l._id, username: l.username, action: l.action, detail: JSON.stringify(l.detail ?? {}), network: (l.ipHash ?? "").slice(0, 8), at: l.createdAt.toISOString() }));
    return { ...toPage(rows, count, data.offset), people, actions: data.offset === 0 ? [...ADMIN_ACTIONS] : null };
  });

export type ReaderActivityKind = "comment" | "reply" | "story_like" | "save" | "comment_like";

export const adminUpdateSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    maintenance_mode: z.boolean(), maintenance_message: z.string().trim().max(500),
    signups_enabled: z.boolean(), comments_enabled: z.boolean(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, saveSettings, audit } = await srv();
    const me = await requireAdmin("admin");
    await saveSettings(data);
    await audit(me, "settings_changed", data);
    return { ok: true };
  });

export const adminRevokeSession = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, sessions, audit } = await srv();
    const me = await requireAdmin("admin");
    const now = new Date();
    // null = sign out every other device
    await adminDb((db) => data.id
      ? sessions(db).updateOne({ _id: data.id }, { $set: { revokedAt: now } })
      : sessions(db).updateMany({ revokedAt: null, _id: { $ne: me.sessionId } }, { $set: { revokedAt: now } }));
    await audit(me, data.id ? "session_revoked" : "all_sessions_revoked", {});
    return { ok: true };
  });

/* ---------- Team (admin accounts) ---------- */

export const adminListTeam = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, adminDb, accounts } = await srv();
  await requireAdmin("admin");
  const list = await adminDb((db) => accounts(db).find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: 1 }).toArray());
  return list.map((a) => ({ id: a._id, username: a.username, email: a.email, role: a.role, sections: a.sections ?? null, disabled: a.disabled, twoFactor: !!a.totp, created_at: a.createdAt.toISOString(), last_login_at: a.lastLoginAt ? a.lastLoginAt.toISOString() : null }));
});

const pw = z.string().min(8, "Use at least 8 characters").max(200);

export const adminCreateEditor = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ username: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_.-]+$/), email: z.string().trim().email().max(254), password: pw, sections: z.array(z.enum(["overview","analytics","moderation","listings","comments","reviews","feedback"])).max(7).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, accounts, hashPassword, audit } = await srv();
    const me = await requireAdmin("admin");
    const passwordHash = await hashPassword(data.password);
    try {
      await adminDb((db) => accounts(db).insertOne({ _id: crypto.randomUUID(), username: data.username, usernameLower: data.username.toLowerCase(), email: data.email.toLowerCase(), passwordHash, role: "editor", sections: data.sections ?? null, disabled: false, createdAt: new Date(), lastLoginAt: null }));
    } catch (e) {
      throw new Error((e as { code?: number }).code === 11000 ? "That username or email is already used" : "Could not add this person");
    }
    await audit(me, "editor_added", { username: data.username });
    return { ok: true };
  });

export const adminUpdateTeamMember = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), disabled: z.boolean().optional(), remove: z.boolean().optional(), password: pw.optional(), sections: z.array(z.enum(["overview","analytics","moderation","listings","comments","reviews","feedback"])).max(7).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, accounts, sessions, hashPassword, audit } = await srv();
    const me = await requireAdmin("admin");
    if (data.id === me.id) throw new Error("Use My account to change your own login");
    const passwordHash = data.password ? await hashPassword(data.password) : null;
    const target = await adminDb(async (db) => {
      const target = await accounts(db).findOne({ _id: data.id }, { projection: { username: 1, role: 1 } });
      if (!target) throw new Error("Account not found");
      if (target.role === "admin" && (data.remove || data.disabled)) throw new Error("Full admin accounts cannot be removed here");
      if (data.remove) {
        await accounts(db).deleteOne({ _id: data.id });
        await sessions(db).deleteMany({ accountId: data.id });
        return { ...target, removed: true };
      }
      if (data.disabled !== undefined) {
        await accounts(db).updateOne({ _id: data.id }, { $set: { disabled: data.disabled } });
        if (data.disabled) await sessions(db).updateMany({ accountId: data.id, revokedAt: null }, { $set: { revokedAt: new Date() } });
      }
      if (passwordHash) await accounts(db).updateOne({ _id: data.id }, { $set: { passwordHash } });
      if (data.sections) { if (target.role === "admin") throw new Error("Full admins always see every section"); await accounts(db).updateOne({ _id: data.id }, { $set: { sections: data.sections } }); }
      return { ...target, removed: false };
    });
    if (target.removed) {
      await audit(me, "editor_removed", { username: target.username });
      return { ok: true };
    }
    await audit(me, "editor_updated", { username: target.username, disabled: data.disabled, passwordReset: !!data.password, sections: data.sections });
    return { ok: true };
  });

export const adminUpdateMyAccount = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    username: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_.-]+$/),
    email: z.string().trim().email().max(254),
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, accounts, hashPassword, verifyPassword, audit } = await srv();
    const me = await requireAdmin("editor");
    if (data.newPassword && data.newPassword.length < 8) return { ok: false as const, error: "A new password needs at least 8 characters." };
    const res = await adminDb(async (db) => {
      const acc = await accounts(db).findOne({ _id: me.id });
      if (!acc || !(await verifyPassword(data.currentPassword, acc.passwordHash))) return "Your current password is not right.";
      const patch: Record<string, unknown> = { username: data.username, usernameLower: data.username.toLowerCase(), email: data.email.toLowerCase() };
      if (data.newPassword) patch["passwordHash"] = await hashPassword(data.newPassword);
      try { await accounts(db).updateOne({ _id: me.id }, { $set: patch }); } catch (e) {
        return (e as { code?: number }).code === 11000 ? "That username or email is already used." : "Could not save.";
      }
      return null;
    });
    if (res) return { ok: false as const, error: res };
    await audit(me, "account_updated", { username: data.username, passwordChanged: !!data.newPassword });
    return { ok: true as const };
  });

/* ---------- Public: site status for the maintenance screen ---------- */

export const getSiteStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { loadSettings, DEFAULT_SETTINGS } = await srv();
  const settings = await loadSettings().catch(() => null);
  // Identical for every visitor, so the CDN may serve it for a short while (a maintenance switch shows within ~30 s).
  if (settings) (await import("./cdn-cache.server")).cachePublic(30, 300);
  return settings ?? { ...DEFAULT_SETTINGS, maintenance_message: "" };
});

/* ---------- Listing moderation ---------- */

const mod = () => import("./moderation.server");

/** Just the numbers waiting for staff: listings to review, agencies to verify, open reports. Light enough to ask every 30 seconds. */
export const adminPendingCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, adminDb } = await srv();
  await requireAdmin("editor");
  const m = await mod();
  return adminDb((db) => m.moderationCounts(db));
});

export const adminModerationOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, adminDb } = await srv();
  await requireAdmin("editor", { section: "moderation" });
  const m = await mod();
  return adminDb(async (db) => ({ counts: await m.moderationCounts(db), listings: await m.pendingListings(db), agencies: await m.pendingAgencies(db), reports: await m.openReports(db) }));
});

export const adminDecideListing = createServerFn({ method: "POST" })
  .inputValidator(async (d) => (await mod()).decideListing.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("editor", { section: "moderation" });
    const m = await mod();
    const r = await adminDb((db) => m.decideOnListing(db, me, data));
    await audit(me, `listing_${data.decision}`, { id: data.id });
    return r;
  });

export const adminDecideAgency = createServerFn({ method: "POST" })
  .inputValidator(async (d) => (await mod()).decideAgency.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("admin");
    const m = await mod();
    const r = await adminDb((db) => m.decideOnAgency(db, me, data));
    await audit(me, `agency_${data.decision}`, { id: data.id });
    return r;
  });

export const adminDecideReport = createServerFn({ method: "POST" })
  .inputValidator(async (d) => (await mod()).decideReport.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("editor", { section: "moderation" });
    const m = await mod();
    const r = await adminDb((db) => m.decideOnReport(db, me, data));
    await audit(me, `report_${data.decision}`, { id: data.id });
    return r;
  });

/* ---------- Comments on listings ---------- */

export const adminListComments = createServerFn({ method: "GET" })
  .inputValidator((d) => pageInput.extend({ kind: z.enum(["all", "comment", "reply"]).default("all") }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb } = await srv();
    await requireAdmin("editor", { section: "comments" });
    const { decrypt } = await import("./community.server");
    return adminDb(async (db) => {
      const filter: Record<string, unknown> = { deletedAt: null };
      if (data.kind !== "all") filter["parentId"] = data.kind === "reply" ? { $ne: null } : null;
      const since = sinceDate(data.days);
      if (since) filter["createdAt"] = { $gte: since };
      const words = queryWords(data.q);
      if (words.length) {
        const rx = { $regex: escapeRegex(words.join(" ")), $options: "i" };
        const [people, props] = await Promise.all([
          db.collection("users").find({ username: rx }, { projection: { _id: 1 } }).limit(100).toArray(),
          db.collection("properties").find({ title: rx }, { projection: { _id: 1 } }).limit(100).toArray(),
        ]);
        filter["$or"] = [{ userId: { $in: people.map((p) => String(p._id)) } }, { propertyId: { $in: props.map((p) => String(p._id)) } }];
      }
      const col = db.collection("propertyComments");
      const [raw, total] = await Promise.all([col.find(filter).sort({ createdAt: -1 }).skip(data.offset).limit(data.limit).toArray(), col.countDocuments(filter)]);
      const [people, props] = await Promise.all([
        db.collection("users").find({ _id: { $in: [...new Set(raw.map((c) => String(c["userId"])))] as never } }, { projection: { username: 1 } }).toArray(),
        db.collection("properties").find({ _id: { $in: [...new Set(raw.map((c) => String(c["propertyId"])))] as never } }, { projection: { title: 1, slug: 1 } }).toArray(),
      ]);
      const names = new Map(people.map((p) => [String(p._id), String(p["username"])]));
      const listing = new Map(props.map((p) => [String(p._id), { title: String(p["title"]), slug: String(p["slug"]) }]));
      const rows = await Promise.all(raw.map(async (c) => ({
        id: String(c["_id"]), text: await decrypt((c["textEnc"] as string | null) ?? null), author: names.get(String(c["userId"])) ?? "former_member",
        listing: listing.get(String(c["propertyId"])) ?? null, createdAt: (c["createdAt"] as Date).toISOString(), isReply: !!c["parentId"],
      })));
      return toPage(rows, total, data.offset);
    });
  });

export const adminRemoveComment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("editor", { section: "comments" });
    const c = await import("./comments.server");
    await adminDb((db) => c.blank(db, { _id: data.id }));
    c.clearDiscussionCache();
    await audit(me, "comment_removed", { id: data.id });
    return { ok: true };
  });

/* ---------- Payments (boosts and Premium packages) ---------- */

export const adminListPayments = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, adminDb } = await srv();
  await requireAdmin("admin");
  const { listPayments } = await import("./payments.server");
  return adminDb(async (db) => {
    const rows = await listPayments(db, {}, 100);
    const titles = new Map((await db.collection("properties").find({ _id: { $in: rows.flatMap((r) => (r.propertyId ? [r.propertyId] : [])) as never[] } }, { projection: { title: 1, referenceCode: 1 } }).toArray()).map((p) => [String(p["_id"]), `${p["title"]} (${p["referenceCode"]})`]));
    const agencies = new Map((await db.collection("agencies").find({ _id: { $in: [...new Set(rows.map((r) => r.agencyId))] as never[] } }, { projection: { name: 1 } }).toArray()).map((a) => [String(a["_id"]), String(a["name"])]));
    const paid = rows.filter((r) => r.status === "paid");
    return { rows: rows.map((r) => ({ ...r, listing: r.propertyId ? (titles.get(r.propertyId) ?? r.propertyId) : `Premium package, ${r.slots} listings`, agency: agencies.get(r.agencyId) ?? r.agencyId })), paidTotalKes: paid.reduce((n, r) => n + r.amountKes, 0), paidCount: paid.length };
  });
});

export const adminSearchReport = createServerFn({ method: "GET" })
  .inputValidator(async (d) => (await import("./search-terms.server")).searchReportInput.parse(d))
  .handler(async ({ data }) => { const { requireAdmin, adminDb } = await srv(); await requireAdmin("editor", { section: "analytics" }); const r = await import("./search-terms.server"); return adminDb((db) => r.searchReport(db, data.days)); });

export const adminRevenue = createServerFn({ method: "GET" })
  .inputValidator(async (d) => (await import("./revenue.server")).revenueInput.parse(d))
  .handler(async ({ data }) => { const { requireAdmin, adminDb } = await srv(); await requireAdmin("admin"); const r = await import("./revenue.server"); return adminDb((db) => r.revenueReport(db, data.days)); });

export const adminRefundPayment = createServerFn({ method: "POST" })
  .inputValidator(async (d) => (await import("./revenue.server")).refundInput.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("admin");
    const r = await import("./revenue.server");
    const out = await adminDb((db) => r.refundPayment(db, data, me.username));
    if (out.ok) await audit(me, "payment_refunded", { id: data.id });
    return out;
  });

export const adminRecordPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ reference: z.string().trim().min(3).max(40), days: z.number().int().min(1).max(365), amountKes: z.number().int().min(0).max(10_000_000), receipt: z.string().trim().max(40).nullable() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("admin");
    const { recordManualPayment } = await import("./payments.server");
    const out = await adminDb(async (db) => {
      const p = await db.collection("properties").findOne({ $or: [{ referenceCode: data.reference.toUpperCase() }, { slug: data.reference }] }, { projection: { _id: 1 } });
      if (!p) throw new Error("No listing has that reference code");
      return recordManualPayment(db, { propertyId: String(p["_id"]), days: data.days, amountKes: data.amountKes, receipt: data.receipt, adminName: me.username });
    });
    await audit(me, "payment_recorded", { reference: data.reference, days: data.days, amountKes: data.amountKes });
    return out;
  });

export const adminRecordPackage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ agencySlug: z.string().trim().min(2).max(120), slots: z.number().int().min(1).max(2000), amountKes: z.number().int().min(0).max(100_000_000), receipt: z.string().trim().max(40).nullable() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("admin");
    const { recordManualPackage } = await import("./payments.server");
    const out = await adminDb(async (db) => {
      const a = await db.collection("agencies").findOne({ slug: data.agencySlug }, { projection: { _id: 1 } });
      if (!a) throw new Error("No agency has that address name");
      return recordManualPackage(db, { agencyId: String(a["_id"]), slots: data.slots, amountKes: data.amountKes, receipt: data.receipt, adminName: me.username });
    });
    await audit(me, "package_recorded", { agency: data.agencySlug, slots: data.slots, amountKes: data.amountKes });
    return out;
  });

export const adminRecordSpace = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ agencySlug: z.string().trim().min(2).max(120), amountKes: z.number().int().min(0).max(100_000_000), receipt: z.string().trim().max(40).nullable() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("admin");
    const { recordManualSpace } = await import("./payments.server");
    const out = await adminDb(async (db) => {
      const a = await db.collection("agencies").findOne({ slug: data.agencySlug }, { projection: { _id: 1 } });
      if (!a) throw new Error("No agency has that address name");
      return recordManualSpace(db, { agencyId: String(a["_id"]), amountKes: data.amountKes, receipt: data.receipt });
    });
    await audit(me, "space_recorded", { agency: data.agencySlug, amountKes: data.amountKes });
    return out;
  });

/** Staff-assisted password reset for someone with no recovery codes left. Shows a one-time temporary password to the admin, who passes it on after checking who is asking. */
export const adminResetUserPassword = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, audit } = await srv();
    const me = await requireAdmin("admin");
    const { authDb, users, userSessions, hashPassword } = await import("./auth.server");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const temp = Array.from(crypto.getRandomValues(new Uint8Array(14)), (b) => alphabet[b % alphabet.length]).join("");
    const r = await authDb(async (db) => {
      const r = await users(db).updateOne({ _id: data.id }, { $set: { passwordHash: await hashPassword(temp) } });
      await userSessions(db).deleteMany({ userId: data.id });
      return r;
    });
    if (!r.matchedCount) throw new Error("This account no longer exists");
    await audit(me, "user_password_reset", { id: data.id });
    return { password: temp };
  });

/* ---------- Agency reviews ---------- */

export const adminListFlaggedReviews = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, adminDb } = await srv();
  await requireAdmin("editor", { section: "reviews" });
  const { listFlagged } = await import("./agency-reviews.server");
  return adminDb((db) => listFlagged(db));
});

export const adminModerateReview = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().min(1).max(64), action: z.enum(["restore", "remove"]) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("editor", { section: "reviews" });
    const { moderateReview } = await import("./agency-reviews.server");
    const out = await adminDb((db) => moderateReview(db, data.id, data.action));
    await audit(me, data.action === "remove" ? "review_removed" : "review_restored", { id: data.id });
    return out;
  });

/* ---------- Bulk listing work and exports ---------- */

export const adminBulkListingAction = createServerFn({ method: "POST" })
  .inputValidator(async (d) => (await analytics()).adminBulkInput.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit, accounts, verifyPassword } = await srv();
    const me = await requireAdmin(data.action === "delete" ? "admin" : "editor");
    const a = await analytics();
    const r = await adminDb((db) => a.adminBulkListings(db, data, async (pw) => { const acc = await accounts(db).findOne({ _id: me.id }); return !!acc && (await verifyPassword(pw, acc.passwordHash)); }));
    await audit(me, `listings_bulk_${data.action}`, { count: r.done, skipped: r.skipped.length });
    return r;
  });

export const adminExportCsv = createServerFn({ method: "GET" })
  .inputValidator(async (d) => (await analytics()).exportKind.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("admin");
    const a = await analytics();
    const csv = await adminDb((db) => a.adminExport(db, data.kind));
    await audit(me, `export_${data.kind}`, {});
    return csv;
  });

/* ---------- Errors ---------- */

export const adminListErrors = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, adminDb } = await srv();
  await requireAdmin("admin");
  const { listErrors } = await import("./error-alerts.server");
  return adminDb((db) => listErrors(db));
});

export const adminResolveError = createServerFn({ method: "POST" }).inputValidator((d) => z.object({ id: z.string().min(1).max(64) }).parse(d)).handler(async ({ data }) => {
  const { requireAdmin, adminDb } = await srv();
  await requireAdmin("admin");
  const { resolveError } = await import("./error-alerts.server");
  await adminDb((db) => resolveError(db, data.id));
  return { ok: true as const };
});

/* ---------- Two-step sign-in ---------- */

const twoFa = () => import("./admin-2fa.server");
const pwIn = z.string().min(1).max(200);
const codeIn = z.string().trim().min(6).max(20);

export const adminBegin2fa = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin, adminDb } = await srv();
  const me = await requireAdmin("editor", { allowWithout2fa: true });
  return adminDb(async (db) => (await twoFa()).begin2fa(db, me.id));
});

export const adminConfirm2fa = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: pwIn, code: codeIn }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("editor", { allowWithout2fa: true });
    const r = await adminDb(async (db) => (await twoFa()).confirm2fa(db, me.id, data.password, data.code));
    if (r.ok) await audit(me, "2fa_enabled");
    return r;
  });

export const adminDisable2fa = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: pwIn, code: codeIn }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit, twoFactorRequired } = await srv();
    const me = await requireAdmin("editor", { allowWithout2fa: true });
    if (twoFactorRequired()) return { ok: false as const, error: "This site requires two-step sign-in, so it cannot be turned off." };
    const r = await adminDb(async (db) => (await twoFa()).disable2fa(db, me.id, data.password, data.code));
    if (r.ok) await audit(me, "2fa_disabled");
    return r;
  });

export const adminNewBackupCodes = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: pwIn, code: codeIn }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("editor");
    const r = await adminDb(async (db) => (await twoFa()).newBackupCodes(db, me.id, data.password, data.code));
    if (r.ok) await audit(me, "2fa_backup_codes_renewed");
    return r;
  });

/** A full admin clears a colleague's two-step sign-in after they lost their phone and backup codes. */
export const adminReset2fa = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("admin");
    if (data.id === me.id) return { ok: false as const, error: "Use My account to change your own two-step sign-in." };
    await adminDb(async (db) => (await twoFa()).resetSecondFactor(db, data.id));
    await audit(me, "2fa_reset", { target: data.id });
    return { ok: true as const };
  });

/* ---------- App settings (prices, limits, quotas, ranking) ---------- */

export const adminGetAppSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await srv();
  await requireAdmin("admin");
  const { getSettings } = await import("./settings.server");
  const { SETTINGS, SETTING_GROUPS } = await import("./settings-registry");
  return { values: await getSettings(), defs: SETTINGS.map((d) => ({ ...d })), groups: [...SETTING_GROUPS] };
});

export const adminSaveAppSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ values: z.record(z.string().max(60), z.union([z.number(), z.boolean()])) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, audit } = await srv();
    const me = await requireAdmin("admin");
    const { saveSettings } = await import("./settings.server");
    const r = await saveSettings(data.values);
    if (r.ok && r.changes.length) await audit(me, "settings_changed", { changes: r.changes.slice(0, 40) });
    return r;
  });

/* ---------- Feedback inbox ---------- */

export const adminListFeedback = createServerFn({ method: "GET" })
  .inputValidator(async (d) => (await import("./feedback.server")).feedbackFilter.parse(d ?? {}))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb } = await srv();
    await requireAdmin("editor", { section: "feedback" });
    const f = await import("./feedback.server");
    return adminDb((db) => f.listFeedback(db, data));
  });

export const adminUpdateFeedback = createServerFn({ method: "POST" })
  .inputValidator(async (d) => (await import("./feedback.server")).feedbackUpdate.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb } = await srv();
    await requireAdmin("editor", { section: "feedback" });
    const f = await import("./feedback.server");
    return adminDb((db) => f.updateFeedback(db, data));
  });

export const adminListNeighbourhoodFlags = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, adminDb } = await srv();
  await requireAdmin("editor", { section: "moderation" });
  const { listFlagged } = await import("./neighbourhoods.server");
  return adminDb((db) => listFlagged(db));
});
export const adminModerateNeighbourhoodItem = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ kind: z.enum(["review", "post"]), id: z.string().min(1).max(64), action: z.enum(["restore", "remove"]) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb, audit } = await srv();
    const me = await requireAdmin("editor", { section: "moderation" });
    const { moderateItem } = await import("./neighbourhoods.server");
    const out = await adminDb((db) => moderateItem(db, data.kind, data.id, data.action));
    await audit(me, data.action === "remove" ? "neighbourhood_item_removed" : "neighbourhood_item_restored", { kind: data.kind, id: data.id });
    return out;
  });
