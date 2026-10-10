import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { credentialArgs, notarize } = require("./notarize.cjs");

const API_KEY_ENV = {
  APPLE_API_KEY: "/runner/temp/AuthKey.p8",
  APPLE_API_KEY_ID: "KEY1234567",
  APPLE_API_ISSUER: "issuer-uuid",
};
const APPLE_ID_ENV = {
  APPLE_ID: "dev@example.com",
  APPLE_APP_SPECIFIC_PASSWORD: "abcd-efgh-ijkl-mnop",
  APPLE_TEAM_ID: "TEAM123456",
};
const SUBMISSION = "23311709-f352-416f-86c6-e231158848f8";
const APP = join(tmpdir(), "dist", "mac-arm64", "HYDRACTRL.app");
const TIMING = {
  pollInterval: 30,
  retryInterval: 30,
  uploadAttempts: 3,
  stapleAttempts: 3,
  pollFailures: 3,
  progressInterval: 100,
};

const ok = (stdout = "") => ({ ok: true, stdout, stderr: "" });
// What notarytool printed when a runner lost its network
const offline = {
  ok: false,
  stdout: "",
  stderr:
    'Error: HTTPError(statusCode: nil, error: Error Domain=NSURLErrorDomain Code=-1009 "The Internet connection appears to be offline.")',
};
const status = (value) => ok(JSON.stringify({ id: SUBMISSION, status: value }));

/**
 * Stands in for ditto, notarytool and stapler: each command takes the next
 * answer queued under its name, or succeeds when there is none.
 */
function fakeTools(queued = {}) {
  const defaults = {
    ditto: ok(),
    "notarytool submit": ok(
      JSON.stringify({ id: SUBMISSION, message: "Successfully uploaded file" }),
    ),
    "notarytool info": status("Accepted"),
    "notarytool log": ok("{}"),
    "stapler staple": ok(),
  };
  const calls = [];
  const run = async (command, args, options = {}) => {
    const name = command === "ditto" ? "ditto" : `${args[0]} ${args[1]}`;
    calls.push({ name, args, cwd: options.cwd });
    return queued[name]?.shift() ?? defaults[name];
  };
  const names = () => calls.map((call) => call.name);
  return { run, calls, names };
}

function harness(queued, { env = API_KEY_ENV } = {}) {
  const tools = fakeTools(queued);
  const logs = [];
  let clock = 0;
  const options = {
    env,
    run: tools.run,
    sleep: async (ms) => {
      clock += ms;
    },
    log: (line) => logs.push(line),
    now: () => clock,
    timing: TIMING,
  };
  return { ...tools, logs, notarize: () => notarize(APP, options) };
}

describe("credentialArgs", () => {
  test("uses an App Store Connect API key", () => {
    expect(credentialArgs(API_KEY_ENV)).toEqual([
      "--key",
      "/runner/temp/AuthKey.p8",
      "--key-id",
      "KEY1234567",
      "--issuer",
      "issuer-uuid",
    ]);
  });

  test("uses an Apple ID with an app-specific password", () => {
    expect(credentialArgs(APPLE_ID_ENV)).toEqual([
      "--apple-id",
      "dev@example.com",
      "--password",
      "abcd-efgh-ijkl-mnop",
      "--team-id",
      "TEAM123456",
    ]);
  });

  test("returns null without credentials, counting empty variables as unset", () => {
    expect(credentialArgs({})).toBeNull();
    expect(credentialArgs({ APPLE_ID: "", APPLE_API_KEY_ID: "", APPLE_API_ISSUER: "" })).toBeNull();
  });

  test("refuses half a set of credentials", () => {
    expect(() => credentialArgs({ ...API_KEY_ENV, APPLE_API_ISSUER: "" })).toThrow(
      "APPLE_API_ISSUER not set",
    );
    expect(() => credentialArgs({ APPLE_ID: "dev@example.com" })).toThrow(
      "APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID not set",
    );
  });
});

