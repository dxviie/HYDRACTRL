import { describe, expect, test } from "bun:test";
import { clampSlotsPanelWidth, clearStoredSlots, slotsPanelWidth } from "./SlotsPanel.js";

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

/** Just enough of local storage, keys in the order they were set. */
function createStorage(entries) {
  const map = new Map(entries);
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    removeItem: (key) => map.delete(key),
    keys: () => [...map.keys()],
  };
}

function savedSlot(bank, slot) {
  const key = `hydractrl-slot-bank-${bank}-slot-${slot}`;
  return [
    [key, "osc().out()"],
    [`${key}-thumbnail`, "data:image/jpeg;base64,"],
    [`${key}-thumbnail-timestamp`, "1"],
  ];
}

describe("clearing saved slots", () => {
  const saved = () =>
    createStorage([
      ...savedSlot(0, 0),
      ...savedSlot(0, 15),
      ...savedSlot(2, 3),
      ["hydractrl-theme", "theme-dark"],
    ]);

  test("one scene", () => {
    const storage = saved();
    expect(clearStoredSlots(storage, "scene", 0)).toBe(2);
    expect(storage.keys()).toEqual([...savedSlot(2, 3).map(([key]) => key), "hydractrl-theme"]);
  });

  test("all scenes, and nothing else", () => {
    const storage = saved();
    expect(clearStoredSlots(storage, "all")).toBe(3);
    expect(storage.keys()).toEqual(["hydractrl-theme"]);
  });

  test("every thumbnail, keeping the code", () => {
    const storage = saved();
    expect(clearStoredSlots(storage, "thumbnails")).toBe(3);
    expect(storage.keys()).toEqual([
      "hydractrl-slot-bank-0-slot-0",
      "hydractrl-slot-bank-0-slot-15",
      "hydractrl-slot-bank-2-slot-3",
      "hydractrl-theme",
    ]);
  });
});
