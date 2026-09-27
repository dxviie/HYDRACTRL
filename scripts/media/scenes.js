/**
 * Scenes for the recordings: a returning user's storage with the starter bank
 * in bank 1, plus a few variations so the slot grid looks lived in.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sleep } from "./rig.js";

export const STARTER_BANK = join(
  import.meta.dir,
  "..",
  "..",
  "public",
  "assets",
  "banks",
  "hydractrl-init-basic.json",
);

const LOGO = 's0.initImage("/assets/img/hydractrl-logo-bw.png");';

/** Variations on the starters for slots 5 to 8 (recordings only). */
export const VARIANTS = [
  `// Tide, flipped
noise(1.8, 0.04)
  .color(0.05, 0.9, 0.55)
  .modulate(osc(2, 0.03, 0).rotate(0.4), 0.3)
  .add(noise(3, 0.06).thresh(0.55, 0.3).color(0.56, 0.1, 1), 0.5)
  .brightness(-0.2)
  .out()
`,
  `// Chained, kaleidoscope
${LOGO}

src(s0)
  .invert()
  .scale(0.35, 1, () => innerWidth / innerHeight)
  .kaleid(5)
  .rotate(0, 0.05)
  .color(0.56, 0.1, 1)
  .mult(noise(1.2, 0.04).add(solid(0.4, 0.4, 0.4)))
  .out()
`,
  `// Pulse, mint
osc(() => 18 + nanoX * 24, 0.004, 0)
  .rotate(() => 0.1 + nanoY * 0.4, 0.004)
  .mult(osc(() => 18 + nanoX * 24, 0.004, 0).rotate(() => -0.1 - nanoY * 0.4, -0.004))
  .color(0.05, 0.9, 0.55)
  .mult(noise(1, 0.03).add(solid(0.4, 0.4, 0.4)))
  .out()
`,
  `// Cells
voronoi(5, 0.2, 0.3)
  .color(0.56, 0.1, 1)
  .modulate(noise(2, 0.05), 0.15)
  .add(voronoi(10, 0.3).thresh(0.8, 0.1).color(0.05, 0.9, 0.55), 0.3)
  .brightness(-0.1)
  .out()
`,
];

export const slotKey = (slot, bank = 0) => `hydractrl-slot-bank-${bank}-slot-${slot}`;

const decode = (code) => decodeURIComponent(Buffer.from(code, "base64").toString("latin1"));

function starterSlots() {
  return JSON.parse(readFileSync(STARTER_BANK, "utf8")).banks[0].slots;
}

/** The code of a starter, as the bank holds it. */
export function starterCode(slot) {
  return decode(starterSlots()[slot].code);
}

/**
 * localStorage for a returning user: the starter bank with its thumbnails,
 * and no About panel on startup.
 */
export function starterStorage(extra = {}) {
  const storage = { "hydractrl-show-info-on-startup": "false" };
  for (const slot of starterSlots()) {
    storage[slotKey(slot.slotIndex)] = decode(slot.code);
    storage[`${slotKey(slot.slotIndex)}-thumbnail`] = slot.thumbnail;
  }
  return { ...storage, ...extra };
}

/** Run each code in its slot and let the interface save it with a thumbnail. */
export async function fillSlots(page, codes, firstSlot = 4) {
  for (const [i, code] of codes.entries()) {
    const slot = firstSlot + i;
    await page.evaluate(({ key, code }) => localStorage.setItem(key, code), {
      key: slotKey(slot),
      code,
    });
    await page.locator(".slot").nth(slot).click();
    await sleep(2500);
    await page.evaluate(() => window.slotsPanel.saveToActiveSlot());
    await sleep(900);
  }
}

/** Pick a slot the way a person would, and give the sketch time to start. */
export async function selectSlot(page, slot, settleMs = 2500) {
  await page.locator(".slot").nth(slot).click();
  await sleep(settleMs);
}

/** Remove the "saved" and "imported" toasts. */
export async function clearToasts(page) {
  await page.evaluate(() => {
    for (const toast of document.querySelectorAll(".saved-notification")) toast.remove();
  });
}
