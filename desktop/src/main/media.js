/**
 * Local media for sketches. Images and videos dropped on the editor are
 * copied into the media folder, which the HYDRACTRL server serves at /media/
 * (src/server/mediaFolder.ts), and the interface adds a line that loads each
 * one, such as s0.initVideo("/media/clip.mp4"). A file that is already in
 * the folder is used where it is, and dropping the same file twice reuses
 * the first copy.
 *
 * The file system and the path flavour are injected, so the tests run on a
 * temporary folder and can check Windows paths on any machine.
 */
import { constants } from "node:fs";
import * as nodePath from "node:path";

/**
 * What the server serves from the media folder, and what it is. Keep in step
 * with MEDIA_TYPES in src/server/mediaFolder.ts (a test checks).
 */
export const MEDIA_TYPES = Object.freeze({
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".webp": "image",
  ".avif": "image",
  ".bmp": "image",
  ".svg": "image",
  ".mp4": "video",
  ".m4v": "video",
  ".mov": "video",
  ".webm": "video",
  ".ogv": "video",
});

export const MEDIA_URL_PREFIX = "/media/";

/** Files per drop: a handful of sources, not a library import. */
export const MAX_IMPORT_FILES = 16;

/** Copies are named "clip-2.mp4" and so on up to this many. */
const MAX_NAME_ATTEMPTS = 1000;
const MAX_STEM_LENGTH = 100;
const COMPARE_CHUNK = 1 << 20;

/** "image", "video" or null, from a file name's extension. */
export function mediaKind(name) {
  return MEDIA_TYPES[nodePath.extname(String(name)).toLowerCase()] ?? null;
}

/**
 * Whether the server serves a file or folder by this name. The same rule as
 * isServableName in src/server/mediaFolder.ts (a test checks).
 */
export function isServableName(name, platform = process.platform) {
  if (!name || name.startsWith(".") || name.includes("/") || name.includes("\0")) return false;
  return !(platform === "win32" && /[\\:]/.test(name));
}

// Encoded in a media URL: what would change its meaning. Spaces and accents
// stay readable in the sketch; the browser encodes them when it loads it.
const URL_SPECIAL = new Set(["%", "#", "?", "\\"]);

/** The URL a sketch loads a file from, given its path inside the media folder. */
export function mediaUrl(relativePath, path = nodePath) {
  const segments = relativePath.split(path.sep).map((segment) =>
    Array.from(segment, (char) => {
      const code = char.codePointAt(0);
      return code < 32 || code === 127 || URL_SPECIAL.has(char) ? encodeURIComponent(char) : char;
    }).join(""),
  );
  // The browser trims spaces off the end of a URL
  return `${MEDIA_URL_PREFIX}${segments.join("/")}`.replace(/ +$/, (spaces) =>
    "%20".repeat(spaces.length),
  );
}

const UNSAFE_CHARACTERS = new Set(["<", ">", ":", '"', "/", "\\", "|", "?", "*"]);
const WINDOWS_DEVICE_NAMES = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * The name a copy gets: the original, with what some file systems refuse
 * (NTFS and exFAT drives) turned into "-", and without a leading dot, which
 * would make it a hidden file the server doesn't serve.
 */
export function safeFileName(name) {
  const cleaned = Array.from(String(name), (char) => {
    const code = char.codePointAt(0);
    const unsafe =
      code < 32 ||
      code === 127 ||
      (code >= 0xd800 && code <= 0xdfff) ||
      UNSAFE_CHARACTERS.has(char);
    return unsafe ? "-" : char;
  })
    .join("")
    .replace(/^[\s.]+|[\s.]+$/g, "");
  const extension = nodePath.extname(cleaned);
  let stem = Array.from(cleaned.slice(0, cleaned.length - extension.length))
    .slice(0, MAX_STEM_LENGTH)
    .join("")
    .trim();
  if (!stem) stem = "media";
  if (WINDOWS_DEVICE_NAMES.test(stem)) stem = `${stem}-file`;
  return `${stem}${extension}`;
}

/** "clip.mp4", "clip-2.mp4", "clip-3.mp4"... */
function candidateName(name, attempt) {
  if (attempt === 1) return name;
  const extension = nodePath.extname(name);
  return `${name.slice(0, name.length - extension.length)}-${attempt}${extension}`;
}

