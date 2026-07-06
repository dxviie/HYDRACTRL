/**
 * SlotAdvancePlugin - "move to next slot on save".
 *
 * When enabled (checkbox in the stats panel), saving a scene advances the
 * active slot so consecutive saves fill the banks in order, wrapping from the
 * last slot of a bank to the first slot of the next.
 *
 * Exposes `window.moveToNextSlotOnSave` / `window.moveToNextSlot` because the
 * core save handlers (save button, Ctrl/⌘+S) call them.
 */

const STORAGE_KEY = "hydractrl-move-to-next-slot";
const BANK_COUNT = 4;
const SLOT_COUNT = 16;

/**
 * Pure helper: compute the slot that follows (bank, slot).
 * @returns {{bank: number, slot: number, wrapped: boolean}|null}
 *   `wrapped` is true when advancing would wrap past the last bank back to
 *   the first (i.e. all banks are full). Returns null for invalid input.
 */
export function computeNextSlot(bank, slot, options = {}) {
  const bankCount = options.bankCount ?? BANK_COUNT;
  const slotCount = options.slotCount ?? SLOT_COUNT;
  const currentBank = Number(bank);
  const currentSlot = Number(slot);

  if (
    Number.isNaN(currentBank) ||
    Number.isNaN(currentSlot) ||
    currentBank < 0 ||
    currentBank >= bankCount ||
    currentSlot < 0 ||
    currentSlot >= slotCount
  ) {
    return null;
  }

  const nextSlot = (currentSlot + 1) % slotCount;
  let nextBank = currentBank;
  if (nextSlot === 0) {
    nextBank = (currentBank + 1) % bankCount;
  }

  return { bank: nextBank, slot: nextSlot, wrapped: nextBank < currentBank };
}

export function createSlotAdvancePlugin() {
  return {
    id: "slot-advance",
    name: "Slot Advance on Save",
    description: "Moves to the next slot after saving, so saves fill banks in order",

    setup(ctx) {
      let enabled = ctx.storage.get(STORAGE_KEY) === "true";
      window.moveToNextSlotOnSave = enabled;
      let advanceTimer = null;

      // Wire the stats panel checkbox (desktop only — absent on mobile)
      const checkbox = ctx.getPanels().stats?.slots?.moveToNextSlotCheckbox;
      const onCheckboxChange = (e) => {
        enabled = e.target.checked;
        window.moveToNextSlotOnSave = enabled;
        ctx.storage.set(STORAGE_KEY, enabled);
      };
      if (checkbox) {
        checkbox.checked = enabled;
        checkbox.addEventListener("change", onCheckboxChange);
      }

      function moveToNextSlot(savedSlotInfo) {
        const slots = ctx.getPanels().slots;
        if (!slots || !window.moveToNextSlotOnSave) return false;

        // Fall back to the current slot when the save handler couldn't tell
        // us where it saved
        let info = savedSlotInfo;
        if (
          !info ||
          typeof info !== "object" ||
          info.bank === undefined ||
          info.slot === undefined
        ) {
          info = { bank: slots.getBank(), slot: slots.getActiveSlotIndex() };
        }

        const next = computeNextSlot(info.bank, info.slot);
        if (!next) {
          console.error("SlotAdvancePlugin: invalid slot info:", info);
          return false;
        }

        if (next.wrapped) {
          // We're going back to bank 0 from the last bank: don't advance
          ctx.notify("All banks full! Can't advance further.", { type: "error", duration: 1500 });
          return false;
        }

        const currentBank = Number(info.bank);

        // Wait for any async operations (thumbnail capture) to complete
        // before changing slots
        advanceTimer = setTimeout(() => {
          try {
            if (next.bank !== currentBank) {
              slots.switchBank(next.bank);
              // Flash the bank dot for visual feedback
              if (slots.flashActiveBankDot) {
                slots.flashActiveBankDot(next.bank);
              }
            }
            slots.setActiveSlot(next.slot);
            ctx.events.emit("slots:advanced", { bank: next.bank, slot: next.slot });
          } catch (error) {
            console.error("SlotAdvancePlugin: error moving to next slot:", error);
          }
        }, 500);

        return true;
      }

      window.moveToNextSlot = moveToNextSlot;

      return {
        api: { moveToNextSlot, isEnabled: () => enabled },
        dispose() {
          clearTimeout(advanceTimer);
          if (checkbox) checkbox.removeEventListener("change", onCheckboxChange);
          if (window.moveToNextSlot === moveToNextSlot) {
            window.moveToNextSlot = undefined;
            window.moveToNextSlotOnSave = false;
          }
        },
      };
    },
  };
}
