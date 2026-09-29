/**
 * Media folder: images and videos for sketches, served at /media/ so a sketch
 * loads them with s0.initImage("/media/photo.jpg") or
 * s0.initVideo("/media/clip.mp4"), in the interface and on every /output page.
 *
 * Only the desktop app turns this on. It starts the server with the folder in
 * HYDRACTRL_MEDIA_DIR and, when the folder changes in its settings, writes a
 * control line to the server's stdin:
 *
 *   {"type":"media-folder","path":"/Users/me/Movies/Clips"}
 *
 * A server started any other way (bun dev, the standalone executable) has no
 * media folder, and the hosted site has no server at all.
 *
 * Only files with an image or video extension are served, never a folder
 * listing, a hidden file or anything outside the folder. Byte ranges are
 * supported: Chromium asks for them to play, loop and seek a video.
 */
import { stat } from "node:fs/promises";
import { posix, win32 } from "node:path";

export type MediaKind = "image" | "video";

/**
 * What the media folder serves. The desktop app imports exactly these
 * (desktop/src/main/media.js, kept in step by a test).
 */
export const MEDIA_TYPES: Readonly<Record<string, { kind: MediaKind; type: string }>> =
  Object.freeze({
    ".png": { kind: "image", type: "image/png" },
    ".jpg": { kind: "image", type: "image/jpeg" },
    ".jpeg": { kind: "image", type: "image/jpeg" },
    ".gif": { kind: "image", type: "image/gif" },
    ".webp": { kind: "image", type: "image/webp" },
    ".avif": { kind: "image", type: "image/avif" },
    ".bmp": { kind: "image", type: "image/bmp" },
    ".svg": { kind: "image", type: "image/svg+xml" },
    ".mp4": { kind: "video", type: "video/mp4" },
    ".m4v": { kind: "video", type: "video/mp4" },
    ".mov": { kind: "video", type: "video/quicktime" },
    ".webm": { kind: "video", type: "video/webm" },
    ".ogv": { kind: "video", type: "video/ogg" },
  });

export const MEDIA_PREFIX = "/media/";

/** Longest control line kept while waiting for its newline. */
const MAX_CONTROL_LINE = 64 * 1024;

const pathFor = (platform: string) => (platform === "win32" ? win32 : posix);

/**
 * Whether a file or folder name in a /media/ URL may be served: not hidden
 * (which also rules out "." and ".."), and no character the platform reads
 * as a separator, a drive or a stream.
 */
export function isServableName(name: string, platform: string = process.platform): boolean {
  if (!name || name.startsWith(".") || name.includes("/") || name.includes("\0")) return false;
  return !(platform === "win32" && /[\\:]/.test(name));
}

/**
 * The file a /media/ URL path points at, or null when it isn't a media file
 * inside the folder.
 */
export function resolveMediaPath(
  folder: string,
  urlPath: string,
  platform: string = process.platform,
): string | null {
  if (!urlPath.startsWith(MEDIA_PREFIX)) return null;
  const names: string[] = [];
  for (const segment of urlPath.slice(MEDIA_PREFIX.length).split("/")) {
    let name: string;
    try {
      name = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (!isServableName(name, platform)) return null;
    names.push(name);
  }
  const path = pathFor(platform);
  if (!MEDIA_TYPES[path.extname(names[names.length - 1]).toLowerCase()]) return null;
  const root = path.resolve(folder);
  const file = path.resolve(root, ...names);
  // The names can't climb out, but never serve anything outside the folder
  const inside = path.relative(root, file);
  if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) return null;
  return file;
}

export interface ByteRange {
  start: number;
  /** Inclusive */
  end: number;
}

/**
 * The byte range a Range header asks for. Null means send the whole file: no
 * header, another unit, several ranges or an invalid one (all of which a
 * server may answer with the whole file).
 */
export function parseRange(
  header: string | null,
  size: number,
): ByteRange | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, first, last] = match;
  if (first === "") {
    if (last === "") return null;
    // The final `last` bytes
    const length = Number(last);
    if (length === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - length), end: size - 1 };
  }
  const start = Number(first);
  if (start >= size) return "unsatisfiable";
  const end = last === "" ? size - 1 : Math.min(Number(last), size - 1);
  return end < start ? null : { start, end };
}

