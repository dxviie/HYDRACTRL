import { describe, expect, test } from "bun:test";
import { createEventBus } from "./EventBus.js";
import { createPluginHost } from "./PluginHost.js";

function createHost() {
  const events = createEventBus();
  const ctx = { events, notify: () => {} };
  return { host: createPluginHost(ctx), events, ctx };
}

describe("PluginHost", () => {
  test("requires a context object", () => {
    expect(() => createPluginHost()).toThrow(TypeError);
  });

  test("registers and initializes plugins with the shared context", () => {
    const { host, ctx } = createHost();
    let receivedCtx = null;

    host.register({
      id: "p1",
      setup(context) {
        receivedCtx = context;
      },
    });

    expect(host.getStatus("p1")).toBe("registered");
    host.init();
    expect(host.getStatus("p1")).toBe("active");
    expect(receivedCtx).toBe(ctx);
  });

  test("rejects malformed plugins", () => {
    const { host } = createHost();

    expect(host.register(null)).toBe(false);
    expect(host.register({})).toBe(false);
    expect(host.register({ id: "x" })).toBe(false);
    expect(host.register({ id: "", setup() {} })).toBe(false);
  });

  test("rejects duplicate plugin ids", () => {
    const { host } = createHost();
    expect(host.register({ id: "dup", setup() {} })).toBe(true);
    expect(host.register({ id: "dup", setup() {} })).toBe(false);
  });

  test("a plugin that throws during setup is isolated", () => {
    const { host } = createHost();
    let goodPluginRan = false;

    host.register({
      id: "bad",
      setup() {
        throw new Error("setup exploded");
      },
    });
    host.register({
      id: "good",
      setup() {
        goodPluginRan = true;
      },
    });

    expect(() => host.init()).not.toThrow();
    expect(host.getStatus("bad")).toBe("error");
    expect(host.getStatus("good")).toBe("active");
    expect(goodPluginRan).toBe(true);
  });

  test("plugins registered after init are set up immediately", () => {
    const { host } = createHost();
    host.init();

    let ran = false;
    host.register({
      id: "late",
      setup() {
        ran = true;
      },
    });

    expect(ran).toBe(true);
    expect(host.getStatus("late")).toBe("active");
  });

  test("exposes the api returned from setup", () => {
    const { host } = createHost();
    host.register({
      id: "with-api",
      setup() {
        return { api: { hello: () => "world" } };
      },
    });
    host.init();

    expect(host.getApi("with-api").hello()).toBe("world");
    expect(host.getApi("missing")).toBe(null);
  });

  test("unregister calls dispose and removes the plugin", () => {
    const { host } = createHost();
    let disposed = false;
    host.register({
      id: "disposable",
      setup() {
        return {
          dispose() {
            disposed = true;
          },
        };
      },
    });
    host.init();

    expect(host.unregister("disposable")).toBe(true);
    expect(disposed).toBe(true);
    expect(host.getStatus("disposable")).toBe(null);
    expect(host.unregister("disposable")).toBe(false);
  });

  test("setup may return a plain cleanup function", () => {
    const { host } = createHost();
    let disposed = false;
    host.register({
      id: "fn-cleanup",
      setup() {
        return () => {
          disposed = true;
        };
      },
    });
    host.init();
    host.unregister("fn-cleanup");

    expect(disposed).toBe(true);
  });

  test("a throwing dispose does not prevent removal", () => {
    const { host } = createHost();
    host.register({
      id: "bad-dispose",
      setup() {
        return () => {
          throw new Error("dispose exploded");
        };
      },
    });
    host.init();

    expect(() => host.unregister("bad-dispose")).not.toThrow();
    expect(host.getStatus("bad-dispose")).toBe(null);
  });

  test("emits lifecycle events on the bus", () => {
    const { host, events } = createHost();
    const seen = [];
    events.on("plugin:activated", (e) => seen.push(`activated:${e.id}`));
    events.on("plugins:ready", (e) => seen.push(`ready:${e.ids.join(",")}`));
    events.on("plugin:removed", (e) => seen.push(`removed:${e.id}`));

    host.register({ id: "a", setup() {} });
    host.init();
    host.unregister("a");

    expect(seen).toEqual(["activated:a", "ready:a", "removed:a"]);
  });

  test("list reports plugin metadata and status", () => {
    const { host } = createHost();
    host.register({ id: "a", name: "Plugin A", description: "does a", setup() {} });
    host.register({
      id: "b",
      setup() {
        throw new Error("no");
      },
    });
    host.init();

    expect(host.list()).toEqual([
      { id: "a", name: "Plugin A", description: "does a", status: "active" },
      { id: "b", name: "b", description: "", status: "error" },
    ]);
  });
});
