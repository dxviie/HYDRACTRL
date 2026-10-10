// electron-builder hook: runs once the app is signed, before the DMG is built.
//
// Notarizes the app and staples Apple's ticket to it. electron-builder's own
// notarization (switched off in electron-builder.yml) waits on a single
// `notarytool submit --wait`, which gives up on the first network error while
// it checks on Apple, and that wait can last hours: Apple took five over
// HYDRACTRL's first submissions. GitHub's macOS runners lose their network now
// and then, so here the upload, each status check and the stapling are retried.
//
// The credentials are the ones electron-builder reads: an App Store Connect
// API key (APPLE_API_KEY, the path to the .p8 file, with APPLE_API_KEY_ID and
// APPLE_API_ISSUER) or an Apple ID (APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and
// APPLE_TEAM_ID). Without them the app is left unnotarized.
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

const MINUTE = 60_000;

/** How notarize() waits and retries. */
const TIMING = Object.freeze({
  pollInterval: 30_000,
  retryInterval: 30_000,
  uploadAttempts: 3,
  stapleAttempts: 5,
  // Failed status checks in a row before giving up: ten minutes without Apple
  pollFailures: 20,
  // How often to log that Apple is still at it
  progressInterval: 10 * MINUTE,
});

const API_KEY = ["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"];
const APPLE_ID = ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"];

/**
 * notarytool's authentication arguments for the credentials in `env`, or null
 * when there are none. An empty variable counts as unset: the workflow passes
 * "" for secrets the repository doesn't have.
 */
function credentialArgs(env) {
  for (const names of [API_KEY, APPLE_ID]) {
    const missing = names.filter((name) => !env[name]);
    if (missing.length > 0 && missing.length < names.length) {
      throw new Error(`Notarization needs ${names.join(", ")}; ${missing.join(", ")} not set`);
    }
  }
  if (env.APPLE_API_KEY) {
    return [
      "--key",
      env.APPLE_API_KEY,
      "--key-id",
      env.APPLE_API_KEY_ID,
      "--issuer",
      env.APPLE_API_ISSUER,
    ];
  }
  if (env.APPLE_ID) {
    return [
      "--apple-id",
      env.APPLE_ID,
      "--password",
      env.APPLE_APP_SPECIFIC_PASSWORD,
      "--team-id",
      env.APPLE_TEAM_ID,
    ];
  }
  return null;
}

/** Runs a command and resolves with its outcome and output; never rejects. */
function runCommand(command, args, { cwd } = {}) {
  return new Promise((resolve) => {
    execFile(command, args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), error });
    });
  });
}

const lastLine = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .pop();

