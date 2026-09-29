import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import {
  MEDIA_TYPES as DESKTOP_MEDIA_TYPES,
  isServableName as desktopIsServableName,
} from "../../desktop/src/main/media.js";
import {
  MEDIA_TYPES,
  createMediaFolder,
  isServableName,
  parseControlLine,
  parseRange,
  readLines,
  resolveMediaPath,
} from "./mediaFolder";

describe("isServableName", () => {
  test("takes plain names, including spaces, accents and symbols", () => {
    for (const name of ["photo.jpg", "My Clip #1.mp4", "café.png", "50%.gif", "clips"]) {
      expect(isServableName(name, "darwin")).toBe(true);
      expect(isServableName(name, "win32")).toBe(true);
    }
  });

  test("refuses empty, hidden and dot names, separators and NUL", () => {
    for (const name of ["", ".", "..", ".hidden.png", "a/b.png", "a\0b.png"]) {
      expect(isServableName(name, "darwin")).toBe(false);
      expect(isServableName(name, "win32")).toBe(false);
    }
  });

  test("refuses backslashes and colons on Windows only", () => {
    expect(isServableName("a\\b.png", "darwin")).toBe(true);
    expect(isServableName("a:b.png", "linux")).toBe(true);
    expect(isServableName("a\\b.png", "win32")).toBe(false);
    expect(isServableName("C:x.png", "win32")).toBe(false);
    expect(isServableName("x.txt:hidden.png", "win32")).toBe(false);
  });
});

describe("resolveMediaPath", () => {
  const folder = "/Users/me/media";

  test("maps /media/ URLs to files in the folder", () => {
    expect(resolveMediaPath(folder, "/media/photo.jpg", "darwin")).toBe(
      "/Users/me/media/photo.jpg",
    );
    expect(resolveMediaPath(folder, "/media/clips/intro.MP4", "darwin")).toBe(
      "/Users/me/media/clips/intro.MP4",
    );
    expect(resolveMediaPath(folder, "/media/My%20Clip%20%231.mp4", "darwin")).toBe(
      "/Users/me/media/My Clip #1.mp4",
    );
    expect(resolveMediaPath("C:\\Users\\me\\media", "/media/clip.mp4", "win32")).toBe(
      "C:\\Users\\me\\media\\clip.mp4",
    );
  });

  test("never leaves the folder", () => {
    const attempts = [
      "/media/../secret.png",
      "/media/%2e%2e/secret.png",
      "/media/..%2fsecret.png",
      "/media/a%2f..%2f..%2fsecret.png",
      "/media/.hidden/photo.png",
      "/media/%00.png",
    ];
    for (const attempt of attempts) {
      expect(resolveMediaPath(folder, attempt, "darwin")).toBeNull();
      expect(resolveMediaPath("C:\\media", attempt, "win32")).toBeNull();
    }
    expect(resolveMediaPath("C:\\media", "/media/..%5c..%5csecret.png", "win32")).toBeNull();
    expect(resolveMediaPath("C:\\media", "/media/C:%5cWindows%5cx.png", "win32")).toBeNull();
  });

  test("serves only images and videos", () => {
    for (const path of ["/media/notes.txt", "/media/", "/media/clips/", "/media/script.js"]) {
      expect(resolveMediaPath(folder, path, "darwin")).toBeNull();
    }
    expect(resolveMediaPath(folder, "/assets/photo.png", "darwin")).toBeNull();
    expect(resolveMediaPath(folder, "/media/%E0%A4%A.png", "darwin")).toBeNull();
  });
});

describe("parseRange", () => {
  test("reads single byte ranges", () => {
    expect(parseRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseRange("bytes=90-500", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-500", 100)).toEqual({ start: 0, end: 99 });
  });

  test("sends the whole file for no, several or invalid ranges", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("", 100)).toBeNull();
    expect(parseRange("bytes=0-1,5-6", 100)).toBeNull();
    expect(parseRange("items=0-5", 100)).toBeNull();
    expect(parseRange("bytes=-", 100)).toBeNull();
    expect(parseRange("bytes=20-10", 100)).toBeNull();
  });

  test("flags ranges past the end", () => {
    expect(parseRange("bytes=100-", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=-0", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=0-", 0)).toBe("unsatisfiable");
  });
});

describe("control lines", () => {
  test("parseControlLine accepts only media-folder messages", () => {
    expect(parseControlLine('{"type":"media-folder","path":"/x"}')).toEqual({
      type: "media-folder",
      path: "/x",
    });
    expect(parseControlLine('{"type":"media-folder","path":3}')).toBeNull();
    expect(parseControlLine('{"type":"quit"}')).toBeNull();
    expect(parseControlLine("null")).toBeNull();
    expect(parseControlLine("hello")).toBeNull();
  });

  test("readLines reassembles lines split across chunks", () => {
    const stream = new PassThrough();
    const lines: string[] = [];
    readLines(stream, (line) => lines.push(line));
    stream.write('{"a":');
    stream.write('1}\r\n\n{"b":2}\n{"c"');
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
    stream.write(":3}\n");
    expect(lines).toEqual(['{"a":1}', '{"b":2}', '{"c":3}']);
  });
});

