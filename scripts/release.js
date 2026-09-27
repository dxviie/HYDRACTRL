#!/usr/bin/env bun
/**
 * Release helpers. The browser version and the desktop app share one
 * version, kept in package.json and desktop/package.json, with the release
 * notes in CHANGELOG.md (see RELEASING.md).
 *
 *   bun scripts/release.js prepare 1.3.0   bump both versions and move the
 *                                          [Unreleased] notes under 1.3.0
 *   bun scripts/release.js check v1.3.0    verify a tag against the versions
 *                                          and the changelog, print the version
 *   bun scripts/release.js notes 1.3.0     print the GitHub release notes
 *     [--mac-signed] [--windows-signed]    (leave out the first-launch hints)
 *     [--no-downloads]                     (just the changelog, for web-only
 *                                          versions such as 1.0.0 and 1.1.0)
 *   bun scripts/release.js assets dist     check that every download the
 *                                          landing page links to was built
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOSTED_APP_URL, REPOSITORY_URL } from "../src/project.js";
import { DOWNLOADS } from "../src/site/downloads.js";

const ROOT = join(import.meta.dir, "..");
const FILES = {
  changelog: join(ROOT, "CHANGELOG.md"),
  rootPackage: join(ROOT, "package.json"),
  desktopPackage: join(ROOT, "desktop", "package.json"),
};

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const HEADING = /^## \[([^\]]+)\]/;
const LINK_DEFINITION = /^\[[^\]]+\]:\s/;

export function isSemver(version) {
  return typeof version === "string" && SEMVER.test(version);
}

export function isPrerelease(version) {
  return isSemver(version) && version.split("+")[0].includes("-");
}

/** -1, 0 or 1, comparing major.minor.patch (pre-release parts are ignored). */
export function compareVersions(a, b) {
  const parts = (version) => version.split(/[-+]/)[0].split(".").map(Number);
  const [left, right] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return 0;
}

/** The notes under `## [name]`, without the heading, or null when missing. */
export function changelogSection(changelog, name) {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => HEADING.exec(line)?.[1] === name);
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && !HEADING.test(lines[end]) && !LINK_DEFINITION.test(lines[end])) {
    end += 1;
  }
  return lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
}

/**
 * Move the [Unreleased] notes under a new version heading and update the
 * compare links at the bottom.
 */
export function prepareChangelog(changelog, version, date) {
  if (!isSemver(version)) throw new Error(`"${version}" is not a semantic version`);
  if (changelogSection(changelog, version) !== null) {
    throw new Error(`CHANGELOG.md already has a section for ${version}`);
  }
  const notes = changelogSection(changelog, "Unreleased");
  if (notes === null) throw new Error("CHANGELOG.md has no [Unreleased] section");
  if (!notes) throw new Error("Nothing to release: the [Unreleased] section is empty");

  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => HEADING.exec(line)?.[1] === "Unreleased");
  let end = start + 1;
  while (end < lines.length && !HEADING.test(lines[end]) && !LINK_DEFINITION.test(lines[end])) {
    end += 1;
  }
  const section = ["## [Unreleased]", "", `## [${version}] - ${date}`, "", notes, ""];
  const result = [...lines.slice(0, start), ...section, ...lines.slice(end)];

  const unreleasedLink = result.findIndex((line) => line.startsWith("[Unreleased]: "));
  if (unreleasedLink !== -1) {
    const match = /^\[Unreleased\]: (.+)\/compare\/(.+)\.\.\.HEAD$/.exec(result[unreleasedLink]);
    if (match) {
      const [, base, previous] = match;
      result.splice(
        unreleasedLink,
        1,
        `[Unreleased]: ${base}/compare/v${version}...HEAD`,
        `[${version}]: ${base}/compare/${previous}...v${version}`,
      );
    }
  }
  return result.join("\n");
}