/** The gist of a failed command, for the log: its last line of output. */
function summarize(result) {
  const { error } = result;
  // Not the message of a command that ran and failed: it repeats the command
  // line, credentials included. One that couldn't start ("spawn xcrun
  // ENOENT") has a string code.
  const fallback =
    typeof error?.code === "string"
      ? error.message
      : `no output, exit code ${error?.code ?? error?.signal ?? "unknown"}`;
  const gist = lastLine(result.stderr) || lastLine(result.stdout) || fallback;
  return gist.length > 300 ? `${gist.slice(0, 300)}…` : gist;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Calls `step` until it succeeds, at most `attempts` times. `step` resolves
 * with { ok: true, value } or { ok: false, error }.
 */
async function withRetries(what, attempts, step, { sleep, log, timing }) {
  for (let attempt = 1; ; attempt++) {
    const result = await step();
    if (result.ok) return result.value;
    if (attempt >= attempts) {
      throw new Error(`${what} failed ${attempts} times, last with: ${result.error}`);
    }
    log(`  • ${what} failed, retrying  attempt=${attempt}/${attempts} error=${result.error}`);
    await sleep(timing.retryInterval);
  }
}

/** Polls Apple until the submission is no longer in progress; resolves with its status. */
async function waitForVerdict(id, auth, { run, sleep, log, now, timing }) {
  const started = now();
  let reported = started;
  let failures = 0;
  for (;;) {
    await sleep(timing.pollInterval);
    const result = await run("xcrun", [
      "notarytool",
      "info",
      id,
      ...auth,
      "--output-format",
      "json",
    ]);
    const status = result.ok ? parseJson(result.stdout)?.status : undefined;
    if (typeof status !== "string") {
      failures++;
      if (failures >= timing.pollFailures) {
        throw new Error(
          `Lost touch with Apple's notary service: ${failures} status checks in a row failed, ` +
            `last with: ${summarize(result)}. Apple may still notarize submission ${id}; ` +
            "`xcrun notarytool history` shows its status.",
        );
      }
      log(
        `  • notarization status check failed, retrying  id=${id} failures=${failures}/${timing.pollFailures} error=${summarize(result)}`,
      );
      continue;
    }
    failures = 0;
    if (status !== "In Progress") return status;
    if (now() - reported >= timing.progressInterval) {
      reported = now();
      log(
        `  • waiting for Apple to notarize  id=${id} minutes=${Math.round((reported - started) / MINUTE)}`,
      );
    }
  }
}

/**
 * Notarizes the app at `appPath` and staples the ticket to it. Resolves with
 * false when there are no credentials, true once the ticket is stapled.
 */
async function notarize(
  appPath,
  {
    env = process.env,
    run = runCommand,
    sleep = delay,
    log = console.log,
    now = Date.now,
    timing = TIMING,
  } = {},
) {
  const auth = credentialArgs(env);
  if (!auth) {
    log("  • skipped notarization  reason=no Apple credentials in the environment");
    return false;
  }
  const deps = { run, sleep, log, now, timing };
  const appDir = path.dirname(appPath);
  const appName = path.basename(appPath);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hydractrl-notarize-"));
  try {
    // The same archive @electron/notarize uploads
    const zip = path.join(tmp, `${path.basename(appPath, ".app")}.zip`);
    const zipped = await run(
      "ditto",
      ["-c", "-k", "--sequesterRsrc", "--keepParent", appName, zip],
      { cwd: appDir },
    );
    if (!zipped.ok)
      throw new Error(`Couldn't zip ${appName} for notarization: ${summarize(zipped)}`);

    // An upload whose answer got lost leaves an extra submission behind, which
    // does no harm
    log(`  • uploading for notarization  file=${path.basename(zip)}`);
    const id = await withRetries(
      "notarization upload",
      timing.uploadAttempts,
      async () => {
        const result = await run("xcrun", [
          "notarytool",
          "submit",
          zip,
          ...auth,
          "--no-wait",
          "--output-format",
          "json",
        ]);
        const submitted = result.ok ? parseJson(result.stdout)?.id : undefined;
        return typeof submitted === "string"
          ? { ok: true, value: submitted }
          : { ok: false, error: summarize(result) };
      },
      deps,
    );
    log(`  • waiting for Apple to notarize  id=${id}`);

    const status = await waitForVerdict(id, auth, deps);
    if (status !== "Accepted") {
      const report = await withRetries(
        "fetching the notarization log",
        timing.uploadAttempts,
        async () => {
          const result = await run("xcrun", ["notarytool", "log", id, ...auth]);
          return result.ok
            ? { ok: true, value: result.stdout }
            : { ok: false, error: summarize(result) };
        },
        deps,
      ).catch((error) => error.message);
      log(report);
      throw new Error(
        `Apple didn't notarize the app: ${status} (submission ${id}); see the log above`,
      );
    }
    log(`  • notarization successful  id=${id}`);

    await withRetries(
      "stapling the notarization ticket",
      timing.stapleAttempts,
      async () => {
        const result = await run("xcrun", ["stapler", "staple", "-v", appName], { cwd: appDir });
        return result.ok ? { ok: true } : { ok: false, error: summarize(result) };
      },
      deps,
    );
    log(`  • stapled the notarization ticket  file=${appName}`);
    return true;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

exports.credentialArgs = credentialArgs;
exports.notarize = notarize;

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  await notarize(path.join(context.appOutDir, appName));
};