export function createMediaLibrary({
  getFolder,
  fs,
  path = nodePath,
  platform = process.platform,
  log,
}) {
  async function sameContent(first, second) {
    const a = await fs.open(first, "r");
    try {
      const b = await fs.open(second, "r");
      try {
        const bufferA = Buffer.alloc(COMPARE_CHUNK);
        const bufferB = Buffer.alloc(COMPARE_CHUNK);
        for (let position = 0; ; position += COMPARE_CHUNK) {
          const [readA, readB] = await Promise.all([
            a.read(bufferA, 0, COMPARE_CHUNK, position),
            b.read(bufferB, 0, COMPARE_CHUNK, position),
          ]);
          if (readA.bytesRead !== readB.bytesRead) return false;
          if (readA.bytesRead === 0) return true;
          const chunkA = bufferA.subarray(0, readA.bytesRead);
          if (!chunkA.equals(bufferB.subarray(0, readB.bytesRead))) return false;
        }
      } finally {
        await b.close();
      }
    } finally {
      await a.close();
    }
  }

  /** The file's path inside the folder when the server can serve it from there, else null. */
  async function servedPath(folder, file) {
    const [realFolder, realFile] = await Promise.all([fs.realpath(folder), fs.realpath(file)]);
    const inside = path.relative(realFolder, realFile);
    if (!inside || inside === ".." || inside.startsWith(`..${path.sep}`)) return null;
    if (path.isAbsolute(inside)) return null;
    return inside.split(path.sep).every((name) => isServableName(name, platform)) ? inside : null;
  }

  async function copyIntoFolder(folder, source, size) {
    const name = safeFileName(path.basename(source));
    for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt++) {
      const candidate = candidateName(name, attempt);
      const target = path.join(folder, candidate);
      const existing = await fs.stat(target).catch(() => null);
      if (existing) {
        if (existing.isFile() && existing.size === size && (await sameContent(source, target))) {
          return { name: candidate, status: "existing" };
        }
        continue;
      }
      try {
        // A clone where the file system can make one (APFS, Btrfs, ReFS): instant
        await fs.copyFile(source, target, constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE);
        return { name: candidate, status: "copied" };
      } catch (error) {
        if (error?.code === "EEXIST") continue;
        throw new Error(`could not be copied to the media folder (${error.message})`);
      }
    }
    throw new Error("could not be copied: the media folder has too many files with this name");
  }

  /**
   * Make one dropped file available at /media/. Returns
   * { name, kind, url, status } where status is "copied", "existing" (an
   * identical copy was already there) or "in-folder" (dropped from the
   * folder itself), and throws an Error with a short reason otherwise.
   */
  async function importFile(source) {
    if (typeof source !== "string" || !path.isAbsolute(source)) {
      throw new Error("is not a file on this computer");
    }
    const kind = mediaKind(path.basename(source));
    if (!kind) throw new Error("is not an image or video HYDRACTRL can play");
    const info = await fs.stat(source).catch(() => null);
    if (!info?.isFile()) throw new Error("is not a file");

    const folder = getFolder();
    try {
      await fs.mkdir(folder, { recursive: true });
    } catch (error) {
      throw new Error(`could not be copied: the media folder is not available (${error.message})`);
    }
    const inside = await servedPath(folder, source);
    if (inside) {
      log.info(`media: using ${source}, which is in the media folder`);
      return {
        name: path.basename(source),
        kind,
        url: mediaUrl(inside, path),
        status: "in-folder",
      };
    }
    const copy = await copyIntoFolder(folder, source, info.size);
    log.info(
      copy.status === "copied"
        ? `media: copied ${source} to ${path.join(folder, copy.name)}`
        : `media: ${source} is already in the media folder as ${copy.name}`,
    );
    return { name: copy.name, kind, url: mediaUrl(copy.name, path), status: copy.status };
  }

  /** Import dropped files in order; each result is { ok: true, ... } or { ok: false, name, error }. */
  async function importFiles(sources) {
    const results = [];
    for (const source of sources) {
      const name = typeof source === "string" && source ? path.basename(source) : "A dropped item";
      try {
        results.push({ ok: true, ...(await importFile(source)) });
      } catch (error) {
        log.warn(`media: could not import ${source || "a dropped item"}: ${error.message}`);
        results.push({ ok: false, name, error: error.message });
      }
    }
    return results;
  }

  return { importFile, importFiles };
}
