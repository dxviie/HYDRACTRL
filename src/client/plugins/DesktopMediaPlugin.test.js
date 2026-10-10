import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createDesktopMediaPlugin,
  describeImport,
  freeSources,
  mediaLines,
  pickSources,
  sourceLine,
  usedSources,
} from "./DesktopMediaPlugin.js";

describe("sources", () => {
  test("usedSources finds the sources a sketch loads into", () => {
    const code = 's0.initImage("/a.png")\ns2 . initCam()\nsrc(s1).out()\ns3.initVideo(url)';
    expect([...usedSources(code)].sort()).toEqual([0, 2, 3]);
    expect(usedSources("osc().out()").size).toBe(0);
  });

  test("pickSources takes the free sources first, then starts over", () => {
    expect(pickSources("", 2)).toEqual([0, 1]);
    const code = 's0.initImage("/a.png")\ns2.initCam()';
    expect(freeSources(code)).toEqual([1, 3]);
    expect(pickSources(code, 3)).toEqual([1, 3, 0]);
    const full = "s0.initCam(); s1.initCam(); s2.initCam(); s3.initCam()";
    expect(pickSources(full, 2)).toEqual([0, 1]);
  });
});

describe("lines", () => {
  test("sourceLine loads images and videos", () => {
    expect(sourceLine(0, "image", "/media/photo.png")).toBe('s0.initImage("/media/photo.png");');
    expect(sourceLine(3, "video", "/media/My Clip.mp4")).toBe(
      's3.initVideo("/media/My Clip.mp4");',
    );
    expect(sourceLine(1, "image", '/media/say "hi".png')).toBe(
      's1.initImage("/media/say \\"hi\\".png");',
    );
  });

  test("mediaLines can put the first file on screen", () => {
    const files = [
      { kind: "video", url: "/media/a.mp4" },
      { kind: "image", url: "/media/b.png" },
    ];
    expect(mediaLines(files, [1, 2])).toEqual([
      's1.initVideo("/media/a.mp4");',
      's2.initImage("/media/b.png");',
    ]);
    expect(mediaLines(files, [1, 2], { show: true }).slice(2)).toEqual(["", "src(s1).out()"]);
  });
});

describe("describeImport", () => {
  const copied = (name) => ({ ok: true, name, status: "copied" });

  test("reports what was copied", () => {
    expect(describeImport([copied("clip.mp4")])).toEqual({
      type: "success",
      message: "Copied clip.mp4 to the media folder",
    });
    expect(describeImport([copied("a.png"), copied("b.png")]).message).toBe(
      "Copied 2 files to the media folder",
    );
  });

  test("says nothing when the files were already there", () => {
    const results = [
      { ok: true, name: "a.png", status: "existing" },
      { ok: true, name: "b.png", status: "in-folder" },
    ];
    expect(describeImport(results)).toBeNull();
  });

  test("puts problems first", () => {
    const failed = { ok: false, name: "notes.pdf", error: "is not an image or video" };
    expect(describeImport([copied("a.png"), failed])).toEqual({
      type: "error",
      message: "notes.pdf is not an image or video",
    });
    expect(describeImport([failed, failed, failed]).message).toBe(
      "notes.pdf is not an image or video (and 2 more)",
    );
    expect(describeImport([copied("a.png")], { sourcesReused: true }).type).toBe("info");
  });
});

