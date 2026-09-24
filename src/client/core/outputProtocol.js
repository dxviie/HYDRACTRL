/**
 * Client-side half of the output protocol (see src/server/outputHub.ts):
 * URL and message helpers shared by the output-sync plugin (controller side)
 * and the output page (render side).
 */

export const OUTPUT_SOCKET_PATH = "/ws/output";
export const CAPABILITIES_PATH = "/api/capabilities";

/** ws(s):// URL of the output socket for the page's own origin. */
export function buildOutputSocketUrl(location, path = OUTPUT_SOCKET_PATH) {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}${path}`;
}

/** Parse a text frame into a typed message, or null when it is not one. */
export function parseSocketMessage(data) {
  if (typeof data !== "string") return null;
  try {
    const value = JSON.parse(data);
    if (value && typeof value === "object" && typeof value.type === "string") return value;
    return null;
  } catch (_error) {
    return null;
  }
}

/**
 * Is this page served by the HYDRACTRL server (which has the output socket),
 * as opposed to a static host such as the public demo site? Static hosts
 * rewrite unknown paths to index.html, so a JSON answer is the tell.
 */
export async function detectOutputServer(fetchImpl = globalThis.fetch, path = CAPABILITIES_PATH) {
  try {
    const response = await fetchImpl(path, { cache: "no-store" });
    if (!response.ok) return false;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return false;
    const body = await response.json();
    return body?.outputSync === true;
  } catch (_error) {
    return false;
  }
}
