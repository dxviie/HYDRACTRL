/**
 * Small file logger with size-based rotation. One file, one backup, no
 * dependencies. Every write is wrapped: logging must never take the app down.
 */
import { dirname } from "node:path";

const LEVEL_WIDTH = 5;

export function createLogger({
  filePath,
  fs,
  maxBytes = 2 * 1024 * 1024,
  mirror = null,
  now = () => new Date(),
}) {
  let ready = false;

  function ensureDir() {
    if (ready) return;
    fs.mkdirSync(dirname(filePath), { recursive: true });
    ready = true;
  }

  function rotateIfNeeded() {
    try {
      const size = fs.statSync(filePath).size;
      if (size < maxBytes) return;
      fs.renameSync(filePath, `${filePath}.1`);
    } catch (_error) {
      // No file yet, or rotation failed: either way keep writing
    }
  }

  function write(level, scope, message) {
    const line = `${now().toISOString()} ${level.padEnd(LEVEL_WIDTH)} [${scope}] ${message}\n`;
    try {
      ensureDir();
      rotateIfNeeded();
      fs.appendFileSync(filePath, line);
    } catch (_error) {
      // Disk full or unwritable: the mirror (if any) still gets the line
    }
    if (mirror) {
      const method = level === "ERROR" ? "error" : level === "WARN" ? "warn" : "log";
      mirror[method](line.trimEnd());
    }
  }

  function scoped(scope) {
    return {
      scope,
      info: (message) => write("INFO", scope, String(message)),
      warn: (message) => write("WARN", scope, String(message)),
      error: (message) => write("ERROR", scope, String(message)),
      child: (childScope) => scoped(childScope),
      path: filePath,
    };
  }

  return scoped("app");
}

/** Render an error for a log line: message plus the first stack frame. */
export function describeError(error) {
  if (!error) return "unknown error";
  if (typeof error === "string") return error;
  const message = error.message || String(error);
  const frame = typeof error.stack === "string" ? error.stack.split("\n")[1] : "";
  return frame ? `${message} (${frame.trim()})` : message;
}
