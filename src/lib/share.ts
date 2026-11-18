/** Share a link the most reliable way available: the phone's share sheet, else copy to the clipboard, else an old-style copy. Never silent: the caller gets what happened. */
export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareLink(title: string, url: string, text?: string): Promise<ShareResult> {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function" && (typeof navigator.canShare !== "function" || navigator.canShare({ url }))) {
      await navigator.share({ title, url, ...(text ? { text } : {}) });
      return "shared";
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled"; // the person closed the share sheet
    // Any other failure (blocked, not allowed here): fall through to copying.
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch { /* clipboard blocked: try the old way */ }
  try {
    const t = document.createElement("textarea");
    t.value = url; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok ? "copied" : "failed";
  } catch { return "failed"; }
}
