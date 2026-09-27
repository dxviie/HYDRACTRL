// electron-builder hook: runs once the app is assembled, before it is signed.
//
// npm packages can't hold symlinks, so the Syphon.framework that
// @napolab/texture-bridge ships arrives with the framework's links copied out
// as duplicates (a top-level Syphon binary next to Versions/A/Syphon, a
// Versions/Current directory). codesign refuses such a bundle ("bundle format
// is ambiguous"), which breaks both ad-hoc and Developer ID signing. Put the
// standard layout back: Versions/Current -> A, and top-level entries linking
// into Versions/Current. The native addon loads Versions/A/Syphon, so
// nothing it needs moves.
const fs = require("node:fs");
const path = require("node:path");

/** Directories named *.framework below `dir`, without following symlinks. */
function findFrameworks(dir, fsImpl = fs) {
  const found = [];
  if (!fsImpl.existsSync(dir)) return found;
  for (const entry of fsImpl.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name.endsWith(".framework")) found.push(full);
    else found.push(...findFrameworks(full, fsImpl));
  }
  return found;
}

function linkTo(target, linkPath, fsImpl) {
  fsImpl.rmSync(linkPath, { recursive: true, force: true });
  fsImpl.symlinkSync(target, linkPath);
}

/**
 * Restore a versioned framework's symlinks. Returns false (and changes
 * nothing) for a framework that already has them or has an unusual layout.
 */
function restoreFrameworkLinks(frameworkPath, fsImpl = fs) {
  const versions = path.join(frameworkPath, "Versions");
  if (!fsImpl.existsSync(versions)) return false;
  const current = path.join(versions, "Current");
  if (fsImpl.existsSync(current) && fsImpl.lstatSync(current).isSymbolicLink()) return false;
  const real = fsImpl.readdirSync(versions).filter((name) => name !== "Current");
  if (real.length !== 1) return false;

  linkTo(real[0], current, fsImpl);
  for (const name of fsImpl.readdirSync(path.join(versions, real[0]))) {
    // The code signature belongs to the version directory only
    if (name === "_CodeSignature") continue;
    linkTo(path.join("Versions", "Current", name), path.join(frameworkPath, name), fsImpl);
  }
  return true;
}

exports.findFrameworks = findFrameworks;
exports.restoreFrameworkLinks = restoreFrameworkLinks;

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin" && context.electronPlatformName !== "mas") return;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const unpacked = path.join(
    context.appOutDir,
    appName,
    "Contents",
    "Resources",
    "app.asar.unpacked",
    "node_modules",
  );
  for (const framework of findFrameworks(unpacked)) {
    if (restoreFrameworkLinks(framework)) {
      console.log(
        `  • restored framework symlinks  file=${path.relative(context.appOutDir, framework)}`,
      );
    }
  }
};
