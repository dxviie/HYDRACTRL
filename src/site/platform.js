/**
 * Best-effort guess of the visitor's operating system and CPU, to highlight
 * the right download. Takes a navigator-like object so it can be tested.
 */

/** @returns {{ os: "mac"|"windows"|"linux"|"mobile"|"unknown", arch: "arm64"|"x64"|null }} */
export function detectPlatform(nav) {
  const ua = String(nav?.userAgent || "");
  const platform = String(nav?.userAgentData?.platform || nav?.platform || "");
  const touchPoints = Number(nav?.maxTouchPoints || 0);

  // iPadOS reports itself as a Mac, but Macs have no touch screen
  if (/iPhone|iPad|iPod|Android/i.test(ua) || (/Mac/i.test(platform) && touchPoints > 1)) {
    return { os: "mobile", arch: null };
  }
  if (/Mac/i.test(platform) || /Macintosh|Mac OS X/i.test(ua)) return { os: "mac", arch: null };
  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    return { os: "windows", arch: /ARM64|aarch64/i.test(ua) ? "arm64" : "x64" };
  }
  if (/Linux|X11|CrOS/i.test(`${platform} ${ua}`)) return { os: "linux", arch: null };
  return { os: "unknown", arch: null };
}

/**
 * The CPU architecture from Chromium's client hints ("arm" or "x86"), or
 * null where they are not available (Safari, Firefox).
 */
export async function detectArchitecture(nav) {
  try {
    const hints = await nav?.userAgentData?.getHighEntropyValues?.(["architecture"]);
    if (hints?.architecture === "arm") return "arm64";
    if (hints?.architecture === "x86") return "x64";
  } catch (_error) {
    // Client hints can be blocked; fall back to the default
  }
  return null;
}
