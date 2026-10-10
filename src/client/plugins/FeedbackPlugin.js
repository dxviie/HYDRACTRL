/**
 * FeedbackPlugin - send feedback without leaving the interface.
 *
 * Opens the landing page's contact form (a Tally form) in a panel, with the
 * HYDRACTRL version, desktop app or browser, OS and browser filled in as
 * hidden fields, so a bug report arrives with its context. The form stays in
 * a sandboxed, cross-origin frame: none of Tally's code runs on the
 * interface's own origin, where the scenes are stored. The frame tells us
 * when it has loaded and when it was sent (Tally.FormLoaded and
 * Tally.FormSubmitted messages).
 *
 * Opens on the "feedback:open" event (the About panel's button) and through
 * `window.showFeedbackPanel` (the system panel's button).
 */

import { FEEDBACK_FORM_ID, VERSION } from "../../project.js";
import { makeDraggable } from "../../utils/Draggable.js";

const TALLY_ORIGIN = "https://tally.so";
// Without a Tally.FormLoaded by then, the form is probably unreachable
const LOAD_TIMEOUT_MS = 12000;
const CLOSE_AFTER_SUBMIT_MS = 2500;

/**
 * What the form's hidden fields report besides the version. Takes a
 * navigator-like object so it can be tested.
 * @returns {{ app: "desktop"|"browser", os: string, browser: string }}
 */