describe("createDesktopMediaPlugin", () => {
  let listeners;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    listeners = new Map();
    globalThis.document = {
      addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: (type) => listeners.delete(type),
    };
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  function setup({ main = "osc().out()", setupCode = "", importMedia } = {}) {
    let dropHandler = null;
    const inserted = [];
    const toasts = [];
    const events = [];
    const state = { stopped: false, focused: false };
    const editor = {
      handleFileDrops: (handler) => {
        dropHandler = handler;
        return () => {
          state.stopped = true;
        };
      },
      getAllCode: () => ({ setup: setupCode, main }),
      getCurrentTab: () => "main",
      getCode: () => main,
      insertLines: (pos, lines) => inserted.push({ pos, lines }),
      focus: () => {
        state.focused = true;
      },
    };
    const plugin = createDesktopMediaPlugin({ bridge: { importMedia } });
    const result = plugin.setup({
      editor: { _editor: editor },
      isMobile: false,
      notify: (message, options) => toasts.push({ message, ...options }),
      events: { emit: (name, payload) => events.push([name, payload]) },
    });
    const drop = async (files, pos) => {
      dropHandler({ files, pos });
      await new Promise((resolve) => setTimeout(resolve, 0));
    };
    return { result, drop, inserted, toasts, events, state };
  }

  test("does nothing outside the desktop app or on a phone", () => {
    const editor = { handleFileDrops: () => () => {} };
    expect(
      createDesktopMediaPlugin({ bridge: null }).setup({ editor: { _editor: editor } }),
    ).toBeUndefined();
    expect(
      createDesktopMediaPlugin({ bridge: {} }).setup({ editor: { _editor: editor } }),
    ).toBeUndefined();
    const bridge = { importMedia: async () => [] };
    expect(
      createDesktopMediaPlugin({ bridge }).setup({ editor: { _editor: editor }, isMobile: true }),
    ).toBeUndefined();
  });

  test("adds a line per dropped file into the free sources", async () => {
    const files = [{ name: "clip.mp4" }, { name: "photo.png" }];
    const { drop, inserted, toasts, events, state } = setup({
      main: 's0.initImage("/assets/logo.png")\nsrc(s0).out()',
      importMedia: async (dropped) => {
        expect(dropped).toBe(files);
        return [
          { ok: true, name: "clip.mp4", kind: "video", url: "/media/clip.mp4", status: "copied" },
          { ok: true, name: "photo.png", kind: "image", url: "/media/photo.png", status: "copied" },
        ];
      },
    });
    await drop(files, 42);
    expect(inserted).toEqual([
      {
        pos: 42,
        lines: ['s1.initVideo("/media/clip.mp4");', 's2.initImage("/media/photo.png");'],
      },
    ]);
    expect(state.focused).toBe(true);
    expect(toasts).toEqual([
      { message: "Copied 2 files to the media folder", type: "success", duration: 2500 },
    ]);
    expect(events[0][0]).toBe("media:added");
    expect(events[0][1].files.map((file) => file.source)).toEqual([1, 2]);
  });

  test("shows the file on an empty sketch", async () => {
    const { drop, inserted } = setup({
      main: "  \n",
      importMedia: async () => [
        { ok: true, name: "a.png", kind: "image", url: "/media/a.png", status: "in-folder" },
      ],
    });
    await drop([{ name: "a.png" }], 0);
    expect(inserted[0].lines).toEqual(['s0.initImage("/media/a.png");', "", "src(s0).out()"]);
  });

  test("reports files it couldn't use and a refused import", async () => {
    const partial = setup({
      importMedia: async () => [
        { ok: true, name: "a.png", kind: "image", url: "/media/a.png", status: "copied" },
        { ok: false, name: "notes.pdf", error: "is not an image or video HYDRACTRL can play" },
      ],
    });
    await partial.drop([{}, {}], 0);
    expect(partial.inserted[0].lines).toEqual(['s0.initImage("/media/a.png");']);
    expect(partial.toasts[0]).toMatchObject({
      type: "error",
      message: "notes.pdf is not an image or video HYDRACTRL can play",
    });

    const refused = setup({
      importMedia: async () => {
        throw new Error("HYDRACTRL is using a server that was started outside the app");
      },
    });
    await refused.drop([{}], 0);
    expect(refused.inserted).toEqual([]);
    expect(refused.toasts[0].type).toBe("error");
  });

  test("refuses drops outside the editor, and cleans up", () => {
    const { result, state } = setup({ importMedia: async () => [] });
    const onDragOver = listeners.get("dragover");
    const event = (defaultPrevented) => ({
      defaultPrevented,
      dataTransfer: { types: ["Files"], dropEffect: "copy" },
      preventDefault() {
        this.defaultPrevented = true;
      },
    });
    const outside = event(false);
    onDragOver(outside);
    expect(outside.defaultPrevented).toBe(true);
    expect(outside.dataTransfer.dropEffect).toBe("none");
    // The editor took it already
    const inside = event(true);
    onDragOver(inside);
    expect(inside.dataTransfer.dropEffect).toBe("copy");

    result.dispose();
    expect(state.stopped).toBe(true);
    expect(listeners.has("dragover")).toBe(false);
  });
});
