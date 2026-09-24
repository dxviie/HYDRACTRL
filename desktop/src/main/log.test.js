import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogger, describeError } from "./log.js";

describe("createLogger", () => {
  test("writes timestamped, scoped lines and mirrors them", () => {
    const dir = mkdtempSync(join(tmpdir(), "hydractrl-log-"));
    const filePath = join(dir, "logs", "app.log");
    const mirrored = [];
    const log = createLogger({
      filePath,
      fs,
      mirror: {
        log: (l) => mirrored.push(l),
        warn: (l) => mirrored.push(l),
        error: (l) => mirrored.push(l),
      },
      now: () => new Date("2026-09-24T10:00:00.000Z"),
    });

    log.info("started");
    log.child("server").warn("slow");
    log.error("boom");

    const content = readFileSync(filePath, "utf8");
    expect(content).toBe(
      "2026-09-24T10:00:00.000Z INFO  [app] started\n" +
        "2026-09-24T10:00:00.000Z WARN  [server] slow\n" +
        "2026-09-24T10:00:00.000Z ERROR [app] boom\n",
    );
    expect(mirrored).toHaveLength(3);
    rmSync(dir, { recursive: true });
  });

  test("rotates the file once it grows past the limit", () => {
    const dir = mkdtempSync(join(tmpdir(), "hydractrl-log-"));
    const filePath = join(dir, "app.log");
    const log = createLogger({ filePath, fs, maxBytes: 200 });
    for (let i = 0; i < 10; i++) log.info(`line ${i} ${"x".repeat(40)}`);

    expect(fs.existsSync(`${filePath}.1`)).toBe(true);
    expect(statSync(filePath).size).toBeLessThan(400);
    rmSync(dir, { recursive: true });
  });

  test("never throws when the disk is unwritable", () => {
    const log = createLogger({
      filePath: "/nowhere/app.log",
      fs: {
        ...fs,
        mkdirSync: () => {
          throw new Error("read-only");
        },
      },
    });
    expect(() => log.info("still fine")).not.toThrow();
  });
});

describe("describeError", () => {
  test("handles errors, strings and nothing", () => {
    expect(describeError(new Error("bad"))).toContain("bad");
    expect(describeError("text")).toBe("text");
    expect(describeError(null)).toBe("unknown error");
  });
});
