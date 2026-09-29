import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import { createMediaLibrary, mediaKind, mediaUrl, safeFileName } from "./media.js";

const silentLog = { info() {}, warn() {}, error() {} };

describe("mediaKind", () => {
  test("tells images from videos by extension, in any case", () => {
    expect(mediaKind("photo.JPG")).toBe("image");
    expect(mediaKind("logo.svg")).toBe("image");
    expect(mediaKind("clip.mov")).toBe("video");
    expect(mediaKind("clip.webm")).toBe("video");
    expect(mediaKind("notes.pdf")).toBeNull();
    expect(mediaKind("song.mp3")).toBeNull();
    expect(mediaKind("README")).toBeNull();
  });
});

describe("mediaUrl", () => {
  test("keeps names readable and encodes what would change the URL", () => {
    expect(mediaUrl("photo.jpg")).toBe("/media/photo.jpg");
    expect(mediaUrl("My Clip.mp4")).toBe("/media/My Clip.mp4");
    expect(mediaUrl("café.png")).toBe("/media/café.png");
    expect(mediaUrl("50% #1?.png")).toBe("/media/50%25 %231%3F.png");
    expect(mediaUrl("tab\there.png")).toBe("/media/tab%09here.png");
    expect(mediaUrl("a\\b.png")).toBe("/media/a%5Cb.png");
    expect(mediaUrl("trailing.png  ")).toBe("/media/trailing.png%20%20");
  });

  test("joins folders with slashes on every platform", () => {
    expect(mediaUrl("clips/intro.mp4")).toBe("/media/clips/intro.mp4");
    expect(mediaUrl("clips\\intro.mp4", win32)).toBe("/media/clips/intro.mp4");
  });
});

describe("safeFileName", () => {
  test("keeps ordinary names", () => {
    expect(safeFileName("photo.jpg")).toBe("photo.jpg");
    expect(safeFileName("My Clip (1).MP4")).toBe("My Clip (1).MP4");
    expect(safeFileName("café.png")).toBe("café.png");
  });

  test("replaces what some file systems refuse and drops leading dots", () => {
    expect(safeFileName('clip: "take" 2?.mp4')).toBe("clip- -take- 2-.mp4");
    expect(safeFileName("a\u0001b.png")).toBe("a-b.png");
    expect(safeFileName(".hidden.png")).toBe("hidden.png");
    expect(safeFileName("clip.mp4. ")).toBe("clip.mp4");
    expect(safeFileName("CON.png")).toBe("CON-file.png");
  });

  test("shortens very long names but keeps the extension", () => {
    const name = safeFileName(`${"x".repeat(300)}.webm`);
    expect(name).toBe(`${"x".repeat(100)}.webm`);
  });
});

