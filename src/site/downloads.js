/**
 * Desktop downloads offered on the landing page and in the release notes.
 *
 * The file names are what desktop/electron-builder.yml produces (a test keeps
 * the two in sync). They carry no version, so
 * github.com/<repo>/releases/latest/download/<file> always points at the
 * newest build and the page works without JavaScript.
 */
import { RELEASES_URL } from "../project.js";

export const DOWNLOADS = Object.freeze([
  Object.freeze({
    id: "mac-arm64",
    os: "mac",
    arch: "arm64",
    label: "macOS",
    detail: "Apple Silicon (M1 and later)",
    format: "DMG",
    file: "HYDRACTRL-mac-arm64.dmg",
  }),
  Object.freeze({
    id: "mac-x64",
    os: "mac",
    arch: "x64",
    label: "macOS",
    detail: "Intel",
    format: "DMG",
    file: "HYDRACTRL-mac-x64.dmg",
  }),
  Object.freeze({
    id: "win-x64",
    os: "windows",
    arch: "x64",
    label: "Windows",
    detail: "64-bit installer",
    format: "EXE",
    file: "HYDRACTRL-win-x64-setup.exe",
  }),
]);

export const LATEST_RELEASE_API = "https://api.github.com/repos/dxviie/HYDRACTRL/releases/latest";

export function latestDownloadUrl(file) {
  return `${RELEASES_URL}/latest/download/${file}`;
}

/** The download id to recommend for a detected platform, or null. */
export function recommendedDownload(platform) {
  if (!platform) return null;
  if (platform.os === "mac") return platform.arch === "x64" ? "mac-x64" : "mac-arm64";
  if (platform.os === "windows") return "win-x64";
  return null;
}

/**
 * Condense a GitHub "latest release" API response into what the page shows.
 * Downloads missing from the release fall back to the release page.
 */
export function summarizeRelease(release) {
  if (!release || typeof release.tag_name !== "string") return null;
  const assets = new Map((release.assets || []).map((asset) => [asset.name, asset]));
  return {
    version: release.tag_name.replace(/^v/, ""),
    url: release.html_url || RELEASES_URL,
    publishedAt: release.published_at || null,
    downloads: DOWNLOADS.map((download) => {
      const asset = assets.get(download.file);
      return {
        id: download.id,
        available: Boolean(asset),
        size: asset ? asset.size : null,
        url: asset ? asset.browser_download_url : release.html_url || RELEASES_URL,
      };
    }),
  };
}

/** "118 MB" style sizes. */
export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** "27 September 2026" for an ISO date, or "" when it can't be parsed. */
export function formatDate(iso, locale = "en-GB") {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}
