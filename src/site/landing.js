/**
 * Landing page (public/index.html) behaviour. The page works without it:
 * this adds the hydra backdrop and the editable code panel over it,
 * highlights the download for the visitor's computer, fills in the latest
 * release, and lazy-loads the feature videos and the contact form.
 */
import { encodeSketch } from "../client/plugins/UrlSharePlugin.js";
import { RELEASES_URL } from "../project.js";
import { SKETCHES, sketchSource } from "../sketches.js";
import { createBackground } from "./background.js";
import {
  DOWNLOADS,
  LATEST_RELEASE_API,
  formatDate,
  formatSize,
  recommendedDownload,
  summarizeRelease,
} from "./downloads.js";
import { createCodePanel, fileName } from "./editor.js";
import { detectArchitecture, detectPlatform } from "./platform.js";

const BACKDROP_KEY = "hydractrl-site-backdrop";
const RELEASE_CACHE_KEY = "hydractrl-site-release";
const RELEASE_CACHE_MS = 10 * 60 * 1000;
const PLATFORM_NAMES = { mac: "macOS", windows: "Windows" };

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function storageGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function storageSet(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch (_error) {
    // Private mode or storage disabled: the preference just won't stick
  }
}

// ── Downloads ──────────────────────────────────────────────────────────────

async function fetchLatestRelease() {
  const cached = JSON.parse(storageGet(sessionStorage, RELEASE_CACHE_KEY) || "null");
  if (cached && Date.now() - cached.at < RELEASE_CACHE_MS) return cached.value;

  const response = await fetch(LATEST_RELEASE_API, {
    headers: { Accept: "application/vnd.github+json" },
  });
  let value;
  if (response.status === 404) value = { status: "none" };
  else if (response.ok) value = { status: "ok", summary: summarizeRelease(await response.json()) };
  else throw new Error(`GitHub answered ${response.status}`);
  storageSet(sessionStorage, RELEASE_CACHE_KEY, JSON.stringify({ at: Date.now(), value }));
  return value;
}

function renderRelease(result) {
  const info = document.getElementById("release-info");
  if (!info) return;

  if (result.status === "none") {
    info.innerHTML = `The first desktop release is on its way. Until it lands, use the browser
      version or <a href="https://github.com/dxviie/HYDRACTRL/blob/main/desktop/README.md#develop">build
      the app yourself</a>.`;
    for (const link of document.querySelectorAll("[data-download]")) {
      link.classList.add("is-pending");
      link.href = RELEASES_URL;
    }
    return;
  }

  const { summary } = result;
  if (!summary) return;
  const date = formatDate(summary.publishedAt);
  info.innerHTML = "";
  info.append(`Version ${summary.version}${date ? ` · ${date}` : ""} · `);
  const notes = document.createElement("a");
  notes.href = summary.url;
  notes.textContent = "What's new";
  info.append(notes);

  for (const download of summary.downloads) {
    const link = document.querySelector(`[data-download="${download.id}"]`);
    if (!link) continue;
    link.href = download.url;
    link.classList.toggle("is-pending", !download.available);
    const meta = link.querySelector("[data-download-meta]");
    const spec = DOWNLOADS.find((item) => item.id === download.id);
    if (meta && spec) {
      meta.textContent = [spec.format, formatSize(download.size)].filter(Boolean).join(" · ");
    }
  }
}

async function initDownloads() {
  const platform = detectPlatform(navigator);
  if (platform.os === "mac") platform.arch = await detectArchitecture(navigator);

  const recommended = recommendedDownload(platform);
  if (recommended) {
    document.querySelector(`[data-download="${recommended}"]`)?.classList.add("is-recommended");
  }
  const name = PLATFORM_NAMES[platform.os];
  if (name) {
    for (const cta of document.querySelectorAll("[data-platform-cta]")) {
      // The label sits in its own span when the link also holds an arrow
      const label = cta.querySelector("[data-platform-label]") || cta;
      label.textContent = `Download for ${name}`;
    }
  }
  document.documentElement.dataset.platform = platform.os;

  try {
    renderRelease(await fetchLatestRelease());
  } catch (error) {
    // Rate limited or offline: the static links to the latest release still work
    console.warn("[landing] could not load the latest release:", error);
  }
}

// ── Hydra backdrop and the code panel ──────────────────────────────────────

const CODE_LABEL = "hydra code for the background; press Ctrl or Command and Enter to run it";
const NO_WEBGL = "// the visuals need WebGL, which this browser doesn't offer";