/** Check that a tag, both package versions and the changelog agree. */
export function checkRelease({ tag, rootVersion, desktopVersion, changelog }) {
  const problems = [];
  const version = String(tag || "").replace(/^refs\/tags\//, "");
  if (!/^v/.test(version) || !isSemver(version.slice(1))) {
    problems.push(`tag "${tag}" is not v<major>.<minor>.<patch>`);
  }
  const bare = version.slice(1);
  if (rootVersion !== bare) problems.push(`package.json is at ${rootVersion}, the tag at ${bare}`);
  if (desktopVersion !== bare) {
    problems.push(`desktop/package.json is at ${desktopVersion}, the tag at ${bare}`);
  }
  if (!changelogSection(changelog, bare)) {
    problems.push(`CHANGELOG.md has no notes under "## [${bare}]"`);
  }
  if (problems.length > 0)
    throw new Error(`Release ${tag} is not ready:\n- ${problems.join("\n- ")}`);
  return { version: bare, prerelease: isPrerelease(bare) };
}

/**
 * Join hard-wrapped lines back into single lines. CHANGELOG.md is wrapped for
 * editors, but GitHub renders every newline in a release body as a break.
 */
export function unwrapMarkdown(markdown) {
  const startsBlock = (line) => line.trim() === "" || /^\s*(#|[-*+] |\d+\. |>|\||```)/.test(line);
  const output = [];
  for (const line of markdown.split("\n")) {
    const previous = output.at(-1);
    if (
      !startsBlock(line) &&
      previous !== undefined &&
      previous.trim() !== "" &&
      !/^\s*#/.test(previous)
    ) {
      output[output.length - 1] = `${previous} ${line.trim()}`;
    } else {
      output.push(line);
    }
  }
  return output.join("\n");
}

/** Landing page downloads that are not among the built files. */
export function missingDownloads(files) {
  return DOWNLOADS.map((download) => download.file).filter((file) => !files.includes(file));
}

/** The GitHub release body: the changelog section plus downloads and first-launch hints. */
export function releaseNotes({
  changelog,
  version,
  macSigned = false,
  windowsSigned = false,
  downloads = true,
}) {
  const notes = changelogSection(changelog, version);
  if (!notes) throw new Error(`CHANGELOG.md has no notes under "## [${version}]"`);
  const tag = `v${version}`;
  // Relative links in the changelog point into the repository at this tag
  const section = unwrapMarkdown(notes).replace(
    /\]\(\.\/([^)]+)\)/g,
    `](${REPOSITORY_URL}/blob/${tag}/$1)`,
  );
  if (!downloads) return `${section}\n`;
  const lines = [
    section,
    "",
    "## Downloads",
    "",
    "| Platform | File |",
    "| --- | --- |",
    ...DOWNLOADS.map(
      (download) =>
        `| ${download.label}, ${download.detail} | [${download.file}](${REPOSITORY_URL}/releases/download/${tag}/${download.file}) |`,
    ),
    "",
    `The browser version needs no download: [hydractrl.d17e.dev/app](${HOSTED_APP_URL}).`,
  ];
  const hints = [];
  if (!macSigned) {
    hints.push(
      "on **macOS**, open the app once, then click *Open Anyway* in System Settings → Privacy & Security",
    );
  }
  if (!windowsSigned) {
    hints.push("on **Windows**, choose *More info* → *Run anyway* when SmartScreen warns");
  }
  if (hints.length > 0) lines.push("", `These builds are not signed yet: ${hints.join("; ")}.`);
  lines.push("", "SHA-256 checksums for every file are in `SHA256SUMS.txt`.");
  return `${lines.join("\n")}\n`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function setPackageVersion(path, version) {
  const text = readFileSync(path, "utf8");
  const updated = text.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`);
  if (updated === text && readJson(path).version !== version) {
    throw new Error(`no "version" field in ${path}`);
  }
  writeFileSync(path, updated);
}

function main(argv) {
  const [command, argument, ...flags] = argv;
  const changelog = () => readFileSync(FILES.changelog, "utf8");

  if (command === "check") {
    const result = checkRelease({
      tag: argument,
      rootVersion: readJson(FILES.rootPackage).version,
      desktopVersion: readJson(FILES.desktopPackage).version,
      changelog: changelog(),
    });
    console.log(result.version);
    return;
  }

  if (command === "notes") {
    const version = String(argument || "").replace(/^v/, "");
    process.stdout.write(
      releaseNotes({
        changelog: changelog(),
        version,
        macSigned: flags.includes("--mac-signed"),
        windowsSigned: flags.includes("--windows-signed"),
        downloads: !flags.includes("--no-downloads"),
      }),
    );
    return;
  }

  if (command === "assets") {
    const dir = argument || "dist";
    const missing = missingDownloads(readdirSync(dir));
    if (missing.length > 0) {
      throw new Error(`The landing page links to files that were not built: ${missing.join(", ")}`);
    }
    console.log(`All ${DOWNLOADS.length} landing page downloads are in ${dir}`);
    return;
  }

  if (command === "prepare") {
    const version = String(argument || "").replace(/^v/, "");
    const current = readJson(FILES.rootPackage).version;
    if (!isSemver(version)) throw new Error(`"${argument}" is not a semantic version`);
    if (compareVersions(version, current) <= 0 && !isPrerelease(version)) {
      throw new Error(`${version} is not newer than the current version ${current}`);
    }
    const date = new Date().toISOString().slice(0, 10);
    writeFileSync(FILES.changelog, prepareChangelog(changelog(), version, date));
    setPackageVersion(FILES.rootPackage, version);
    setPackageVersion(FILES.desktopPackage, version);
    console.log(`Prepared ${version} (was ${current}). Next:
  git commit -am "Release ${version}"   and merge it to main
  git tag v${version} && git push origin v${version}`);
    return;
  }

  console.error(
    "usage: bun scripts/release.js prepare <version> | check <tag> | notes <version> | assets <dir>",
  );
  process.exit(1);
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
