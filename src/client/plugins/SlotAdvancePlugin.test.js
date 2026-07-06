import { describe, expect, test } from "bun:test";
import { computeNextSlot } from "./SlotAdvancePlugin.js";

describe("computeNextSlot", () => {
  test("advances to the next slot within a bank", () => {
    expect(computeNextSlot(0, 0)).toEqual({ bank: 0, slot: 1, wrapped: false });
    expect(computeNextSlot(2, 7)).toEqual({ bank: 2, slot: 8, wrapped: false });
  });

  test("moves to the first slot of the next bank after the last slot", () => {
    expect(computeNextSlot(0, 15)).toEqual({ bank: 1, slot: 0, wrapped: false });
    expect(computeNextSlot(2, 15)).toEqual({ bank: 3, slot: 0, wrapped: false });
  });

  test("flags wrap-around from the last bank as full", () => {
    expect(computeNextSlot(3, 15)).toEqual({ bank: 0, slot: 0, wrapped: true });
  });

  test("accepts numeric strings, like slot info coming from the DOM", () => {
    expect(computeNextSlot("1", "3")).toEqual({ bank: 1, slot: 4, wrapped: false });
  });

  test("returns null for invalid input", () => {
    expect(computeNextSlot(Number.NaN, 0)).toBeNull();
    expect(computeNextSlot(0, "not-a-slot")).toBeNull();
    expect(computeNextSlot(-1, 0)).toBeNull();
    expect(computeNextSlot(4, 0)).toBeNull();
    expect(computeNextSlot(0, 16)).toBeNull();
    expect(computeNextSlot(undefined, undefined)).toBeNull();
  });

  test("respects custom bank/slot counts", () => {
    expect(computeNextSlot(0, 7, { bankCount: 2, slotCount: 8 })).toEqual({
      bank: 1,
      slot: 0,
      wrapped: false,
    });
    expect(computeNextSlot(1, 7, { bankCount: 2, slotCount: 8 })).toEqual({
      bank: 0,
      slot: 0,
      wrapped: true,
    });
  });
});
