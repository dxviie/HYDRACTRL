import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  changelogSection,
  checkRelease,
  compareVersions,
  isPrerelease,
  isSemver,
  missingDownloads,
  prepareChangelog,
  releaseNotes,
  unwrapMarkdown,
} from "./release.js";

const ROOT = join(import.meta.dir, "..");
const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

const CHANGELOG = `# Changelog

Intro text.

## [Unreleased]

### Added

- A new thing.

## [1.1.0] - 2026-07-06

### Fixed

- A bug, see [the docs](./docs/PLUGINS.md).

## [1.0.0] - 2025-06-12

The first public version.

[Unreleased]: https://github.com/dxviie/HYDRACTRL/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/dxviie/HYDRACTRL/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/dxviie/HYDRACTRL/releases/tag/v1.0.0
`;

describe("versions", () => {
  test("isSemver and isPrerelease", () => {
    expect(isSemver("1.2.0")).toBe(true);
    expect(isSemver("1.2.0-beta.1")).toBe(true);
    expect(isSemver("1.2")).toBe(false);
    expect(isSemver("v1.2.0")).toBe(false);
    expect(isSemver("01.2.0")).toBe(false);
    expect(isPrerelease("1.2.0-rc.1")).toBe(true);
    expect(isPrerelease("1.2.0")).toBe(false);
    expect(isPrerelease("1.2.0+build.5")).toBe(false);
  });

  test("compareVersions", () => {
    expect(compareVersions("1.2.0", "1.1.9")).toBe(1);
    expect(compareVersions("1.2.0", "1.10.0")).toBe(-1);
    expect(compareVersions("2.0.0", "2.0.0")).toBe(0);
  });
});

describe("changelogSection", () => {
  test("returns the notes between headings, without link definitions", () => {
    expect(changelogSection(CHANGELOG, "1.1.0")).toBe(
      "### Fixed\n\n- A bug, see [the docs](./docs/PLUGINS.md).",
    );
    expect(changelogSection(CHANGELOG, "1.0.0")).toBe("The first public version.");
    expect(changelogSection(CHANGELOG, "Unreleased")).toBe("### Added\n\n- A new thing.");
    expect(changelogSection(CHANGELOG, "9.9.9")).toBeNull();
  });
});

describe("prepareChangelog", () => {
  test("moves the unreleased notes under the new version and updates the links", () => {
    const prepared = prepareChangelog(CHANGELOG, "1.2.0", "2026-09-27");
    expect(changelogSection(prepared, "Unreleased")).toBe("");
    expect(changelogSection(prepared, "1.2.0")).toBe("### Added\n\n- A new thing.");
    expect(prepared).toContain("## [1.2.0] - 2026-09-27");
    expect(changelogSection(prepared, "1.1.0")).toBe(changelogSection(CHANGELOG, "1.1.0"));
    expect(prepared).toContain(
      "[Unreleased]: https://github.com/dxviie/HYDRACTRL/compare/v1.2.0...HEAD\n" +
        "[1.2.0]: https://github.com/dxviie/HYDRACTRL/compare/v1.1.0...v1.2.0\n" +
        "[1.1.0]:",
    );
  });

  test("refuses an empty release, a duplicate or a bad version", () => {
    const prepared = prepareChangelog(CHANGELOG, "1.2.0", "2026-09-27");
    expect(() => prepareChangelog(prepared, "1.3.0", "2026-10-01")).toThrow("empty");
    expect(() => prepareChangelog(CHANGELOG, "1.1.0", "2026-10-01")).toThrow("already");
    expect(() => prepareChangelog(CHANGELOG, "1.2", "2026-10-01")).toThrow("semantic");
  });
});

