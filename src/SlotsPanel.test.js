import { describe, expect, test } from "bun:test";
import { clampSlotsPanelWidth, slotsPanelWidth } from "./SlotsPanel.js";

describe("slots panel width", () => {
  test("fits 8 square slots of a size, the gaps between them and the padding", () => {
    expect(slotsPanelWidth(40)).toBe(40 * 8 + 3 * 7 + 4 * 2);
    expect(slotsPanelWidth(100)).toBe(100 * 8 + 3 * 7 + 4 * 2);
  });

  test("keeps the slots between 40 and 100px", () => {
    expect(clampSlotsPanelWidth(100)).toBe(slotsPanelWidth(40));
    expect(clampSlotsPanelWidth(500)).toBe(500);
    expect(clampSlotsPanelWidth(5000)).toBe(slotsPanelWidth(100));
  });
});
