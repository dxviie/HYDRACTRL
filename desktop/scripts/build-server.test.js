import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { BUN_TARGETS, REPO_ROOT, buildServer, bunTargetFor, parseArgs } from "./build-server.mjs";

describe("parseArgs", () => {
  test("defaults to the host and accepts overrides", () => {
    const defaults = parseArgs([]);
    expect(defaults.platform).toBe(process.platform);
    expect(defaults.skipClient).toBe(false);
    const parsed = parseArgs([
      "--platform",
      "win32",
      "--arch",
      "x64",
      "--out",
      "/tmp/x",
      "--skip-client",
    ]);
    expect(parsed).toEqual({
      platform: "win32",
      arch: "x64",
      out: resolve("/tmp/x"),
      skipClient: true,
    });
    expect(() => parseArgs(["--bogus"])).toThrow("unknown argument");
  });
});

describe("bunTargetFor", () => {
  test("maps electron platform/arch pairs to Bun targets", () => {
    expect(bunTargetFor("darwin", "arm64")).toBe("bun-darwin-arm64");
    expect(bunTargetFor("win32", "x64")).toBe("bun-windows-x64");
    expect(() => bunTargetFor("sunos", "x64")).toThrow("no Bun compile target");
    expect(Object.keys(BUN_TARGETS)).toContain("darwin-x64");
  });
});

describe("buildServer", () => {
  test("runs the client build, compiles for the target and stages the assets", () => {
    const calls = [];
    const written = {};
    const fs = {
      cpSync: (from, to, options) => calls.push(["cp", from, to, options]),
      existsSync: (path) => path.endsWith("local-assets"),
      mkdirSync: (path) => calls.push(["mkdir", path]),
      readFileSync: () => JSON.stringify({ version: "9.9.9" }),
      rmSync: (path) => calls.push(["rm", path]),
      writeFileSync: (path, content) => {
        written[path] = content;
      },
    };
    const result = buildServer({
      platform: "win32",
      arch: "x64",
      out: "/stage",
      exec: (file, args) => calls.push(["exec", file, ...args]),
      fs,
      log: () => {},
    });
    // Paths go through path.join, so expect native separators (Windows CI too)
    expect(result.binaryPath).toBe(join("/stage", "hydractrl.exe"));
    expect(calls[0]).toEqual(["exec", "bun", "run", "build:client"]);
    expect(calls).toContainEqual(["rm", "/stage"]);
    const compile = calls.find((c) => c[0] === "exec" && c[2] === "build");
    expect(compile).toContain("--target=bun-windows-x64");
    expect(compile).toContain(join("/stage", "hydractrl.exe"));
    const copies = calls.filter((c) => c[0] === "cp");
    expect(copies).toHaveLength(2);
    expect(copies[0].slice(1, 3)).toEqual([
      join(REPO_ROOT, "public"),
      join("/stage", "hydractrl-public"),
    ]);
    expect(copies[1][1]).toBe(join(REPO_ROOT, "local-assets"));
    const manifest = JSON.parse(Object.values(written)[0]);
    expect(manifest.version).toBe("9.9.9");
    expect(manifest.target).toBe("bun-windows-x64");
  });

  test("leaves the hosted website's own files out of the bundle", () => {
    const copies = [];
    buildServer({
      platform: "linux",
      arch: "x64",
      out: "/stage",
      skipClient: true,
      exec: () => {},
      fs: {
        cpSync: (from, to, options) => copies.push({ from, options }),
        existsSync: () => false,
        mkdirSync() {},
        readFileSync: () => "{}",
        rmSync() {},
        writeFileSync() {},
      },
      log: () => {},
    });
    const publicDir = join(REPO_ROOT, "public");
    const { filter } = copies[0].options;
    expect(filter(publicDir)).toBe(true);
    expect(filter(join(publicDir, "app.html"))).toBe(true);
    expect(filter(join(publicDir, "output.html"))).toBe(true);
    expect(filter(join(publicDir, "assets", "index.js"))).toBe(true);
    expect(filter(join(publicDir, "index.html"))).toBe(false);
    expect(filter(join(publicDir, "site", "code-editor.mp4"))).toBe(false);
    expect(filter(join(publicDir, "_redirects"))).toBe(false);
  });

  test("can skip the client build", () => {
    const calls = [];
    buildServer({
      platform: "darwin",
      arch: "arm64",
      out: "/stage",
      skipClient: true,
      exec: (file, args) => calls.push([file, ...args]),
      fs: {
        cpSync() {},
        existsSync: () => false,
        mkdirSync() {},
        readFileSync: () => "{}",
        rmSync() {},
        writeFileSync() {},
      },
      log: () => {},
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("--target=bun-darwin-arm64");
  });
});
