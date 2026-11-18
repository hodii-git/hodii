import type { Db } from "mongodb";
import QRCode from "qrcode";
import { accounts, sha256, verifyPassword, type AdminAccountDoc } from "./admin.server";
import { decrypt, encrypt } from "./community.server";
import { generateRecoveryCodes, normalizeRecoveryCode } from "./recovery";
import { BRAND } from "./brand";
import { generateTotpSecret, otpauthUri, verifyTotp } from "./totp";

// Server-only: two-step sign-in for staff. The secret is encrypted at rest; backup codes are stored as digests and work once.

export type SecondFactorResult = "ok" | "wrong";

/** Checks an authenticator code (once per 30-second step) or a backup code (once ever). */
export async function checkSecondFactor(db: Db, acc: AdminAccountDoc, input: string): Promise<SecondFactorResult> {
  if (!acc.totp) return "ok";
  const text = input.trim();
  const backup = normalizeRecoveryCode(text);
  if (backup) {
    const digest = await sha256(backup);
    const hit = await accounts(db).updateOne({ _id: acc._id, backupHashes: digest }, { $pull: { backupHashes: digest } });
    return hit.modifiedCount === 1 ? "ok" : "wrong";
  }
  const secret = await decrypt(acc.totp.enc);
  const step = await verifyTotp(secret, text);
  if (step === null) return "wrong";
  // Atomic: only the first request to use this step wins, so a code seen over a shoulder cannot be replayed.
  const won = await accounts(db).updateOne({ _id: acc._id, "totp.lastStep": { $lt: step } }, { $set: { "totp.lastStep": step } });
  return won.modifiedCount === 1 ? "ok" : "wrong";
}

export async function begin2fa(db: Db, accountId: string) {
  const acc = await accounts(db).findOne({ _id: accountId });
  if (!acc) throw new Error("Account not found");
  if (acc.totp) throw new Error("Two-step sign-in is already on");
  const secret = generateTotpSecret();
  await accounts(db).updateOne({ _id: accountId }, { $set: { totpPending: { enc: await encrypt(secret), at: new Date() } } });
  const uri = otpauthUri(secret, acc.email, BRAND.name);
  return { secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 240 }) };
}

export async function confirm2fa(db: Db, accountId: string, password: string, code: string) {
  const acc = await accounts(db).findOne({ _id: accountId });
  if (!acc || !(await verifyPassword(password, acc.passwordHash))) return { ok: false as const, error: "Your password is not right." };
  if (!acc.totpPending || Date.now() - acc.totpPending.at.getTime() > 15 * 60_000) return { ok: false as const, error: "Start again: the setup code expired." };
  const step = await verifyTotp(await decrypt(acc.totpPending.enc), code);
  if (step === null) return { ok: false as const, error: "That code is not right. Check the time on your phone and try the next code." };
  const codes = generateRecoveryCodes(8);
  await accounts(db).updateOne({ _id: accountId }, { $set: { totp: { enc: acc.totpPending.enc, lastStep: step, enabledAt: new Date() }, backupHashes: await Promise.all(codes.map((c) => sha256(c))) }, $unset: { totpPending: "" } });
  return { ok: true as const, backupCodes: codes };
}

export async function disable2fa(db: Db, accountId: string, password: string, code: string) {
  const acc = await accounts(db).findOne({ _id: accountId });
  if (!acc || !(await verifyPassword(password, acc.passwordHash))) return { ok: false as const, error: "Your password is not right." };
  if (!acc.totp) return { ok: true as const };
  if ((await checkSecondFactor(db, acc, code)) !== "ok") return { ok: false as const, error: "That code is not right." };
  await accounts(db).updateOne({ _id: accountId }, { $unset: { totp: "", totpPending: "", backupHashes: "" } });
  return { ok: true as const };
}

/** For a colleague who lost their phone and backup codes. A full admin does this; it is logged by the caller. */
export const resetSecondFactor = (db: Db, accountId: string) => accounts(db).updateOne({ _id: accountId }, { $unset: { totp: "", totpPending: "", backupHashes: "" } });

export async function newBackupCodes(db: Db, accountId: string, password: string, code: string) {
  const acc = await accounts(db).findOne({ _id: accountId });
  if (!acc || !(await verifyPassword(password, acc.passwordHash))) return { ok: false as const, error: "Your password is not right." };
  if (!acc.totp || (await checkSecondFactor(db, acc, code)) !== "ok") return { ok: false as const, error: "That code is not right." };
  const codes = generateRecoveryCodes(8);
  await accounts(db).updateOne({ _id: accountId }, { $set: { backupHashes: await Promise.all(codes.map((c) => sha256(c))) } });
  return { ok: true as const, backupCodes: codes };
}
