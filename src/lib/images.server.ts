import { LISTING_LIMITS } from "./mongodb/limits";

// Server-only: signs direct-to-Cloudinary uploads so photos never pass through our server and the API secret never reaches the browser.
// This is the one place that knows about Cloudinary; swapping to S3 or R2 means replacing signUpload() and the URL check only.
export type UploadKind = "listing" | "logo" | "cover" | "avatar";

export const imagesConfigured = () => !!(process.env["CLOUDINARY_CLOUD_NAME"] && process.env["CLOUDINARY_API_KEY"] && process.env["CLOUDINARY_API_SECRET"]);

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
async function sha1(text: string) { return hex(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text))); }

/** Parameters the browser sends to Cloudinary. Signed fields are fixed here so a client cannot change the folder or format limits. */
export async function signUpload(agencyId: string, kind: UploadKind, now = Math.floor(Date.now() / 1000)) {
  const cloud = process.env["CLOUDINARY_CLOUD_NAME"], key = process.env["CLOUDINARY_API_KEY"], secret = process.env["CLOUDINARY_API_SECRET"];
  if (!cloud || !key || !secret) throw new Error("Photo uploads are not configured yet");
  const params: Record<string, string> = {
    allowed_formats: "jpg,jpeg,png,webp",
    folder: `hodii/${kind === "logo" ? "logos" : kind === "cover" ? "covers" : kind === "avatar" ? "avatars" : "listings"}/${agencyId}`,
    timestamp: String(now),
  };
  // Cloudinary signs the alphabetically sorted "k=v&k=v" string followed by the secret.
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return { uploadUrl: `https://api.cloudinary.com/v1_1/${cloud}/image/upload`, apiKey: key, signature: await sha1(toSign + secret), params, maxBytes: LISTING_LIMITS.imageBytesMax };
}

/** Only our own Cloudinary folder for this agency is accepted as a photo source. */
export function isOwnImageUrl(url: string, agencyId: string) {
  const cloud = process.env["CLOUDINARY_CLOUD_NAME"];
  if (!cloud) return false;
  return url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`) && /\/hodii\/(listings|logos)\//.test(url) && url.includes(`/${agencyId}/`);
}

/** A profile picture must sit in the person's own avatar folder. */
export function isOwnAvatarUrl(url: string, userId: string) {
  const cloud = process.env["CLOUDINARY_CLOUD_NAME"];
  return !!cloud && url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`) && url.includes(`/hodii/avatars/${userId}/`);
}

/** A smaller copy for cards and grids. Cloudinary builds it on first request from the stored original; links to other sites are shown as they are. */
export function thumbOf(url: string, width = 480) {
  return url.includes("res.cloudinary.com/") ? url.replace("/image/upload/", `/image/upload/c_limit,w_${width},q_auto,f_auto/`) : url;
}

/**
 * Photo rules when an agency saves a listing. Photos already on the listing are always kept, wherever they are hosted:
 * imported or bootstrapped listings may use links to other sites. A photo added in this save has to be a direct upload
 * into the agency's own folder, so an agency that takes over such a listing can replace the linked photos but never add new ones.
 * Returns the offending URLs (empty when everything is fine).
 */
export function foreignNewPhotos(next: readonly { url: string }[], existing: readonly { url: string }[], agencyId: string) {
  const kept = new Set(existing.map((i) => i.url));
  return next.filter((i) => !kept.has(i.url) && !isOwnImageUrl(i.url, agencyId)).map((i) => i.url);
}
