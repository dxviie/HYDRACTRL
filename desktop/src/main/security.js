/**
 * Renderer hardening. Every window runs with context isolation and the
 * sandbox; this module decides what those pages may still do: which
 * permissions they get (microphone for a.fft, MIDI, clipboard, screen
 * capture for s0.initScreen()), where they may navigate, and which popups
 * are allowed (the breakout window) versus opened in the system browser.
 */

const ALLOWED_PERMISSIONS = new Set([
  "media",
  "midi",
  "midiSysex",
  "clipboard-read",
  "clipboard-sanitized-write",
  "display-capture",
  "fullscreen",
  "pointerLock",
  "window-management",
  "speaker-selection",
]);

const EXTERNAL_HOSTS = new Set([
  "github.com",
  "hydra.ojack.xyz",
  "dxviie.github.io",
  "hydractrl.d17e.dev",
  "d17e.dev",
  "www.d17e.dev",
  "ndi.video",
  "syphon.github.io",
  "spout.zeal.co",
  "resolume.com",
  "obsproject.com",
  "derivative.ca",
]);

/** External links the app itself may open (Help menu, settings window). */
export function isAllowedExternalUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && EXTERNAL_HOSTS.has(parsed.hostname);
  } catch (_error) {
    return false;
  }
}

/** Origins the local server answers on; localhost and 127.0.0.1 are the same server. */
export function serverOrigins(serverUrl) {
  if (!serverUrl) return [];
  try {
    const parsed = new URL(serverUrl);
    return [`http://127.0.0.1:${parsed.port}`, `http://localhost:${parsed.port}`];
  } catch (_error) {
    return [];
  }
}

/**
 * Is a URL one of our own pages: a bundled file, the breakout popup, or a page
 * on the local HYDRACTRL server?
 */
export function isTrustedUrl(url, origins) {
  if (!url || url === "about:blank") return true;
  if (url.startsWith("file://") || url.startsWith("devtools://")) return true;
  try {
    const parsed = new URL(url);
    return origins.includes(parsed.origin);
  } catch (_error) {
    return false;
  }
}

export function createSecurityPolicy({ getServerUrl, shell, desktopCapturer, log }) {
  const origins = () => serverOrigins(getServerUrl());

  function openExternally(url) {
    if (!/^https?:\/\//.test(url)) return;
    shell.openExternal(url).catch((error) => log.warn(`could not open ${url}: ${error.message}`));
  }

  function installOnSession(session) {
    session.setPermissionRequestHandler((contents, permission, callback, details) => {
      const requester = details?.requestingUrl || contents.getURL();
      const allowed = ALLOWED_PERMISSIONS.has(permission) && isTrustedUrl(requester, origins());
      if (!allowed) log.warn(`denied permission "${permission}" for ${requester}`);
      callback(allowed);
    });

    session.setPermissionCheckHandler((contents, permission, requestingOrigin) => {
      const requester = requestingOrigin || contents?.getURL() || "";
      return ALLOWED_PERMISSIONS.has(permission) && isTrustedUrl(requester, origins());
    });

    // Screen capture (hydra's s0.initScreen()) needs a source picked in the
    // main process. Use the system picker where the OS has one, else the
    // primary screen.
    if (typeof session.setDisplayMediaRequestHandler === "function") {
      session.setDisplayMediaRequestHandler(
        (_request, callback) => {
          desktopCapturer
            .getSources({ types: ["screen"] })
            .then((sources) => callback(sources.length > 0 ? { video: sources[0] } : {}))
            .catch((error) => {
              log.warn(`screen capture failed: ${error.message}`);
              callback({});
            });
        },
        { useSystemPicker: true },
      );
    }
  }

  function attachToContents(contents) {
    contents.on("will-navigate", (event, url) => {
      if (isTrustedUrl(url, origins())) return;
      event.preventDefault();
      openExternally(url);
    });

    contents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });

    contents.setWindowOpenHandler(({ url }) => {
      if (isTrustedUrl(url, origins())) {
        // The breakout window and any same-origin popup: a plain child window
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            backgroundColor: "#000000",
            autoHideMenuBar: true,
            webPreferences: {
              backgroundThrottling: false,
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
            },
          },
        };
      }
      openExternally(url);
      return { action: "deny" };
    });
  }

  return { installOnSession, attachToContents, openExternally };
}
