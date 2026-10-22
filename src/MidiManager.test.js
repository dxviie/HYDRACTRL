import { describe, expect, test } from "bun:test";
import { sceneForNote } from "./MidiManager.js";

// Two notes per scene are enough to show the rule
const MAPPING = [
  [
    { note: 37, slot: 0 },
    { note: 36, slot: 8 },
  ],
  [
    { note: 53, slot: 0 },
    { note: 52, slot: 8 },
  ],
  [{ note: 69, slot: 0 }],
  [{ note: 85, slot: 0 }],
];

describe("sceneForNote", () => {
  test("keeps the current scene when it plays the note", () => {
    expect(sceneForNote(MAPPING, 0, 37)).toBe(0);
    expect(sceneForNote(MAPPING, 1, 52)).toBe(1);
  });

  test("finds the scene a pad belongs to when the scene button's message got lost", () => {
    expect(sceneForNote(MAPPING, 0, 53)).toBe(1);
    expect(sceneForNote(MAPPING, 1, 85)).toBe(3);
    expect(sceneForNote(MAPPING, 3, 36)).toBe(0);
  });

  test("prefers the current scene when a learned note is in two scenes", () => {
    const learned = MAPPING.map((scene) => [...scene]);
    learned[2].push({ note: 37, slot: 5 });
    expect(sceneForNote(learned, 2, 37)).toBe(2);
    expect(sceneForNote(learned, 1, 37)).toBe(0);
  });

  test("is -1 for a note no scene plays", () => {
    expect(sceneForNote(MAPPING, 0, 12)).toBe(-1);
  });
});