function initBackdrop() {
  const canvas = document.getElementById("backdrop");
  const controls = document.getElementById("now-playing");
  if (!canvas || !controls) return;
  const panelRoot = document.querySelector("[data-code]");
  const toggle = controls.querySelector("[data-backdrop-toggle]");
  const name = controls.querySelector("[data-backdrop-name]");
  const position = controls.querySelector("[data-backdrop-index]");
  const total = controls.querySelector("[data-backdrop-count]");
  const modified = controls.querySelector("[data-backdrop-modified]");
  const open = controls.querySelector("[data-backdrop-open]");

  let running = false;
  let background = null;

  // The open link always carries what is in the editor, edits included
  const openWith = (code) => {
    open.href = `/app#sketch=${encodeSketch(`${code}\n`)}`;
  };

  const first = SKETCHES[0];
  const panel = panelRoot
    ? createCodePanel({
        root: panelRoot,
        code: sketchSource(first).trimEnd(),
        name: fileName(first),
        label: CODE_LABEL,
        motion: () => !reducedMotion.matches,
        onHold: () => background.hold(),
        onRelease: () => background.resume(),
        onRun: (code) => background.perform(code),
        onReset: () => background.resume(),
        onChange({ code, playing }) {
          openWith(code);
          if (modified) modified.hidden = !playing;
        },
      })
    : null;

  background = createBackground({
    canvas,
    sketches: SKETCHES,
    loadHydra: () => import("hydra-synth").then((module) => module.default || module),
    onSketch(sketch, index, count) {
      const code = sketchSource(sketch).trimEnd();
      name.textContent = fileName(sketch);
      if (position) position.textContent = String(index + 1);
      if (total) total.textContent = String(count);
      panel?.load(code, fileName(sketch));
      openWith(panel ? panel.code : code);
    },
    onReady() {
      canvas.classList.add("is-ready");
      panel?.enable();
    },
    onError(error) {
      console.warn("[landing] backdrop unavailable:", error);
      canvas.classList.remove("is-ready");
      controls.hidden = true;
      panel?.disable(NO_WEBGL);
    },
    onCodeError(error) {
      panel?.fail(error);
    },
  });

  function syncToggle() {
    const playing = background.isPlaying();
    toggle.setAttribute("aria-pressed", String(!playing));
    // The visible mode (LIVE or PAUSED) starts the name, for voice control
    toggle.setAttribute(
      "aria-label",
      playing ? "Live, pause the background" : "Paused, play the background",
    );
    toggle.dataset.state = playing ? "playing" : "paused";
  }

  function wantsMotion() {
    const choice = storageGet(localStorage, BACKDROP_KEY);
    if (choice === "paused") return false;
    if (choice === "playing") return true;
    return !reducedMotion.matches;
  }

  /** Play when the visitor wants motion; rest otherwise. */
  function sync() {
    if (!running) return;
    if (wantsMotion()) background.play();
    else background.pause();
    syncToggle();
  }

  toggle.addEventListener("click", () => {
    storageSet(localStorage, BACKDROP_KEY, background.isPlaying() ? "paused" : "playing");
    sync();
  });

  reducedMotion.addEventListener?.("change", () => {
    if (storageGet(localStorage, BACKDROP_KEY)) return;
    sync();
  });

  const start = async () => {
    if (!(await background.start())) return;
    running = true;
    controls.hidden = false;
    sync();
  };
  // Let the page render and settle before spinning up WebGL
  if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 1200 });
  else setTimeout(start, 200);
}

// ── Top bar ────────────────────────────────────────────────────────────────

/**
 * Transparent while only the visuals are under it; frosted glass once the hero's
 * words (marked with data-edge) have scrolled up to it.
 */
function initTopbar() {
  const bar = document.querySelector("[data-top]");
  if (!bar) return;
  const edges = document.querySelectorAll("[data-edge]");
  if (edges.length === 0 || !("IntersectionObserver" in window)) {
    bar.classList.add("is-solid");
    return;
  }
  const height = bar.offsetHeight;
  const passed = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const above = !entry.isIntersecting && entry.boundingClientRect.top < height;
        if (above) passed.add(entry.target);
        else passed.delete(entry.target);
      }
      bar.classList.toggle("is-solid", passed.size > 0);
    },
    { rootMargin: `-${height}px 0px 0px 0px` },
  );
  for (const edge of edges) observer.observe(edge);
}

// ── Feature videos and the contact form ────────────────────────────────────

function whenNear(element, callback, rootMargin = "600px 0px") {
  if (!("IntersectionObserver" in window)) {
    callback();
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        callback();
      }
    },
    { rootMargin },
  );
  observer.observe(element);
}

function initVideos() {
  const videos = [...document.querySelectorAll("video[data-autoplay]")];
  if (videos.length === 0) return;
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    for (const video of videos) {
      video.controls = true;
      video.preload = "metadata";
    }
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) entry.target.play().catch(() => {});
        else entry.target.pause();
      }
    },
    { rootMargin: "120px 0px", threshold: 0.2 },
  );
  for (const video of videos) observer.observe(video);
}

function initContactForm() {
  const form = document.querySelector("iframe[data-tally-src]");
  if (!form) return;
  whenNear(form, () => {
    const show = () => {
      if (window.Tally) window.Tally.loadEmbeds();
      else if (!form.src) form.src = form.dataset.tallySrc;
    };
    const script = document.createElement("script");
    script.src = "https://tally.so/widgets/embed.js";
    script.onload = show;
    script.onerror = show;
    document.body.appendChild(script);
  });
}

initDownloads();
initTopbar();
initBackdrop();
initVideos();
initContactForm();
