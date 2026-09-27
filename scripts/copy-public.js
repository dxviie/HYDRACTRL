#!/usr/bin/env bun
/**
 * Copy what a local HYDRACTRL server serves (public/ plus local-assets/) into
 * the folder next to the standalone binary. The hosted website's own files
 * stay behind: the landing page, its media and the Cloudflare Pages config.
 * Used by `bun run build:exe:full` and the desktop app's server build.
 *
 * Usage: bun scripts/copy-public.js [target]   (default: hydractrl-public)
 */
import { cpSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/** Top-level entries of public/ that only the hosted website needs. */
export const SITE_ONLY = Object.freeze(["index.html", "site", "_headers", "_redirects"]);

/** Does a path inside public/ belong in a local server's asset folder? */
export function isServerAsset(relativePath) {
  const top = relativePath.split(/[\\/]/)[0];
  return !SITE_ONLY.includes(top);
}

export function copyPublic({ root, target, fs = { cpSync, existsSync } }) {
  const publicDir = join(root, "public");
  fs.cpSync(publicDir, target, {
    recursive: true,
    filter: (source) => isServerAsset(relative(publicDir, source)),
  });
  const localAssets = join(root, "local-assets");
  if (fs.existsSync(localAssets)) fs.cpSync(localAssets, target, { recursive: true });
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "..");
  const target = resolve(process.argv[2] || join(root, "hydractrl-public"));
  copyPublic({ root, target });
  console.log(`Copied the server assets to ${target}`);
}
