// A visible mouse pointer for recordings (headless Chromium draws none):
// __cursor.set(x, y), __cursor.press(down), __cursor.hide(). Clicks leave a
// ripple that fades on the page's (virtual) clock.
(() => {
  if (window.__cursor) return;
  const state = { x: -50, y: -50, down: false, shown: false, clicks: [] };
  let root = null;

  function build() {
    root = document.createElement("div");
    root.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none";
    root.innerHTML = `
      <div data-ripples style="position:absolute;left:0;top:0"></div>
      <svg data-arrow width="22" height="30" viewBox="0 0 22 30"
        style="position:absolute;left:0;top:0;overflow:visible;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))">
        <path d="M1.5 1.5 L1.5 23 L7 17.8 L10.8 26.6 L14.4 25 L10.7 16.4 L18 16.4 Z" fill="#fff"
          stroke="#111" stroke-width="1.6" stroke-linejoin="round"/>
      </svg>`;
    document.documentElement.appendChild(root);
  }

  function render() {
    if (!root) return;
    const arrow = root.querySelector("[data-arrow]");
    arrow.style.transform = `translate(${state.x - 1.5}px, ${state.y - 1.5}px) scale(${state.down ? 0.9 : 1})`;
    arrow.style.display = state.shown ? "block" : "none";
    const now = performance.now();
    state.clicks = state.clicks.filter((click) => now - click.at < 450);
    root.querySelector("[data-ripples]").innerHTML = state.clicks
      .map((click) => {
        const t = (now - click.at) / 450;
        const r = 6 + t * 18;
        return `<div style="position:absolute;left:${click.x - r}px;top:${click.y - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;border:2px solid rgba(255,255,255,${0.85 * (1 - t)});background:rgba(255,255,255,${0.18 * (1 - t)})"></div>`;
      })
      .join("");
  }

  function loop() {
    render();
    requestAnimationFrame(loop);
  }

  window.__cursor = {
    set(x, y) {
      if (!root) build();
      state.x = x;
      state.y = y;
      state.shown = true;
      render();
    },
    press(down) {
      if (!root) build();
      state.down = down;
      if (down) state.clicks.push({ x: state.x, y: state.y, at: performance.now() });
      render();
    },
    hide() {
      state.shown = false;
      render();
    },
  };
  requestAnimationFrame(loop);
})();
