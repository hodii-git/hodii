import { getAvatarSignature } from "@/lib/account.functions";
import { getUploadSignature } from "@/lib/dashboard.functions";
import { LISTING_LIMITS } from "@/lib/mongodb/limits";
import { retry } from "@/lib/retry";

export type Uploaded = { id: string; url: string; thumbUrl: string | null; width: number; height: number; bytes: number; alt: string; caption: string | null };
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Checks a file in the browser before spending an upload on it. Returns a message, or null when the file is fine. */
export function photoProblem(f: File) {
  if (!TYPES.includes(f.type)) return `${f.name}: use a JPG, PNG or WebP photo`;
  if (f.size > LISTING_LIMITS.imageBytesMax) return `${f.name}: photos can be up to ${LISTING_LIMITS.imageBytesMax / 1024 / 1024} MB`;
  return null;
}

/** Sends one photo straight to Cloudinary with a signature from our server, and returns the stored image. */
export async function uploadPhoto(slug: string, kind: "listing" | "logo" | "cover", file: File): Promise<Uploaded> {
  const problem = photoProblem(file);
  if (problem) throw new Error(problem);
  return uploadWith(await getUploadSignature({ data: { slug, kind } }), file, { minWidth: LISTING_LIMITS.imageMinWidth, minHeight: LISTING_LIMITS.imageMinHeight });
}

/** A profile picture: any reasonable photo, 200 pixels or more on each side. */
export async function uploadAvatar(file: File): Promise<Uploaded> {
  const problem = photoProblem(file);
  if (problem) throw new Error(problem);
  return uploadWith(await getAvatarSignature(), file, { minWidth: 200, minHeight: 200 });
}

async function uploadWith(sig: Awaited<ReturnType<typeof getAvatarSignature>>, file: File, min: { minWidth: number; minHeight: number }): Promise<Uploaded> {
  const body = new FormData();
  body.set("file", file); body.set("api_key", sig.apiKey); body.set("signature", sig.signature);
  for (const [k, v] of Object.entries(sig.params)) body.set(k, v);
  // A dropped connection or a busy server is tried again up to three times; a refusal (wrong file, bad size) is not.
  const json = await retry(async () => {
    const res = await fetch(sig.uploadUrl, { method: "POST", body, signal: AbortSignal.timeout(60_000) });
    const j = (await res.json().catch(() => null)) as { secure_url?: string; public_id?: string; width?: number; height?: number; bytes?: number; error?: { message?: string } } | null;
    if (!res.ok || !j?.secure_url) throw Object.assign(new Error(j?.error?.message ?? `Could not upload ${file.name}`), { status: res.status });
    return j;
  });
  if ((json.width ?? 0) < min.minWidth || (json.height ?? 0) < min.minHeight) {
    throw new Error(`${file.name}: photos must be at least ${min.minWidth}×${min.minHeight} pixels`);
  }
  const url = json.secure_url as string;
  return { id: json.public_id ?? crypto.randomUUID(), url, thumbUrl: url.replace("/image/upload/", "/image/upload/c_limit,w_480,q_auto,f_auto/"), width: json.width ?? 0, height: json.height ?? 0, bytes: json.bytes ?? file.size, alt: "", caption: null };
}
