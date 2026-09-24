import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_SETTINGS,
  LIMITS,
  changedKeys,
  createSettingsStore,
  presetLabel,
  validateSettings,
} from "./settings.js";

describe("validateSettings", () => {
  test("returns the defaults for empty or garbage input", () => {
    expect(validateSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings("nope")).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings({ output: 42, server: [] })).toEqual(DEFAULT_SETTINGS);
  });

  test("merges a partial update over the base", () => {
    const base = validateSettings({ output: { name: "Stage", width: 1280, height: 720 } });
    const next = validateSettings({ output: { frameRate: 30 } }, base);
    expect(next.output).toEqual({ ...base.output, frameRate: 30 });
    expect(next.server).toEqual(base.server);
  });

  test("clamps numbers and coerces numeric strings", () => {
    const next = validateSettings({
      output: { width: "3840", height: 999999, frameRate: 0 },
      server: { port: 80 },
    });
    expect(next.output.width).toBe(3840);
    expect(next.output.height).toBe(LIMITS.maxSize);
    expect(next.output.frameRate).toBe(LIMITS.minFrameRate);
    expect(next.server.port).toBe(LIMITS.minPort);
  });

  test("falls back for values that are not numbers or booleans", () => {
    const next = validateSettings({
      output: { width: "wide", autoStart: "maybe", preview: "true" },
      server: { allowNetwork: 1 },
    });
    expect(next.output.width).toBe(DEFAULT_SETTINGS.output.width);
    expect(next.output.autoStart).toBe(true);
    expect(next.output.preview).toBe(true);
    expect(next.server.allowNetwork).toBe(false);
  });

  test("cleans sender names", () => {
    expect(validateSettings({ output: { name: "  Main Out \n" } }).output.name).toBe("Main Out");
    expect(validateSettings({ output: { name: "   " } }).output.name).toBe("HYDRACTRL");
    expect(validateSettings({ output: { name: 12 } }).output.name).toBe("HYDRACTRL");
    expect(validateSettings({ output: { name: "x".repeat(200) } }).output.name).toHaveLength(
      LIMITS.maxNameLength,
    );
  });

  test("drops unknown keys", () => {
    const next = validateSettings({ output: { evil: true }, extra: 1 });
    expect(next.output.evil).toBeUndefined();
    expect(next.extra).toBeUndefined();
  });
});

describe("changedKeys and presetLabel", () => {
  test("lists dotted paths of changed leaves", () => {
    const a = validateSettings({});
    const b = validateSettings({ output: { width: 100 }, server: { allowNetwork: true } });
    expect(changedKeys(a, b)).toEqual(["output.width", "server.allowNetwork"]);
    expect(changedKeys(a, a)).toEqual([]);
    expect(changedKeys(undefined, a).length).toBeGreaterThan(0);
  });

  test("maps sizes to preset labels", () => {
    expect(presetLabel(1920, 1080)).toBe("1080p");
    expect(presetLabel(3840, 2160)).toBe("4K");
    expect(presetLabel(1000, 1000)).toBe("Custom");
  });
});

describe("createSettingsStore", () => {
  function tempDir() {
    return mkdtempSync(join(tmpdir(), "hydractrl-settings-"));
  }

  test("starts from defaults when there is no file", () => {
    const dir = tempDir();
    const store = createSettingsStore({ filePath: join(dir, "settings.json"), fs });
    expect(store.load()).toEqual(DEFAULT_SETTINGS);
    rmSync(dir, { recursive: true });
  });

  test("persists updates atomically and reloads them", () => {
    const dir = tempDir();
    const filePath = join(dir, "nested", "settings.json");
    const store = createSettingsStore({ filePath, fs });
    store.load();

    const result = store.update({ output: { name: "Club", width: 1280, height: 720 } });
    expect(result.changed).toEqual(["output.name", "output.width", "output.height"]);
    expect(JSON.parse(readFileSync(filePath, "utf8")).output.name).toBe("Club");
    expect(fs.existsSync(`${filePath}.tmp`)).toBe(false);

    const reloaded = createSettingsStore({ filePath, fs });
    expect(reloaded.load().output.width).toBe(1280);
    rmSync(dir, { recursive: true });
  });

  test("an update that changes nothing does not touch the disk", () => {
    const dir = tempDir();
    const filePath = join(dir, "settings.json");
    const store = createSettingsStore({ filePath, fs });
    store.load();
    const result = store.update({ output: { name: "HYDRACTRL" } });
    expect(result.changed).toEqual([]);
    expect(fs.existsSync(filePath)).toBe(false);
    rmSync(dir, { recursive: true });
  });

  test("a corrupt file falls back to defaults and is reported", () => {
    const dir = tempDir();
    const filePath = join(dir, "settings.json");
    writeFileSync(filePath, "{ not json");
    const warnings = [];
    const store = createSettingsStore({
      filePath,
      fs,
      log: { info() {}, warn: (m) => warnings.push(m), error() {} },
    });
    expect(store.load()).toEqual(DEFAULT_SETTINGS);
    expect(warnings[0]).toContain("using defaults");
    rmSync(dir, { recursive: true });
  });

  test("write failures are reported, not thrown", () => {
    const warnings = [];
    const brokenFs = {
      ...fs,
      mkdirSync: () => {
        throw new Error("read-only");
      },
    };
    const store = createSettingsStore({
      filePath: "/nowhere/settings.json",
      fs: brokenFs,
      log: { info() {}, warn: (m) => warnings.push(m), error() {} },
    });
    const result = store.update({ output: { name: "X" } });
    expect(result.settings.output.name).toBe("X");
    expect(warnings[0]).toContain("could not write");
  });
});