describe("createMediaLibrary", () => {
  let root;
  let folder;
  let outside;
  let logs;

  const library = (options = {}) =>
    createMediaLibrary({
      getFolder: () => folder,
      fs: fs.promises,
      log: { ...silentLog, info: (m) => logs.push(m), warn: (m) => logs.push(m) },
      ...options,
    });
  const write = (path, content) => {
    fs.mkdirSync(join(path, ".."), { recursive: true });
    fs.writeFileSync(path, content);
    return path;
  };

  beforeEach(() => {
    root = fs.mkdtempSync(join(tmpdir(), "hydractrl-media-"));
    // Created on the first import
    folder = join(root, "media");
    outside = join(root, "Desktop");
    logs = [];
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test("copies a dropped file into the folder, creating it", async () => {
    const source = write(join(outside, "photo.png"), "pixels");
    const result = await library().importFile(source);
    expect(result).toEqual({
      name: "photo.png",
      kind: "image",
      url: "/media/photo.png",
      status: "copied",
    });
    expect(fs.readFileSync(join(folder, "photo.png"), "utf8")).toBe("pixels");
    expect(fs.existsSync(source)).toBe(true);
    expect(logs.some((line) => line.startsWith("media: copied"))).toBe(true);
  });

  test("reuses an identical copy and renames a different file with the same name", async () => {
    const media = library();
    const source = write(join(outside, "clip.mp4"), "frames");
    await media.importFile(source);
    expect(await media.importFile(source)).toMatchObject({
      name: "clip.mp4",
      url: "/media/clip.mp4",
      status: "existing",
    });

    const other = write(join(root, "Downloads", "clip.mp4"), "other frames");
    expect(await media.importFile(other)).toMatchObject({
      name: "clip-2.mp4",
      url: "/media/clip-2.mp4",
      status: "copied",
    });
    const sameSize = write(join(root, "Movies", "clip.mp4"), "frameZ");
    expect(await media.importFile(sameSize)).toMatchObject({ name: "clip-3.mp4" });
    expect(fs.readdirSync(folder).sort()).toEqual(["clip-2.mp4", "clip-3.mp4", "clip.mp4"]);
  });

  test("uses a file that is already in the folder where it is", async () => {
    const media = library();
    const top = write(join(folder, "logo.svg"), "<svg/>");
    const nested = write(join(folder, "clips", "My Intro #2.webm"), "frames");
    expect(await media.importFile(top)).toEqual({
      name: "logo.svg",
      kind: "image",
      url: "/media/logo.svg",
      status: "in-folder",
    });
    expect(await media.importFile(nested)).toMatchObject({
      kind: "video",
      url: "/media/clips/My Intro %232.webm",
      status: "in-folder",
    });
    expect(fs.readdirSync(folder).sort()).toEqual(["clips", "logo.svg"]);
  });

  test("follows a symlinked folder", async () => {
    const real = join(root, "Real Media");
    const source = write(join(real, "photo.jpg"), "pixels");
    // A junction on Windows, where symlinks need extra rights
    fs.symlinkSync(real, folder, "junction");
    expect(await library().importFile(source)).toMatchObject({
      url: "/media/photo.jpg",
      status: "in-folder",
    });
  });

  test("copies a file from a hidden part of the folder, which the server won't serve", async () => {
    const hidden = write(join(folder, ".cache", "photo.png"), "pixels");
    expect(await library().importFile(hidden)).toMatchObject({
      url: "/media/photo.png",
      status: "copied",
    });
  });

  test("names copies so the server serves them and URLs keep working", async () => {
    // Characters Windows refuses can't be in a test file there; safeFileName covers them
    const source = write(join(outside, ".clip #1 take.mov"), "frames");
    expect(await library().importFile(source)).toMatchObject({
      name: "clip #1 take.mov",
      url: "/media/clip %231 take.mov",
      kind: "video",
    });
  });

  test("refuses what isn't a media file on disk", async () => {
    const media = library();
    write(join(outside, "notes.pdf"), "text");
    fs.mkdirSync(join(outside, "folder.png"), { recursive: true });
    await expect(media.importFile(join(outside, "notes.pdf"))).rejects.toThrow(
      "is not an image or video HYDRACTRL can play",
    );
    await expect(media.importFile(join(outside, "missing.png"))).rejects.toThrow("is not a file");
    await expect(media.importFile(join(outside, "folder.png"))).rejects.toThrow("is not a file");
    await expect(media.importFile("relative/photo.png")).rejects.toThrow(
      "is not a file on this computer",
    );
    await expect(media.importFile("")).rejects.toThrow("is not a file on this computer");
  });

  test("says so when the folder can't be created", async () => {
    const source = write(join(outside, "photo.png"), "pixels");
    const blocker = write(join(root, "blocker"), "a file, not a folder");
    const media = library({ getFolder: () => join(blocker, "media") });
    await expect(media.importFile(source)).rejects.toThrow("the media folder is not available");
  });

  test("importFiles reports each file in order", async () => {
    const photo = write(join(outside, "photo.png"), "pixels");
    const notes = write(join(outside, "notes.txt"), "text");
    const results = await library().importFiles([photo, notes, ""]);
    expect(results).toEqual([
      { ok: true, name: "photo.png", kind: "image", url: "/media/photo.png", status: "copied" },
      { ok: false, name: "notes.txt", error: "is not an image or video HYDRACTRL can play" },
      { ok: false, name: "A dropped item", error: "is not a file on this computer" },
    ]);
  });
});
