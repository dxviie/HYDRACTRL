/**
 * UrlSharePlugin - share sketches as URLs (GitHub issue #5).
 *
 * Alt/Opt+U copies a link with the current sketch encoded in the URL fragment
 * (e.g. https://host/#sketch=...). Opening such a link loads and runs the
 * sketch WITHOUT touching localStorage slots — nothing is persisted unless
 * the user explicitly saves.
 *
 * The codec functions are pure and exported for tests.
 */

const SKETCH_PARAM = "sketch";

/**
 * Encode sketch code into a URL-safe base64 string.
 * Uses encodeURIComponent before btoa so non-Latin1 characters survive,
 * matching the convention used by the bank export format.
 */
export function encodeSketch(code) {
  if (typeof code !== "string" || code.length === 0) return null;
  const base64 = btoa(encodeURIComponent(code));
  // base64url: keep the fragment clean and safe to paste anywhere
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode a sketch string produced by encodeSketch.
 * @returns {string|null} The code, or null if the payload is invalid.
 */
export function decodeSketch(encoded) {
  if (typeof encoded !== "string" || encoded.length === 0) return null;
  try {
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }
    return decodeURIComponent(atob(base64));
  } catch (_error) {
    return null;
  }
}

/**
 * Extract sketch code from a URL fragment like "#sketch=..." .
 * @param {string} hash - window.location.hash (leading "#" optional).
 * @returns {string|null}
 */
export function readSketchFromHash(hash) {
  if (typeof hash !== "string") return null;
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!fragment) return null;
  const params = new URLSearchParams(fragment);
  const encoded = params.get(SKETCH_PARAM);
  if (!encoded) return null;
  return decodeSketch(encoded);
}

/** Build a shareable URL for the given code, based on the current location. */
export function buildShareUrl(code, location) {
  const encoded = encodeSketch(code);
  if (!encoded) return null;
  return `${location.origin}${location.pathname}#${SKETCH_PARAM}=${encoded}`;
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  // Fallback for insecure contexts
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  return ok;
}

export function createUrlSharePlugin() {
  return {
    id: "url-share",
    name: "URL Sketch Sharing",
    description: "Copy the current sketch as a shareable link (Alt/Opt+U)",

    setup(ctx) {
      async function copyLink() {
        const code = ctx.editor.state.doc.toString();
        const url = buildShareUrl(code, window.location);
        if (!url) {
          ctx.notify("Nothing to share — the sketch is empty", { type: "error" });
          return null;
        }
        try {
          await copyToClipboard(url);
          ctx.notify("Sketch link copied to clipboard!", { type: "success" });
          ctx.events.emit("sketch:shared", { url });
          return url;
        } catch (error) {
          console.error("UrlSharePlugin: clipboard write failed:", error);
          ctx.notify("Could not copy link (clipboard unavailable)", { type: "error" });
          return null;
        }
      }

      function loadFromHash(hash) {
        const code = readSketchFromHash(hash);
        if (code === null) return false;
        ctx.editor.dispatch({ changes: { insert: code } });
        ctx.runCode();
        ctx.notify("Loaded sketch from URL (not saved to your banks)");
        ctx.events.emit("sketch:loaded-from-url", {});
        return true;
      }

      const onKeyDown = (event) => {
        if (
          event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          event.code === "KeyU"
        ) {
          event.preventDefault();
          copyLink();
        }
      };
      document.addEventListener("keydown", onKeyDown);

      // Live-load when the user pastes a sketch URL into the address bar
      const onHashChange = () => loadFromHash(window.location.hash);
      window.addEventListener("hashchange", onHashChange);

      return {
        api: { copyLink, loadFromHash },
        dispose() {
          document.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("hashchange", onHashChange);
        },
      };
    },
  };
}