describe("createMediaFolder", () => {
  let root: string;
  let folder: string;
  let other: string;
  const bytes = Uint8Array.from({ length: 64 }, (_, i) => i);
  const logs: string[] = [];
  const request = (path: string, headers: Record<string, string> = {}) =>
    new Request(`http://127.0.0.1:3000${path}`, { headers });

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "hydractrl-media-"));
    folder = join(root, "media");
    other = join(root, "other");
    mkdirSync(join(folder, "clips"), { recursive: true });
    mkdirSync(join(folder, "folder.png"));
    mkdirSync(other);
    writeFileSync(join(folder, "photo.png"), bytes);
    writeFileSync(join(folder, "clips", "My Clip #1.mp4"), bytes);
    writeFileSync(join(folder, "logo.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
    writeFileSync(join(folder, "notes.txt"), "not media");
    writeFileSync(join(folder, ".hidden.png"), bytes);
    writeFileSync(join(root, "outside.png"), bytes);
    writeFileSync(join(other, "other.png"), bytes);
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  function media() {
    const created = createMediaFolder({ log: (message) => logs.push(message) });
    created.setFolder(folder);
    return created;
  }

  test("serves a whole file with validators and range support", async () => {
    const response = await media().respond(request("/media/photo.png"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe("64");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("etag")).toMatch(/^"40-[0-9a-f]+"$/);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  test("answers byte ranges", async () => {
    const response = await media().respond(
      request("/media/clips/My%20Clip%20%231.mp4", { Range: "bytes=2-5" }),
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-range")).toBe("bytes 2-5/64");
    expect(response.headers.get("content-length")).toBe("4");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([2, 3, 4, 5]);

    const past = await media().respond(request("/media/photo.png", { Range: "bytes=64-" }));
    expect(past.status).toBe(416);
    expect(past.headers.get("content-range")).toBe("bytes */64");
  });

  test("revalidates with the ETag, and ignores a range of an older version", async () => {
    const first = await media().respond(request("/media/photo.png"));
    const etag = first.headers.get("etag") ?? "";
    const cached = await media().respond(request("/media/photo.png", { "If-None-Match": etag }));
    expect(cached.status).toBe(304);
    expect(cached.headers.get("etag")).toBe(etag);

    const changed = await media().respond(
      request("/media/photo.png", { Range: "bytes=0-3", "If-Range": '"0-0"' }),
    );
    expect(changed.status).toBe(200);
    const same = await media().respond(
      request("/media/photo.png", { Range: "bytes=0-3", "If-Range": etag }),
    );
    expect(same.status).toBe(206);
  });

  test("keeps SVG files from running scripts", async () => {
    const response = await media().respond(request("/media/logo.svg"));
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("content-security-policy")).toBe("sandbox");
  });

  test("answers 404 for anything but a media file in the folder", async () => {
    const paths = [
      "/media/missing.png",
      "/media/folder.png",
      "/media/notes.txt",
      "/media/.hidden.png",
      "/media/../outside.png",
      "/media/%2e%2e/outside.png",
    ];
    for (const path of paths) {
      expect((await media().respond(request(path))).status).toBe(404);
    }
    expect(logs).toContain("media: not found /media/missing.png");
    const off = createMediaFolder();
    expect(off.getFolder()).toBeNull();
    expect((await off.respond(request("/media/photo.png"))).status).toBe(404);
  });

  test("switches folders on a control line and keeps the folder for a bad path", async () => {
    const served = media();
    served.control(JSON.stringify({ type: "media-folder", path: other }));
    expect(served.getFolder()).toBe(other);
    expect((await served.respond(request("/media/other.png"))).status).toBe(200);
    expect((await served.respond(request("/media/photo.png"))).status).toBe(404);

    expect(served.setFolder("relative/path")).toBe(false);
    served.control('{"type":"media-folder","path":""}');
    served.control("not json");
    expect(served.getFolder()).toBe(other);
  });

  test("sends ranges over a real connection", async () => {
    const served = media();
    const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: served.respond });
    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/media/photo.png`, {
        headers: { Range: "bytes=60-" },
      });
      expect(response.status).toBe(206);
      expect(response.headers.get("content-length")).toBe("4");
      expect(response.headers.get("content-range")).toBe("bytes 60-63/64");
      expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([60, 61, 62, 63]);
    } finally {
      server.stop(true);
    }
  });
});

describe("in step with the desktop app", () => {
  test("serves exactly what the desktop app imports", () => {
    expect(Object.keys(MEDIA_TYPES).sort()).toEqual(Object.keys(DESKTOP_MEDIA_TYPES).sort());
    for (const [extension, { kind, type }] of Object.entries(MEDIA_TYPES)) {
      expect(DESKTOP_MEDIA_TYPES[extension]).toBe(kind);
      expect(extension).toMatch(/^\.[a-z0-9]+$/);
      expect(type.startsWith(`${kind}/`)).toBe(true);
    }
  });

  test("agrees on which names it serves", () => {
    const names = [
      "photo.png",
      ".hidden.png",
      "..",
      "a\\b.png",
      "C:x.png",
      "a/b.png",
      "",
      "clip #1.mp4",
    ];
    for (const platform of ["darwin", "win32", "linux"]) {
      for (const name of names) {
        expect(desktopIsServableName(name, platform)).toBe(isServableName(name, platform));
      }
    }
  });
});
