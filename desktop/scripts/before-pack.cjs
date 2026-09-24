// electron-builder hook: compile the HYDRACTRL server for the platform and
// architecture being packaged, into the folder electron-builder.yml ships as
// resources/server. Runs once per target before app files are copied.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

// app-builder-lib's Arch enum
const ARCH_NAMES = { 0: "ia32", 1: "x64", 2: "armv7l", 3: "arm64", 4: "universal" };

exports.default = async function beforePack(context) {
  const platform = context.electronPlatformName;
  const arch = ARCH_NAMES[context.arch] || String(context.arch);
  if (arch === "universal") {
    throw new Error(
      "Universal macOS builds are not supported: package --arm64 and --x64 separately.",
    );
  }
  const desktopDir = path.join(__dirname, "..");
  const out = path.join(desktopDir, ".server-staging", "current");
  console.log(`  • compiling the HYDRACTRL server for ${platform}-${arch}`);
  execFileSync(
    "bun",
    ["scripts/build-server.mjs", "--platform", platform, "--arch", arch, "--out", out],
    { cwd: desktopDir, stdio: "inherit", shell: process.platform === "win32" },
  );
};
