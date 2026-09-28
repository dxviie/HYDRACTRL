# Releasing HYDRACTRL

HYDRACTRL follows [semantic versioning](https://semver.org/). The browser
version and the desktop app share one version number, kept in
`package.json` and `desktop/package.json`, and every release has notes in
[CHANGELOG.md](./CHANGELOG.md).

- **Patch** (1.2.1): bug fixes only.
- **Minor** (1.3.0): new features that don't break anything: scenes, banks,
  share links and settings from older versions keep working.
- **Major** (2.0.0): anything that does break them, such as a bank format older
  versions can't read, or a feature or platform that goes away.

The browser version at hydractrl.d17e.dev deploys from `main` on every merge
(Cloudflare Pages), so it can run ahead of the latest tag. A tag marks what the
desktop downloads contain.

## Cutting a release

1. Collect the changes under `## [Unreleased]` in `CHANGELOG.md`, grouped as
   *Added*, *Changed*, *Fixed* and *Removed*. Write for people who play with
   HYDRACTRL, not for people who read the code.
2. Prepare the release. This bumps both `package.json` files and moves the
   unreleased notes under `## [1.3.0] - <today>`, with updated compare links:

   ```bash
   bun run release:prepare 1.3.0
   ```

3. Commit, open a pull request and merge it into `main`.
4. Tag the merge commit and push the tag:

   ```bash
   git checkout main && git pull
   git tag v1.3.0
   git push origin v1.3.0
   ```

5. The **Release** workflow takes it from there, in about 15 minutes. It
   checks the tag against both versions and the changelog, runs the linter and
   the tests, builds the desktop app on macOS (Apple Silicon and Intel) and
   Windows, checks that every build starts, and publishes a GitHub release
   with the installers, `SHA256SUMS.txt` and the changelog notes plus a
   downloads table.

The download buttons on the landing page point at
`releases/latest/download/<file>`, so they serve the new version as soon as
the release is published. No change to the site is needed.

`bun run release:check v1.3.0` runs the workflow's first check locally, and
`bun run release:notes 1.3.0` prints the release notes it will publish.

### When something goes wrong

- **The workflow fails before publishing**: fix the problem on `main`, then
  move the tag: `git tag -d v1.3.0 && git push --delete origin v1.3.0`, tag
  the fixed commit and push again.
- **A published release is broken**: publish a patch release rather than
  swapping files in an existing one; people may already have downloaded it.
- **The tag is wrong or a check fails**: the workflow lists every problem it
  found (a version that doesn't match, a missing changelog section).
- **Publishing failed halfway**: re-run the workflow. When a release for the
  tag already exists (a draft that a failed upload left behind, or one made
  on GitHub), it attaches the files to that release, replaces its notes with
  the changelog's and publishes it.

### Pre-releases

A tag such as `v1.3.0-beta.1` publishes a GitHub pre-release. The landing
page keeps pointing at the latest full release. The version in both
`package.json` files must match, and the changelog needs a
`## [1.3.0-beta.1]` section.

## Desktop download names

The installers carry no version in their names (`HYDRACTRL-mac-arm64.dmg`,
`HYDRACTRL-mac-x64.dmg`, `HYDRACTRL-win-x64-setup.exe`), which is what makes
the landing page's `releases/latest/download/...` links stable. The names come
from `desktop/electron-builder.yml`; `src/site/downloads.js` lists them for the
landing page and the release notes, and a test fails if the two drift apart.
The Release workflow also refuses to publish when one of them was not built.

## Signing and notarization

Builds are unsigned unless you add signing credentials. Unsigned macOS builds
are signed ad hoc, which is enough for Apple Silicon to run them; on first
launch people confirm the app once (macOS: System Settings → Privacy &
Security → *Open Anyway*; Windows: *More info* → *Run anyway*). The landing
page and the release notes explain this.

To sign, add these repository secrets (Settings → Secrets and variables →
Actions). Release builds pick them up automatically; pull request builds
never use them.

| Secret | What it holds |
| --- | --- |
| `MAC_CERTIFICATE_P12_BASE64` | A *Developer ID Application* certificate exported as `.p12`, base64-encoded (`base64 -i certificate.p12`) |
| `MAC_CERTIFICATE_PASSWORD` | The password of that `.p12` |
| `APPLE_ID` | The Apple ID used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | An app-specific password for that Apple ID ([account.apple.com](https://account.apple.com)) |
| `APPLE_TEAM_ID` | The 10-character team ID of the developer account |
| `WINDOWS_CERTIFICATE_P12_BASE64` | A Windows code-signing certificate (`.pfx`), base64-encoded |
| `WINDOWS_CERTIFICATE_PASSWORD` | The password of that `.pfx` |

With a macOS certificate the build is signed with the hardened runtime and
the entitlements in `desktop/resources/`, and notarized when the three Apple
secrets are set. Once a platform is signed, the release notes leave out its
first-launch hint; update the *Opening the app for the first time* notes on the
landing page (`public/index.html`) as well.

Windows certificates issued since mid-2023 live on hardware tokens or in cloud
key vaults and can't be exported as a `.pfx`. For those, electron-builder's
`win.azureSignOptions` (Azure Trusted Signing) is the way to go; it needs a
change to the Package step in `.github/workflows/desktop.yml`.

## Testing a desktop build before a release

The **Desktop app** workflow builds all three installers for pull requests
that touch the app, and on demand (Actions → Desktop app → Run workflow). The
installers end up as workflow artifacts, so you can try a build on real
hardware, Syphon and Spout included, before tagging.

Every build is also started on its own platform before it counts. On macOS
the workflow first verifies the app's signature, since a broken one makes
macOS report the app as damaged, with no *Open Anyway*. Then
`desktop/scripts/smoke.mjs` launches the packaged app, waits for its bundled
server and the interface, and goes through the output controls, the
settings window and a clean quit. The runners have no real GPU, so a Syphon
or Spout output that doesn't start there is only a warning: that part still
needs real hardware.

## Versions before the release workflow

1.0.0 (the version that went live in 2025) and 1.1.0 (the plugin system and
share links, July 2026) predate this process. To tag them for reference:

```bash
git tag -a v1.0.0 3690838 -m "HYDRACTRL 1.0.0"
git tag -a v1.1.0 65078d8 -m "HYDRACTRL 1.1.0"
git push origin v1.0.0 v1.1.0
```

Those commits don't contain the Release workflow, so the tags don't trigger
builds. To give them a GitHub release without downloads:

```bash
bun scripts/release.js notes 1.0.0 --no-downloads > notes.md
gh release create v1.0.0 --title "HYDRACTRL 1.0.0" --notes-file notes.md --latest=false
```
