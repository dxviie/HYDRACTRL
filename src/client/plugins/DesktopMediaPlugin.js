/**
 * DesktopMediaPlugin - drop images and videos on the editor (desktop app).
 *
 * Inside the HYDRACTRL desktop app, files dropped on the editor are copied
 * into the media folder, which the app's server serves at /media/, and the
 * editor gets a line that loads each one into a free source:
 *
 *   s1.initVideo("/media/clip.mp4");
 *
 * The line goes where the file was dropped, but never inside a statement: a
 * drop on a chain puts it above the chain. A drop on an empty sketch also
 * adds `src(s0).out()`, so running it shows the file straight away. In a
 * browser there is no desktop bridge: the plugin does nothing, and the
 * editor keeps CodeMirror's own drop handling.
 */

/** hydra's sources in HYDRACTRL (numSources in index.js and output.js) */
export const SOURCE_COUNT = 4;

/** The sources the code already loads something into: s0.initImage(...), s2.initCam()... */
export function usedSources(code) {
  const used = new Set();
  for (const match of String(code).matchAll(/\bs(\d)\s*\.\s*init\w*\s*\(/g)) {
    used.add(Number(match[1]));
  }
  return used;
}

/** The sources the code leaves free, in order. */
export function freeSources(code, total = SOURCE_COUNT) {
  const used = usedSources(code);
  return Array.from({ length: total }, (_, source) => source).filter((source) => !used.has(source));
}

/** Sources for `count` new files: the free ones in order, then s0, s1... again. */
export function pickSources(code, count, total = SOURCE_COUNT) {
  const free = freeSources(code, total);
  return Array.from({ length: count }, (_, i) =>
    i < free.length ? free[i] : (i - free.length) % total,
  );
}

/** The line that loads a media file into a source. */
export function sourceLine(source, kind, url) {
  const method = kind === "video" ? "initVideo" : "initImage";
  return `s${source}.${method}(${JSON.stringify(url)});`;
}

/** The lines a drop adds; `show` adds one that puts the first file on screen. */
export function mediaLines(files, sources, { show = false } = {}) {
  const lines = files.map((file, i) => sourceLine(sources[i], file.kind, file.url));
  if (show && lines.length > 0) lines.push("", `src(s${sources[0]}).out()`);
  return lines;
}

/**
 * The toast after a drop, or null when the new lines say it all. `results`
 * come from the desktop app: { ok, name, status } or { ok: false, name, error }.
 */
export function describeImport(results, { sourcesReused = false } = {}) {
  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    const [first] = failed;
    const more = failed.length > 1 ? ` (and ${failed.length - 1} more)` : "";
    return { type: "error", message: `${first.name} ${first.error}${more}` };
  }
  if (sourcesReused) {
    return {
      type: "info",
      message: `All ${SOURCE_COUNT} sources were in use, so the new lines reuse taken ones`,
    };
  }
  const copied = results.filter((result) => result.status === "copied");
  if (copied.length === 0) return null;
  return {
    type: "success",
    message:
      copied.length === 1
        ? `Copied ${copied[0].name} to the media folder`
        : `Copied ${copied.length} files to the media folder`,
  };
}

function hasFiles(event) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export function createDesktopMediaPlugin(options = {}) {
  return {
    id: "desktop-media",
    name: "Desktop Media",
    description: "Drop images and videos on the editor to load them into sources (desktop app)",

    setup(ctx) {
      const bridge =
        options.bridge !== undefined
          ? options.bridge
          : typeof window !== "undefined"
            ? window.hydractrlDesktop
            : undefined;
      const editor = ctx.editor?._editor;
      if (typeof bridge?.importMedia !== "function" || ctx.isMobile) return;
      if (typeof editor?.handleFileDrops !== "function") return;

      async function addFiles(files, pos) {
        let results;
        try {
          results = await bridge.importMedia(files);
        } catch (error) {
          ctx.notify(error.message || String(error), { type: "error", duration: 6000 });
          return;
        }
        const added = results.filter((result) => result.ok);
        let sourcesReused = false;
        if (added.length > 0) {
          const { setup, main } = editor.getAllCode();
          const code = `${setup}\n${main}`;
          const sources = pickSources(code, added.length);
          sourcesReused = added.length > freeSources(code).length;
          const show = editor.getCurrentTab() === "main" && editor.getCode().trim() === "";
          editor.insertLines(pos, mediaLines(added, sources, { show }));
          editor.focus();
          ctx.events.emit("media:added", {
            files: added.map(({ name, kind, url }, i) => ({ name, kind, url, source: sources[i] })),
          });
        }
        const toast = describeImport(results, { sourcesReused });
        if (toast) {
          ctx.notify(toast.message, {
            type: toast.type,
            duration: toast.type === "success" ? 2500 : 6000,
          });
        }
      }

      const stopDrops = editor.handleFileDrops(({ files, pos }) => {
        if (files.length === 0) return;
        addFiles(files, pos).catch((error) => console.error("[desktop-media] drop failed:", error));
      });

      // Anywhere but the editor a dropped file has nowhere to go: the cursor
      // says so, and the drop never happens
      const onDragOver = (event) => {
        if (event.defaultPrevented || !hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "none";
      };
      document.addEventListener("dragover", onDragOver);

      return {
        dispose() {
          stopDrops();
          document.removeEventListener("dragover", onDragOver);
        },
      };
    },
  };
}
