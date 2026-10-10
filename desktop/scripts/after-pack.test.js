import { afterAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const afterPack = require("./after-pack.cjs");

// The hook only runs for macOS builds; creating symlinks on Windows needs
// privileges CI runners may not have
const posixOnly = test.skipIf(process.platform === "win32");

const root = mkdtempSync(join(tmpdir(), "hydractrl-after-pack-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** A framework the way npm installs it: every symlink copied out as files. */
function flattenedFramework(dir) {
  const framework = join(dir, "Syphon.framework");
  for (const version of ["A", "Current"]) {
    const base = join(framework, "Versions", version);
    mkdirSync(join(base, "Resources"), { recursive: true });
    mkdirSync(join(base, "_CodeSignature"), { recursive: true });
    writeFileSync(join(base, "Syphon"), "binary");
    writeFileSync(join(base, "Resources", "Info.plist"), "plist");
    writeFileSync(join(base, "_CodeSignature", "CodeResources"), "seal");
  }
  mkdirSync(join(framework, "Resources"), { recursive: true });
  writeFileSync(join(framework, "Syphon"), "binary");
  writeFileSync(join(framework, "Resources", "Info.plist"), "plist");
  return framework;
}

describe("restoreFrameworkLinks", () => {
  posixOnly("puts back the standard versioned layout", () => {
    const framework = flattenedFramework(join(root, "one"));
    expect(afterPack.restoreFrameworkLinks(framework)).toBe(true);

    const current = join(framework, "Versions", "Current");
    expect(lstatSync(current).isSymbolicLink()).toBe(true);
    expect(readlinkSync(current)).toBe("A");
    expect(readlinkSync(join(framework, "Syphon"))).toBe(join("Versions", "Current", "Syphon"));
    expect(readlinkSync(join(framework, "Resources"))).toBe(
      join("Versions", "Current", "Resources"),
    );
    // The links resolve, and the real files stay in Versions/A
    expect(readFileSync(join(framework, "Syphon"), "utf8")).toBe("binary");
    expect(readFileSync(join(framework, "Resources", "Info.plist"), "utf8")).toBe("plist");
    expect(lstatSync(join(framework, "Versions", "A", "Syphon")).isFile()).toBe(true);
    expect(existsSync(join(framework, "_CodeSignature"))).toBe(false);
  });

  posixOnly("leaves a framework that already has its links alone", () => {
    const framework = flattenedFramework(join(root, "two"));
    afterPack.restoreFrameworkLinks(framework);
    expect(afterPack.restoreFrameworkLinks(framework)).toBe(false);
  });

  test("skips layouts it does not recognise", () => {
    const flat = join(root, "three", "Flat.framework");
    mkdirSync(flat, { recursive: true });
    writeFileSync(join(flat, "Flat"), "binary");
    expect(afterPack.restoreFrameworkLinks(flat)).toBe(false);
    expect(lstatSync(join(flat, "Flat")).isFile()).toBe(true);
  });
});

describe("findFrameworks", () => {
  test("finds frameworks in nested packages", () => {
    const modules = join(root, "four", "node_modules");
    const framework = flattenedFramework(join(modules, "@napolab", "texture-bridge-darwin-arm64"));
    mkdirSync(join(modules, "other"), { recursive: true });
    expect(afterPack.findFrameworks(modules)).toEqual([framework]);
    expect(afterPack.findFrameworks(join(root, "missing"))).toEqual([]);
  });
});

describe("afterPack", () => {
  posixOnly(
    "repairs the frameworks inside a packaged macOS app, and nothing elsewhere",
    async () => {
      const appOutDir = join(root, "five");
      const modules = join(
        appOutDir,
        "HYDRACTRL.app",
        "Contents",
        "Resources",
        "app.asar.unpacked",
        "node_modules",
      );
      const framework = flattenedFramework(join(modules, "@napolab", "texture-bridge-darwin-x64"));
      const context = {
        electronPlatformName: "win32",
        appOutDir,
        packager: { appInfo: { productFilename: "HYDRACTRL" } },
      };
      await afterPack.default(context);
      expect(lstatSync(join(framework, "Syphon")).isFile()).toBe(true);

      await afterPack.default({ ...context, electronPlatformName: "darwin" });
      expect(lstatSync(join(framework, "Syphon")).isSymbolicLink()).toBe(true);
    },
  );
});