describe("notarize", () => {
  test("skips the app without credentials", async () => {
    const h = harness({}, { env: {} });
    expect(await h.notarize()).toBe(false);
    expect(h.calls).toEqual([]);
    expect(h.logs.join("\n")).toContain("skipped notarization");
  });

  test("zips and uploads the app, waits for Apple and staples the ticket", async () => {
    const h = harness({ "notarytool info": [status("In Progress"), status("In Progress")] });
    expect(await h.notarize()).toBe(true);
    expect(h.names()).toEqual([
      "ditto",
      "notarytool submit",
      "notarytool info",
      "notarytool info",
      "notarytool info",
      "stapler staple",
    ]);

    const [zip, submit, info] = h.calls;
    expect(zip.cwd).toBe(dirname(APP));
    expect(zip.args).toContain(basename(APP));
    const zipPath = zip.args.at(-1);
    expect(basename(zipPath)).toBe("HYDRACTRL.zip");
    expect(submit.args).toEqual([
      "notarytool",
      "submit",
      zipPath,
      ...credentialArgs(API_KEY_ENV),
      "--no-wait",
      "--output-format",
      "json",
    ]);
    expect(info.args.slice(0, 3)).toEqual(["notarytool", "info", SUBMISSION]);
    expect(h.calls.at(-1)).toEqual({
      name: "stapler staple",
      args: ["stapler", "staple", "-v", "HYDRACTRL.app"],
      cwd: dirname(APP),
    });
    // The archive goes once the app is notarized
    expect(existsSync(dirname(zipPath))).toBe(false);
    expect(h.logs.join("\n")).toContain(`notarization successful  id=${SUBMISSION}`);
  });

  test("keeps checking on Apple through dropped connections", async () => {
    const h = harness({
      "notarytool info": [offline, offline, status("In Progress"), offline, offline],
    });
    expect(await h.notarize()).toBe(true);
    expect(h.names().filter((name) => name === "notarytool info")).toHaveLength(6);
    expect(h.logs.filter((line) => line.includes("status check failed"))).toHaveLength(4);
    expect(h.names().at(-1)).toBe("stapler staple");
  });

  test("gives up after too many failed status checks in a row, naming the submission", async () => {
    const h = harness({ "notarytool info": [offline, offline, offline] });
    await expect(h.notarize()).rejects.toThrow(
      new RegExp(`Lost touch with Apple's notary service.*${SUBMISSION}`),
    );
    expect(h.names()).not.toContain("stapler staple");
  });

  test("retries a failed upload", async () => {
    const h = harness({ "notarytool submit": [offline] });
    expect(await h.notarize()).toBe(true);
    expect(h.names().filter((name) => name === "notarytool submit")).toHaveLength(2);
  });

  test("stops after the last upload attempt", async () => {
    const h = harness({ "notarytool submit": [offline, offline, offline] });
    await expect(h.notarize()).rejects.toThrow("notarization upload failed 3 times");
    expect(h.names()).not.toContain("notarytool info");
  });

  test("prints Apple's log when it rejects the app", async () => {
    const report = '{"issues":[{"message":"The binary is not signed."}]}';
    const h = harness({ "notarytool info": [status("Invalid")], "notarytool log": [ok(report)] });
    await expect(h.notarize()).rejects.toThrow(`Invalid (submission ${SUBMISSION})`);
    expect(h.logs).toContain(report);
    expect(h.names()).not.toContain("stapler staple");
  });

  test("retries stapling", async () => {
    const h = harness({ "stapler staple": [offline] });
    expect(await h.notarize()).toBe(true);
    expect(h.names().filter((name) => name === "stapler staple")).toHaveLength(2);
  });

  test("stops when the app can't be zipped", async () => {
    const h = harness({ ditto: [{ ok: false, stdout: "", stderr: "ditto: No such file" }] });
    await expect(h.notarize()).rejects.toThrow("Couldn't zip HYDRACTRL.app");
    expect(h.names()).toEqual(["ditto"]);
  });

  test("logs now and then that Apple is still at it", async () => {
    const h = harness({
      "notarytool info": Array.from({ length: 8 }, () => status("In Progress")),
    });
    expect(await h.notarize()).toBe(true);
    expect(h.logs.filter((line) => line.includes("minutes="))).toHaveLength(2);
  });

  test("never logs the credentials", async () => {
    // How execFile reports a command that exits non-zero without output
    const silentFailure = {
      ok: false,
      stdout: "",
      stderr: "",
      error: Object.assign(
        new Error(
          `Command failed: xcrun notarytool info ${SUBMISSION} --password ${APPLE_ID_ENV.APPLE_APP_SPECIFIC_PASSWORD}`,
        ),
        { code: 1 },
      ),
    };
    const h = harness(
      { "notarytool info": [offline, silentFailure], "stapler staple": [offline] },
      { env: APPLE_ID_ENV },
    );
    expect(await h.notarize()).toBe(true);
    const logs = h.logs.join("\n");
    expect(logs).toContain("no output, exit code 1");
    expect(logs).not.toContain(APPLE_ID_ENV.APPLE_APP_SPECIFIC_PASSWORD);
  });

  test("says when a tool is missing", async () => {
    const missing = {
      ok: false,
      stdout: "",
      stderr: "",
      error: Object.assign(new Error("spawn ditto ENOENT"), { code: "ENOENT" }),
    };
    const h = harness({ ditto: [missing] });
    await expect(h.notarize()).rejects.toThrow("spawn ditto ENOENT");
  });
});