describe("checkRelease", () => {
  const ready = {
    tag: "v1.1.0",
    rootVersion: "1.1.0",
    desktopVersion: "1.1.0",
    changelog: CHANGELOG,
  };

  test("accepts a tag that matches both versions and has notes", () => {
    expect(checkRelease(ready)).toEqual({ version: "1.1.0", prerelease: false });
    expect(checkRelease({ ...ready, tag: "refs/tags/v1.1.0" }).version).toBe("1.1.0");
  });

  test("lists every problem", () => {
    let message = "";
    try {
      checkRelease({ ...ready, tag: "v1.3.0", desktopVersion: "1.0.0" });
    } catch (error) {
      message = error.message;
    }
    expect(message).toContain("package.json is at 1.1.0");
    expect(message).toContain("desktop/package.json is at 1.0.0");
    expect(message).toContain('no notes under "## [1.3.0]"');
    expect(() => checkRelease({ ...ready, tag: "1.1.0" })).toThrow("is not v<major>");
  });
});

describe("releaseNotes", () => {
  test("adds downloads and first-launch hints to the changelog section", () => {
    const notes = releaseNotes({ changelog: CHANGELOG, version: "1.1.0" });
    expect(notes.startsWith("### Fixed\n\n- A bug, see [the docs](")).toBe(true);
    // Relative links become links into the repository at the release tag
    expect(notes).toContain(
      "[the docs](https://github.com/dxviie/HYDRACTRL/blob/v1.1.0/docs/PLUGINS.md)",
    );
    expect(notes).toContain("\n\n## Downloads\n");
    expect(notes).toContain(
      "https://github.com/dxviie/HYDRACTRL/releases/download/v1.1.0/HYDRACTRL-mac-arm64.dmg",
    );
    expect(notes).toContain("HYDRACTRL-win-x64-setup.exe");
    expect(notes).toContain("https://hydractrl.d17e.dev/app");
    expect(notes).toContain("Open Anyway");
    expect(notes).toContain("Run anyway");
    const signed = releaseNotes({
      changelog: CHANGELOG,
      version: "1.1.0",
      macSigned: true,
      windowsSigned: true,
    });
    expect(signed).not.toContain("not signed yet");
    const webOnly = releaseNotes({ changelog: CHANGELOG, version: "1.0.0", downloads: false });
    expect(webOnly).toBe("The first public version.\n");
    expect(() => releaseNotes({ changelog: CHANGELOG, version: "2.0.0" })).toThrow();
  });
});

describe("unwrapMarkdown", () => {
  test("joins wrapped lines but keeps headings, lists and paragraphs apart", () => {
    const wrapped = [
      "### Added",
      "",
      "- One item that",
      "  wraps.",
      "  - A nested item",
      "    that wraps too.",
      "- Another item.",
      "",
      "A paragraph",
      "on two lines.",
    ].join("\n");
    expect(unwrapMarkdown(wrapped)).toBe(
      [
        "### Added",
        "",
        "- One item that wraps.",
        "  - A nested item that wraps too.",
        "- Another item.",
        "",
        "A paragraph on two lines.",
      ].join("\n"),
    );
  });
});

describe("missingDownloads", () => {
  test("names the landing page downloads a build did not produce", () => {
    const built = [
      "HYDRACTRL-mac-arm64.dmg",
      "HYDRACTRL-mac-arm64.zip",
      "HYDRACTRL-win-x64-setup.exe",
      "SHA256SUMS.txt",
    ];
    expect(missingDownloads(built)).toEqual(["HYDRACTRL-mac-x64.dmg"]);
    expect(missingDownloads([...built, "HYDRACTRL-mac-x64.dmg"])).toEqual([]);
  });
});

describe("this repository", () => {
  test("both packages carry the same semantic version", () => {
    const root = readJson("package.json").version;
    expect(isSemver(root)).toBe(true);
    expect(readJson("desktop/package.json").version).toBe(root);
  });

  test("CHANGELOG.md has notes for the current version", () => {
    const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
    const version = readJson("package.json").version;
    expect(changelogSection(changelog, version)).toBeTruthy();
    expect(changelogSection(changelog, "Unreleased")).not.toBeNull();
  });
});
