/**
 * notify - unified toast notifications.
 *
 * Replaces the half-dozen hand-rolled ".saved-notification" blocks that were
 * duplicated across the codebase, each with its own timers and cleanup bugs.
 */

const DEFAULT_DURATION_MS = 2000;
const FADE_MS = 500;

/**
 * Show a transient toast notification.
 * @param {string} message
 * @param {object} [options]
 * @param {"info"|"success"|"error"} [options.type]
 * @param {number} [options.duration] - Visible time in ms before fade-out.
 * @returns {HTMLElement|null} The toast element (null outside a DOM environment).
 */
export function notify(message, options = {}) {
  if (typeof document === "undefined") return null;
  const { type = "info", duration = DEFAULT_DURATION_MS } = options;

  const toast = document.createElement("div");
  toast.className = "saved-notification";
  if (type === "error") {
    toast.style.backgroundColor = "var(--color-error, rgba(255, 85, 85, 0.9))";
  } else if (type === "success") {
    toast.style.backgroundColor = "rgba(80, 250, 123, 0.85)";
  }
  toast.textContent = message;
  document.body.appendChild(toast);

  const dismiss = () => {
    toast.classList.add("fade-out");
    setTimeout(() => {
      toast.remove();
    }, FADE_MS);
  };

  toast.addEventListener("click", dismiss);
  setTimeout(dismiss, duration);
  return toast;
}

export function notifySuccess(message, options = {}) {
  return notify(message, { ...options, type: "success" });
}

export function notifyError(message, options = {}) {
  return notify(message, { ...options, type: "error", duration: options.duration ?? 4000 });
}
