/**
 * Landing page (public/index.html) behaviour. The page works without it:
 * this only adds the hydra backdrop, highlights the download for the
 * visitor's computer, fills in the latest release, and lazy-loads the
 * feature videos and the contact form.
 */
import { encodeSketch } from "../client/plugins/UrlSharePlugin.js";
import { RELEASES_URL } from "../project.js";
import { createBackground } from "./background.js";
import {
  DOWNLOADS,
  LATEST_RELEASE_API,
  formatDate,
  formatSize,
  recommendedDownload,
  summarizeRelease,
} from "./downloads.js";
import { detectArchitecture, detectPlatform } from "./platform.js";
import { SKETCHES, shareCode } from "./sketches.js";

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
      cta.textContent = `Download for ${name}`;
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

// ── Hydra backdrop ─────────────────────────────────────────────────────────

function initBackdrop() {
  const canvas = document.getElementById("backdrop");
  const controls = document.getElementById("now-playing");
  if (!canvas || !controls) return;
  const toggle = controls.querySelector("[data-backdrop-toggle]");
  const name = controls.querySelector("[data-backdrop-name]");
  const open = controls.querySelector("[data-backdrop-open]");

  const background = createBackground({
    canvas,
    sketches: SKETCHES,
    loadHydra: () => import("hydra-synth").then((module) => module.default || module),
    onSketch(sketch) {
      name.textContent = sketch.name;
      open.href = `/app#sketch=${encodeSketch(shareCode(sketch))}`;
    },
    onReady() {
      canvas.classList.add("is-ready");
    },
    onError(error) {
      console.warn("[landing] backdrop unavailable:", error);
      canvas.classList.remove("is-ready");
      controls.hidden = true;
    },
  });

  function syncToggle() {
    const playing = background.isPlaying();
    toggle.setAttribute("aria-pressed", String(!playing));
    toggle.setAttribute("aria-label", playing ? "Pause the background" : "Play the background");
    toggle.dataset.state = playing ? "playing" : "paused";
  }

  function wantsMotion() {
    const choice = storageGet(localStorage, BACKDROP_KEY);
    if (choice === "paused") return false;
    if (choice === "playing") return true;
    return !reducedMotion.matches;
  }

  toggle.addEventListener("click", () => {
    if (background.isPlaying()) {
      background.pause();
      storageSet(localStorage, BACKDROP_KEY, "paused");
    } else {
      background.play();
      storageSet(localStorage, BACKDROP_KEY, "playing");
    }
    syncToggle();
  });

  reducedMotion.addEventListener?.("change", () => {
    if (storageGet(localStorage, BACKDROP_KEY)) return;
    if (reducedMotion.matches) background.pause();
    else background.play();
    syncToggle();
  });

  const start = async () => {
    if (!(await background.start())) return;
    controls.hidden = false;
    if (wantsMotion()) background.play();
    syncToggle();
  };
  // Let the page render and settle before spinning up WebGL
  if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 1200 });
  else setTimeout(start, 200);
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
initBackdrop();
initVideos();
initContactForm();