export function describeSystem(nav, { desktop = false } = {}) {
  const ua = String(nav?.userAgent || "");
  const platform = String(nav?.userAgentData?.platform || nav?.platform || "");
  const touchPoints = Number(nav?.maxTouchPoints || 0);
  const major = (pattern) => ua.match(pattern)?.[1] || "";
  const named = (name, version) => (version ? `${name} ${version}` : name);

  let os = "other";
  if (/iPhone|iPod/.test(ua)) os = "iOS";
  // iPadOS in desktop mode reports a Mac, but Macs have no touch screen
  else if (/iPad/.test(ua) || (/Mac/.test(platform) && touchPoints > 1)) os = "iPadOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Mac/.test(platform) || /Mac OS X/.test(ua)) os = "macOS";
  else if (/Win/.test(platform) || /Windows/.test(ua)) os = "Windows";
  else if (/Linux|X11/.test(`${platform} ${ua}`)) os = "Linux";

  let browser = "other";
  if (/Electron\//.test(ua)) browser = named("Electron", major(/Electron\/(\d+)/));
  else if (/Edg(e|A|iOS)?\//.test(ua)) browser = named("Edge", major(/Edg(?:e|A|iOS)?\/(\d+)/));
  else if (/OPR\//.test(ua)) browser = named("Opera", major(/OPR\/(\d+)/));
  else if (/Firefox\/|FxiOS\//.test(ua))
    browser = named("Firefox", major(/(?:Firefox|FxiOS)\/(\d+)/));
  else if (/CriOS\//.test(ua)) browser = named("Chrome", major(/CriOS\/(\d+)/));
  else if (/Chrome\//.test(ua)) browser = named("Chrome", major(/Chrome\/(\d+)/));
  else if (/Safari\//.test(ua)) browser = named("Safari", major(/Version\/(\d+)/));

  return { app: desktop ? "desktop" : "browser", os, browser };
}

/**
 * The form's address with the hidden fields filled in: the embed for the
 * panel, or the stand-alone page to open in a browser.
 */
export function feedbackFormUrl(system, { version = VERSION, embed = true } = {}) {
  const params = new URLSearchParams(embed ? { hideTitle: "1", alignLeft: "1" } : {});
  params.set("source", "app");
  params.set("version", version);
  params.set("app", system.app);
  params.set("os", system.os);
  params.set("browser", system.browser);
  return `${TALLY_ORIGIN}/${embed ? "embed" : "r"}/${FEEDBACK_FORM_ID}?${params}`;
}

/** A Tally message from a message event, as { event, payload }, or null. */
export function readFormMessage(message) {
  if (message?.origin !== TALLY_ORIGIN || typeof message.data !== "string") return null;
  try {
    const data = JSON.parse(message.data);
    return typeof data?.event === "string" && data.event.startsWith("Tally.") ? data : null;
  } catch (_error) {
    return null;
  }
}

export function createFeedbackPlugin() {
  return {
    id: "feedback",
    name: "Feedback",
    description: "Send feedback through the contact form, with the version and system filled in",

    setup(ctx) {
      const isMobile = ctx.isMobile;
      const system = describeSystem(navigator, { desktop: Boolean(window.hydractrlDesktop) });
      let panel = null;
      let frame = null;
      let status = null;
      let loadTimer = null;
      let closeTimer = null;
      let loaded = false;
      let submitted = false;

      // Covers the frame while it loads, or explains why it didn't
      function showStatus(html) {
        status.innerHTML = html;
        status.style.display = html ? "flex" : "none";
      }

      function loadForm() {
        loaded = false;
        submitted = false;
        showStatus("Loading the form…");
        frame.src = feedbackFormUrl(system);
        clearTimeout(loadTimer);
        loadTimer = setTimeout(() => {
          if (loaded) return;
          const link = feedbackFormUrl(system, { embed: false });
          showStatus(
            `The form didn't load. It needs an internet connection; you can also <a href="${link}" target="_blank" rel="noopener" style="color: inherit">open it in your browser</a>.`,
          );
        }, LOAD_TIMEOUT_MS);
      }

      function createPanel() {
        panel = document.createElement("div");
        panel.id = "feedback-panel";
        panel.className = "feedback-panel";
        panel.style.position = "fixed";
        panel.style.top = "50%";
        panel.style.left = "50%";
        panel.style.transform = "translate(-50%, -50%)";
        panel.style.width = isMobile ? "92vw" : "440px";
        panel.style.maxWidth = "92vw";
        panel.style.maxHeight = "90vh";
        panel.style.display = "none";
        panel.style.flexDirection = "column";
        panel.style.backgroundColor = "rgba(var(--color-bg-secondary-rgb), var(--panel-opacity))";
        panel.style.borderRadius = "var(--panel-radius)";
        panel.style.boxShadow = "0 4px 15px var(--color-panel-shadow)";
        panel.style.backdropFilter = "blur(var(--color-panel-blur))";
        panel.style.zIndex = "1001";
        panel.style.overflow = "hidden";

        const header = document.createElement("div");
        header.className = "feedback-panel-header";
        header.style.backgroundColor = "rgba(var(--color-bg-tertiary-rgb), var(--panel-opacity))";
        header.style.padding = "4px 3px 4px 10px";
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.alignItems = "center";
        header.style.cursor = isMobile ? "default" : "move";

        const title = document.createElement("h2");
        title.textContent = "Feedback";
        title.style.margin = "0";
        title.style.fontSize = "11px";
        title.style.fontWeight = "600";
        title.style.letterSpacing = "0.08em";
        title.style.textTransform = "uppercase";
        title.style.color = "var(--color-text-secondary)";

        const closeButton = document.createElement("button");
        closeButton.textContent = "×";
        closeButton.title = "Close";
        closeButton.style.background = "none";
        closeButton.style.border = "none";
        closeButton.style.fontSize = "16px";
        closeButton.style.lineHeight = "1";
        closeButton.style.color = "var(--color-text-primary)";
        closeButton.style.padding = "0 5px";
        closeButton.addEventListener("click", hide);

        header.append(title, closeButton);

        const content = document.createElement("div");
        content.style.padding = "8px 10px 10px";
        content.style.overflowY = "auto";

        const intro = document.createElement("p");
        intro.style.margin = "0 0 8px";
        intro.style.fontSize = "12px";
        intro.style.lineHeight = "1.45";
        intro.style.color = "var(--color-text-secondary)";
        intro.textContent =
          "Found a bug, have an idea, or played a show with it? Along with your message, " +
          `the form gets your version and system: ${VERSION} · ${system.app} · ${system.os} · ${system.browser}.`;

        // The form keeps its own dark background, whatever the theme
        const formBox = document.createElement("div");
        formBox.style.position = "relative";
        formBox.style.height = "390px";
        formBox.style.maxHeight = "calc(90vh - 120px)";
        formBox.style.borderRadius = "4px";
        formBox.style.overflow = "hidden";
        formBox.style.backgroundColor = "#08080b";

        frame = document.createElement("iframe");
        frame.title = "Feedback form";
        frame.setAttribute(
          "sandbox",
          "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox",
        );
        frame.style.display = "block";
        frame.style.width = "100%";
        frame.style.height = "100%";
        frame.style.border = "0";

        status = document.createElement("div");
        status.className = "feedback-status";
        status.style.position = "absolute";
        status.style.inset = "0";
        status.style.display = "flex";
        status.style.alignItems = "center";
        status.style.justifyContent = "center";
        status.style.padding = "24px";
        status.style.textAlign = "center";
        status.style.fontSize = "12px";
        status.style.lineHeight = "1.5";
        status.style.color = "#aca6bd";
        status.style.backgroundColor = "#08080b";

        formBox.append(frame, status);
        content.append(intro, formBox);
        panel.append(header, content);
        document.body.appendChild(panel);

        if (!isMobile) makeDraggable(panel, header);
      }

      function onKeyDown(e) {
        if (e.key !== "Escape" || !panel || panel.style.display === "none") return;
        e.stopPropagation();
        hide();
      }

      function show() {
        if (!panel) createPanel();
        clearTimeout(closeTimer);
        // A fresh form every time, unless one is still being filled in
        if (!frame.src || submitted) loadForm();
        panel.style.display = "flex";
        document.addEventListener("keydown", onKeyDown, true);
      }

      function hide() {
        clearTimeout(closeTimer);
        if (panel) panel.style.display = "none";
        document.removeEventListener("keydown", onKeyDown, true);
      }

      function onMessage(e) {
        if (!frame || e.source !== frame.contentWindow) return;
        const message = readFormMessage(e);
        if (!message) return;
        if (message.event === "Tally.FormLoaded") {
          loaded = true;
          clearTimeout(loadTimer);
          showStatus("");
        } else if (message.event === "Tally.FormSubmitted") {
          submitted = true;
          ctx.notify("Thanks! Your feedback is on its way.", { type: "success" });
          closeTimer = setTimeout(hide, CLOSE_AFTER_SUBMIT_MS);
        }
      }

      window.addEventListener("message", onMessage);
      const offOpen = ctx.events.on("feedback:open", show);
      // The system panel's feedback button calls this global
      window.showFeedbackPanel = show;

      return {
        api: { show, hide },
        dispose() {
          clearTimeout(loadTimer);
          clearTimeout(closeTimer);
          window.removeEventListener("message", onMessage);
          document.removeEventListener("keydown", onKeyDown, true);
          offOpen();
          panel?.remove();
          if (window.showFeedbackPanel === show) window.showFeedbackPanel = undefined;
        },
      };
    },
  };
}
