/**
 * DeviceDetection - shared device heuristics used by the core and plugins.
 */

/** Detect if the device is a mobile or tablet. */
export function isMobileOrTablet() {
  // Check user agent for mobile indicators
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    "mobile",
    "android",
    "iphone",
    "ipad",
    "ipod",
    "blackberry",
    "windows phone",
  ];
  const hasMobileKeyword = mobileKeywords.some((keyword) => userAgent.includes(keyword));

  // Check screen size (typical mobile/tablet sizes)
  const isMobileScreen = window.innerWidth <= 1024 || window.innerHeight <= 768;

  // Check for touch capability
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  // Check device orientation API (common on mobile devices)
  const hasOrientation = "orientation" in window;

  // Return true if any mobile indicator is present
  return hasMobileKeyword || (isMobileScreen && hasTouch) || hasOrientation;
}
