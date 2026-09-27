/**
 * DeviceDetection - shared device heuristics used by the core and plugins.
 * Each takes the browser environment (window) as an argument so it can be tested.
 */

/**
 * Screens whose shorter side is narrower than this, in CSS pixels, are phones.
 * It is where Android draws the line between phones and tablets (600dp); the
 * smallest iPad, the mini, is 744 wide.
 */
const TABLET_MIN_SHORT_SIDE = 600;

/** Whether the main pointer is a finger (phones, tablets) rather than a mouse or trackpad. */
export function isTouchFirst(env = globalThis) {
  return Boolean(env.matchMedia?.("(pointer: coarse)").matches);
}

/**
 * Whether this is a phone: touch first, on a small screen. Phones get the
 * mobile UI (see MobileUiPlugin); tablets such as the iPad get the full
 * interface, like desktops. Measures the screen rather than the window, so
 * an iPad in Split View is still a tablet.
 */
export function isPhone(env = globalThis) {
  const { width = 0, height = 0 } = env.screen ?? {};
  return isTouchFirst(env) && Math.min(width, height) < TABLET_MIN_SHORT_SIDE;
}

/**
 * Whether this is a tablet: an iPad, or an Android device that isn't a phone.
 * Tablets get the full interface except MIDI and the breakout window, which
 * don't work on an iPad (Safari has no Web MIDI, and new windows open as
 * tabs). Goes by the operating system, so touch-screen laptops keep them.
 * iPadOS asks for desktop sites as a Mac, but Macs have no touch screen.
 */
export function isTablet(env = globalThis) {
  const nav = env.navigator ?? {};
  const mobileOs =
    /iPad|iPhone|iPod|Android/i.test(String(nav.userAgent ?? "")) ||
    (/Mac/i.test(String(nav.platform ?? "")) && (nav.maxTouchPoints ?? 0) > 1);
  return mobileOs && !isPhone(env);
}
