// A flat drawing of a nanoPAD2-style controller, wired to the fake MIDI device
// (midi.js). __installNanoPad({ left, top, width }) draws it; then
// __pad.hit(index, on) lights a pad and sends its note, and __pad.touch(x, y)
// or __pad.touch(null) drives the X-Y touchpad (CC 1 and 2, CC 16 for touch).
window.__installNanoPad = ({ left, top, width }) => {
  // The nanoPAD2's default notes, as the interface maps them to slots 1-8 and 9-16
  const TOP_ROW = [37, 39, 41, 43, 45, 47, 49, 51];
  const BOTTOM_ROW = [36, 38, 40, 42, 44, 46, 48, 50];
  const height = Math.round(width * 0.27);
  const padGap = width * 0.012;
  const padArea = width * 0.66;
  const padSize = (padArea - padGap * 7) / 8;
  const touchWidth = width * 0.23;
  const touchHeight = height * 0.72;
  const padTop = (height - (padSize * 2 + padGap)) / 2;
  const IDLE = "linear-gradient(180deg,#3a3a44,#2c2c34)";
  const IDLE_SHADOW = "inset 0 1px 0 rgba(255,255,255,.07),0 2px 0 rgba(0,0,0,.5)";

  const root = document.createElement("div");
  root.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${width}px;height:${height}px;
    z-index:2147483000;pointer-events:none;border-radius:14px;font-family:system-ui,sans-serif;
    background:linear-gradient(180deg,#26262d,#16161b);border:1px solid rgba(255,255,255,.07);
    box-shadow:0 18px 40px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.08)`;
  root.innerHTML = `
    <div style="position:absolute;left:${width * 0.035}px;top:${height * 0.09}px;color:#8d8a99;
      font-size:${width * 0.018}px;letter-spacing:.12em;font-weight:600">nanoPAD2</div>
    <div data-touch style="position:absolute;left:${width * 0.035}px;top:${height - touchHeight - height * 0.1}px;
      width:${touchWidth}px;height:${touchHeight}px;border-radius:8px;overflow:hidden;
      box-shadow:inset 0 1px 3px rgba(0,0,0,.8);background:
        repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 12px),
        repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 12px),#0e0e12">
      <div data-finger style="position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;
        display:none;background:radial-gradient(circle,rgba(12,245,144,.95),rgba(12,245,144,.25) 60%,transparent 70%)"></div>
    </div>
    <div data-pads style="position:absolute;right:${width * 0.035}px;top:${padTop}px;width:${padArea}px;
      display:grid;grid-template-columns:repeat(8,1fr);gap:${padGap}px"></div>`;
  const pads = root.querySelector("[data-pads]");
  for (let i = 0; i < 16; i++) {
    const pad = document.createElement("div");
    pad.style.cssText = `height:${padSize}px;border-radius:7px;background:${IDLE};box-shadow:${IDLE_SHADOW}`;
    pads.appendChild(pad);
  }
  document.documentElement.appendChild(root);
  const touch = root.querySelector("[data-touch]");
  const finger = root.querySelector("[data-finger]");

  window.__pad = {
    hit(index, on) {
      const pad = pads.children[index];
      const note = index < 8 ? TOP_ROW[index] : BOTTOM_ROW[index - 8];
      pad.style.background = on ? "linear-gradient(180deg,#5dffc0,#0cf590)" : IDLE;
      pad.style.boxShadow = on
        ? "0 0 22px rgba(12,245,144,.75),inset 0 1px 0 rgba(255,255,255,.4)"
        : IDLE_SHADOW;
      window.__midi.send(on ? [0x90, note, 100] : [0x80, note, 0]);
    },
    touch(x, y) {
      if (x === null) {
        finger.style.display = "none";
        window.__midi.send([0xb0, 16, 0]);
        return;
      }
      finger.style.display = "block";
      finger.style.left = `${x * touch.clientWidth}px`;
      finger.style.top = `${(1 - y) * touch.clientHeight}px`;
      window.__midi.send([0xb0, 16, 127]);
      window.__midi.send([0xb0, 1, Math.round(x * 127)]);
      window.__midi.send([0xb0, 2, Math.round(y * 127)]);
    },
  };
  return { height };
};