/** A control line from the desktop app, or null for anything else. */
export function parseControlLine(line: string): { type: "media-folder"; path: string } | null {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return null;
  }
  if (!message || typeof message !== "object") return null;
  const { type, path } = message as Record<string, unknown>;
  return type === "media-folder" && typeof path === "string" ? { type, path } : null;
}

/** Call `onLine` for every non-empty line that arrives on a text stream. */
export function readLines(stream: NodeJS.ReadableStream, onLine: (line: string) => void) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string | Buffer) => {
    buffer += String(chunk);
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onLine(line);
      newline = buffer.indexOf("\n");
    }
    if (buffer.length > MAX_CONTROL_LINE) buffer = "";
  });
  stream.on("error", () => {});
}

function isNotModified(headers: Headers, etag: string, mtimeMs: number) {
  const ifNoneMatch = headers.get("if-none-match");
  if (ifNoneMatch !== null) {
    return ifNoneMatch.split(",").some((tag) => {
      const value = tag.trim();
      return value === "*" || value === etag || value === `W/${etag}`;
    });
  }
  const since = Date.parse(headers.get("if-modified-since") ?? "");
  return !Number.isNaN(since) && Math.floor(mtimeMs / 1000) * 1000 <= since;
}

export interface MediaFolderOptions {
  /** The folder to serve; anything but an absolute path leaves it off. */
  folder?: string | null;
  log?: (message: string) => void;
  platform?: string;
}

export function createMediaFolder({
  folder = null,
  log = () => {},
  platform = process.platform,
}: MediaFolderOptions = {}) {
  const path = pathFor(platform);
  const normalize = (value: unknown) =>
    typeof value === "string" && value.trim() && path.isAbsolute(value.trim())
      ? path.resolve(value.trim())
      : null;
  let current = normalize(folder);

  /** Serve another folder from now on. Returns false (and keeps the old one) for a bad path. */
  function setFolder(next: unknown) {
    const normalized = normalize(next);
    if (!normalized) {
      log(`media: ignored folder ${JSON.stringify(next)}, it is not an absolute path`);
      return false;
    }
    current = normalized;
    log(`media: serving ${current} at ${MEDIA_PREFIX}`);
    return true;
  }

  /** Apply a control line from the desktop app. */
  function control(line: string) {
    const message = parseControlLine(line);
    if (message) setFolder(message.path);
  }

  function notFound(pathname: string) {
    log(`media: not found ${pathname}`);
    return new Response("Not found", { status: 404 });
  }

  async function respond(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const file = current ? resolveMediaPath(current, pathname, platform) : null;
    if (!file) return notFound(pathname);
    let info: Awaited<ReturnType<typeof stat>>;
    try {
      info = await stat(file);
    } catch {
      return notFound(pathname);
    }
    if (!info.isFile()) return notFound(pathname);

    const size = Number(info.size);
    const mtimeMs = Number(info.mtimeMs);
    const etag = `"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`;
    const lastModified = new Date(mtimeMs).toUTCString();
    // No max-age: every run of a sketch asks again, so a replaced file shows up
    const validators = { ETag: etag, "Last-Modified": lastModified, "Cache-Control": "no-cache" };
    if (isNotModified(request.headers, etag, mtimeMs)) {
      return new Response(null, { status: 304, headers: validators });
    }

    const type = MEDIA_TYPES[path.extname(file).toLowerCase()].type;
    const headers: Record<string, string> = {
      ...validators,
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    };
    // An SVG opened on its own must not run scripts on this origin
    if (type === "image/svg+xml") headers["Content-Security-Policy"] = "sandbox";

    // If-Range: a range of a file that has changed since would be garbage
    const ifRange = request.headers.get("if-range");
    const rangeHeader =
      ifRange === null || ifRange === etag || ifRange === lastModified
        ? request.headers.get("range")
        : null;
    const range = parseRange(rangeHeader, size);
    if (range === "unsatisfiable") {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${size}` },
      });
    }
    const body = Bun.file(file);
    if (range) {
      return new Response(body.slice(range.start, range.end + 1), {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
          "Content-Length": String(range.end - range.start + 1),
        },
      });
    }
    return new Response(body, { headers: { ...headers, "Content-Length": String(size) } });
  }

  return { getFolder: () => current, setFolder, control, respond };
}

export type MediaFolder = ReturnType<typeof createMediaFolder>;
