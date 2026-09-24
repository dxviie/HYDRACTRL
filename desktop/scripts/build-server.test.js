import { describe, expect, test } from "bun:test";
import { BUN_TARGETS, buildServer, bunTargetFor, parseArgs } from "./build-server.mjs";

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
    expect(parsed).toEqual({ platform: "win32", arch: "x64", out: "/tmp/x", skipClient: true });
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
      cpSync: (from, to) => calls.push(["cp", from, to]),
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
    expect(result.binaryPath).toBe("/stage/hydractrl.exe");
    expect(calls[0]).toEqual(["exec", "bun", "run", "build:client"]);
    expect(calls).toContainEqual(["rm", "/stage"]);
    const compile = calls.find((c) => c[0] === "exec" && c[2] === "build");
    expect(compile).toContain("--target=bun-windows-x64");
    expect(compile).toContain("/stage/hydractrl.exe");
    expect(calls.filter((c) => c[0] === "cp")).toHaveLength(2);
    const manifest = JSON.parse(Object.values(written)[0]);
    expect(manifest.version).toBe("9.9.9");
    expect(manifest.target).toBe("bun-windows-x64");
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
