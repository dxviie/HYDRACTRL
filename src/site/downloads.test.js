import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DOWNLOADS,
  formatDate,
  formatSize,
  latestDownloadUrl,
  recommendedDownload,
  summarizeRelease,
} from "./downloads.js";

const ROOT = join(import.meta.dir, "..", "..");

/** Expand electron-builder's artifactName macros the way it does for our targets. */
function expandArtifactName(pattern, { os, arch, ext }) {
  return pattern
    .replaceAll("${productName}", "HYDRACTRL")
    .replaceAll("${os}", os)
    .replaceAll("${arch}", arch)
    .replaceAll("${ext}", ext);
}

function artifactNames() {
  const config = readFileSync(join(ROOT, "desktop", "electron-builder.yml"), "utf8");
  const top = config.match(/^artifactName: (.+)$/m)?.[1];
  const nsis = config.match(/^nsis:\n(?: {2}.*\n)*? {2}artifactName: (.+)$/m)?.[1];
  return { top, nsis };
}

describe("DOWNLOADS", () => {
  test("file names match what electron-builder produces", () => {
    const { top, nsis } = artifactNames();
    expect(top).toBeTruthy();
    expect(nsis).toBeTruthy();
    const expected = {
      "mac-arm64": expandArtifactName(top, { os: "mac", arch: "arm64", ext: "dmg" }),
      "mac-x64": expandArtifactName(top, { os: "mac", arch: "x64", ext: "dmg" }),
      "win-x64": expandArtifactName(nsis, { os: "win", arch: "x64", ext: "exe" }),
    };
    for (const download of DOWNLOADS) {
      expect(download.file).toBe(expected[download.id]);
    }
  });

  test("the landing page links every download to the latest release", () => {
    const html = readFileSync(join(ROOT, "public", "index.html"), "utf8");
    for (const download of DOWNLOADS) {
      const link = html.match(new RegExp(`data-download="${download.id}"\\s+href="([^"]+)"`));
      expect(link?.[1]).toBe(latestDownloadUrl(download.file));
    }
  });

  test("latest-release links carry no version", () => {
    expect(latestDownloadUrl("HYDRACTRL-mac-arm64.dmg")).toBe(
      "https://github.com/dxviie/HYDRACTRL/releases/latest/download/HYDRACTRL-mac-arm64.dmg",
    );
    for (const download of DOWNLOADS) expect(download.file).not.toMatch(/\d+\.\d+\.\d+/);
  });
});

describe("recommendedDownload", () => {
  test("picks a build for macs and windows, nothing elsewhere", () => {
    expect(recommendedDownload({ os: "mac", arch: null })).toBe("mac-arm64");
    expect(recommendedDownload({ os: "mac", arch: "arm64" })).toBe("mac-arm64");
    expect(recommendedDownload({ os: "mac", arch: "x64" })).toBe("mac-x64");
    expect(recommendedDownload({ os: "windows", arch: "arm64" })).toBe("win-x64");
    expect(recommendedDownload({ os: "linux", arch: null })).toBeNull();
    expect(recommendedDownload({ os: "mobile", arch: null })).toBeNull();
    expect(recommendedDownload(null)).toBeNull();
  });
});

describe("summarizeRelease", () => {
  const release = {
    tag_name: "v1.2.0",
    html_url: "https://github.com/dxviie/HYDRACTRL/releases/tag/v1.2.0",
    published_at: "2026-09-27T12:00:00Z",
    assets: [
      {
        name: "HYDRACTRL-mac-arm64.dmg",
        size: 123_400_000,
        browser_download_url: "https://example.test/arm64.dmg",
      },
      {
        name: "HYDRACTRL-win-x64-setup.exe",
        size: 98_000_000,
        browser_download_url: "https://example.test/setup.exe",
      },
    ],
  };

  test("maps assets onto the downloads", () => {
    const summary = summarizeRelease(release);
    expect(summary.version).toBe("1.2.0");
    expect(summary.url).toBe(release.html_url);
    const byId = Object.fromEntries(summary.downloads.map((d) => [d.id, d]));
    expect(byId["mac-arm64"]).toEqual({
      id: "mac-arm64",
      available: true,
      size: 123_400_000,
      url: "https://example.test/arm64.dmg",
    });
    // A build missing from the release points at the release page instead
    expect(byId["mac-x64"].available).toBe(false);
    expect(byId["mac-x64"].url).toBe(release.html_url);
  });

  test("rejects responses that are not a release", () => {
    expect(summarizeRelease(null)).toBeNull();
    expect(summarizeRelease({ message: "Not Found" })).toBeNull();
  });
});

describe("formatting", () => {
  test("formatSize", () => {
    expect(formatSize(123_400_000)).toBe("123 MB");
    expect(formatSize(9_500_000)).toBe("9.5 MB");
    expect(formatSize(1_200_000_000)).toBe("1.2 GB");
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(null)).toBe("");
    expect(formatSize(0)).toBe("");
  });

  test("formatDate", () => {
    expect(formatDate("2026-09-27T12:00:00Z")).toBe("27 September 2026");
    expect(formatDate("not a date")).toBe("");
    expect(formatDate(null)).toBe("");
  });
});
