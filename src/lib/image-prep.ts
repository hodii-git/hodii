/** Makes any picture uploadable: reads whatever format the browser can open, never turns it away for its shape, scales huge ones down and tiny ones up, and re-saves it as a JPEG. */
const MAX_SIDE = 2400;
const EXT = /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif|tiff?|ico|svg|jfif|apng)$/i;

export const looksLikeImage = (f: File) => f.type.startsWith("image/") || EXT.test(f.name);

export async function prepareImage(file: File, min: { minWidth: number; minHeight: number } = { minWidth: 0, minHeight: 0 }): Promise<File> {
  if (!looksLikeImage(file)) throw new Error(`${file.name}: this is not a picture`);
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error(`${file.name}: this device cannot open that picture format. Save it as JPG or PNG and try again.`); }
  let { width: w, height: h } = bmp;
  // Too big: shrink. Too small: enlarge just enough, keeping its shape, so it is accepted rather than refused.
  const scaleDown = Math.min(1, MAX_SIDE / Math.max(w, h));
  const scaleUp = Math.max(1, min.minWidth / w, min.minHeight / h);
  const s = scaleDown < 1 ? scaleDown : scaleUp;
  w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bmp.close(); return file; }
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // flatten transparency
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h); bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
  if (!blob) return file;
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}
