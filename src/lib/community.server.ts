import { MongoClient, type Db } from "mongodb";

// Server-only: the shared MongoDB connection and field encryption (used for emails and phone numbers).
// Database name. Set MONGODB_DB to override (the default is "hodii").
const DB_NAME = process.env["MONGODB_DB"]?.trim() || "hodii";

// One shared client per server instance. Vercel (Fluid compute) keeps an instance alive and
// reuses it across requests, so DNS + TLS + auth happen once instead of on every call. That
// handshake was the bulk of this site's Active CPU time.
const shared = globalThis as unknown as { __hodiiMongo: Promise<MongoClient> | undefined };

function sharedClient(uri: string): Promise<MongoClient> {
  shared.__hodiiMongo ??= new MongoClient(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5, maxIdleTimeMS: 30_000 })
    .connect()
    .catch((e: unknown) => {
      shared.__hodiiMongo = undefined; // let the next request retry instead of caching the failure
      throw e;
    });
  return shared.__hodiiMongo;
}

export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("Database is not configured");
  const db = (await sharedClient(uri)).db(DB_NAME);
  return fn(db);
}

let keyPromise: Promise<CryptoKey> | null = null;
let keySecret: string | null = null;
function key() {
  const secret = process.env["COMMUNITY_ENCRYPTION_KEY"];
  if (!secret) throw new Error("Encryption key is not configured");
  if (keySecret !== secret) { keySecret = secret; keyPromise = null; }
  keyPromise ??= crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(secret))
    .then((raw) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]));
  return keyPromise;
}

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** AES-256-GCM; stored as "v1:<base64(iv|ciphertext)>". */
export async function encrypt(text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(text)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return `v1:${toB64(out)}`;
}

export async function decrypt(value: string | null | undefined): Promise<string> {
  if (!value) return "";
  if (!value.startsWith("v1:")) return "";
  const raw = fromB64(value.slice(3));
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, await key(), raw.slice(12));
    return new TextDecoder().decode(pt);
  } catch {
    // Locked with a different key: show nothing rather than failing the whole page.
    console.error("community: could not unlock a stored field (encryption key mismatch?)");
    return "";
  }
}
