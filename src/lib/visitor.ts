/** Anonymous browser id, shared with page-view tracking. Falls back to a fixed value where storage is blocked. */
export function visitorId() {
  try {
    let id = localStorage.getItem("mn_vid");
    if (!id) { id = crypto.randomUUID().replace(/-/g, ""); localStorage.setItem("mn_vid", id); }
    return id;
  } catch { return "anonymous0"; }
}
