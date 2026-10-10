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

The macOS app is signed with a Developer ID certificate and notarized by
Apple; the credentials are in the repository secrets below. The Windows
installer isn't signed yet, so on first launch Windows users click *More
info* → *Run anyway* when SmartScreen warns. Builds without credentials, such
as pull request builds, are unsigned; their macOS apps are signed ad hoc,
which is enough for Apple Silicon to run them once people click *Open
Anyway* in System Settings → Privacy & Security.

Signing credentials go in repository secrets (Settings → Secrets and
variables → Actions). Release builds and *Desktop app* runs with *Sign*
checked use them; pull request builds never do. The release notes add a
first-launch hint for each platform whose secrets are missing. When that
changes, update the *Opening the app for the first time* notes on the
landing page (`public/index.html`) and the desktop README as well.

### macOS

1. **Join the [Apple Developer Program](https://developer.apple.com/programs/enroll/)**
   (99 USD a year) with an Apple Account that has two-factor authentication.
   Enroll *as an organization* when the publisher is a legal entity (not a
   trade name or a sole proprietorship): that takes a D-U-N-S number, a
   website on the organization's domain and an email address there, and
   the organization's name becomes the developer name. Otherwise enroll *as
   an individual*, under your legal name; an individual membership can be
   converted to an organization later and keeps its team ID and
   certificates (then make a new Developer ID certificate, so the signature
   carries the organization's name, and swap the two certificate secrets).
   Either way, an Apple Account on the project's own domain is easier to
   hand over than a personal one: it stays with the membership.
2. **Create a Developer ID certificate** (the account holder has to, on a
   Mac):
   1. Keychain Access → Certificate Assistant → *Request a Certificate From
      a Certificate Authority*, saved to disk.
   2. [Certificates](https://developer.apple.com/account/resources/certificates/list)
      → **+** → *Developer ID Application*, upload the request, download
      the certificate and double-click it.
   3. In Keychain Access, under *My Certificates*, export *Developer ID
      Application: …* as a `.p12` with a strong password.
   4. `base64 -i certificate.p12 | pbcopy` gives `MAC_CERTIFICATE_P12_BASE64`;
      the password is `MAC_CERTIFICATE_PASSWORD`.
3. **Create an API key for notarization**: App Store Connect → Users and
   Access → Integrations → App Store Connect API → *Team Keys* (request
   access the first time), generate a key with the *Developer* role and
   download `AuthKey_<key ID>.p8`, which is offered only once. Its contents
   (`pbcopy < AuthKey_<key ID>.p8`) go in `APPLE_API_KEY_P8`, the key ID in
   `APPLE_API_KEY_ID` and the issuer ID above the list of keys in
   `APPLE_API_ISSUER`. Personal keys can't notarize; it has to be a team key.
   An Apple ID with an app-specific password works too (`APPLE_ID`,
   `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`), but ties the releases to
   one person's account.
4. **Test it**: Actions → Desktop app → Run workflow, with *Sign* checked.
   A signed build has to pass Gatekeeper as notarized with its ticket
   stapled, or the macOS jobs fail. So a certificate without notarization
   credentials fails the build: macOS blocks a signed app that isn't
   notarized just like an unsigned one. Apple can take hours over a new
   team's first submissions (five, for HYDRACTRL's); later ones take minutes.
   The Package step logs the submission ID and, every ten minutes, that Apple
   is still at it, and `xcrun notarytool history` (with the API key) lists
   the submissions and their status. Network drops while the job waits on
   Apple are retried; only ten minutes of failed status checks in a row fail
   the job, and Apple still finishes that submission.

The app is signed with the hardened runtime and the entitlements in
`desktop/resources/`.

### Windows

Signed or not, SmartScreen can warn about a new release until it has built up
a download reputation; a signature puts the publisher's name on the warning
and on the installer. Certificates issued since mid-2023 live on hardware
tokens or in cloud key vaults and can't be exported, so the
`WINDOWS_CERTIFICATE_P12_BASE64` route below only fits an older certificate.

The practical route is [Azure Artifact Signing](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)
(formerly Trusted Signing): 9.99 USD a month on the Basic tier, with a paid
Azure subscription and an identity validation that takes 1 to 20 business
days. It is open to organizations in the US, Canada, the EU, the UK and a
few more countries, but to individuals only in the US and Canada.
electron-builder signs with it through `win.azureSignOptions` and a service
principal (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`),
which the Package step in `.github/workflows/desktop.yml` doesn't set up yet.

### Secrets

| Secret | What it holds |
| --- | --- |
| `MAC_CERTIFICATE_P12_BASE64` | The *Developer ID Application* certificate as a `.p12`, base64-encoded |
| `MAC_CERTIFICATE_PASSWORD` | The password of that `.p12` |
| `APPLE_API_KEY_P8` | The contents of the App Store Connect API key (`AuthKey_<key ID>.p8`) |
| `APPLE_API_KEY_ID` | That key's ID |
| `APPLE_API_ISSUER` | The issuer ID from App Store Connect → Users and Access → Integrations |
| `APPLE_ID` | Instead of the API key: the Apple ID used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | Instead of the API key: an app-specific password for that Apple ID ([account.apple.com](https://account.apple.com)) |
| `APPLE_TEAM_ID` | Instead of the API key: the 10-character team ID |
| `WINDOWS_CERTIFICATE_P12_BASE64` | A Windows code-signing certificate (`.pfx`), base64-encoded |
| `WINDOWS_CERTIFICATE_PASSWORD` | The password of that `.pfx` |

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
or Spout output that doesn't start there is only a warning, and the Intel
macOS runner, which can't render WebGL at all, skips the interface's own
start: those parts still need real hardware.

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
