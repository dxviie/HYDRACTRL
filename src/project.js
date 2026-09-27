/**
 * Project facts shared by the server, the interface and the landing page.
 * Bun inlines just the version string from package.json at build time.
 */
import { version } from "../package.json";

export const VERSION = version;

export const WEBSITE_URL = "https://hydractrl.d17e.dev/";
/** The hosted browser version (the landing page lives at the site root). */
export const HOSTED_APP_URL = "https://hydractrl.d17e.dev/app";
export const REPOSITORY_URL = "https://github.com/dxviie/HYDRACTRL";
export const RELEASES_URL = `${REPOSITORY_URL}/releases`;
export const CHANGELOG_URL = `${REPOSITORY_URL}/blob/main/CHANGELOG.md`;
