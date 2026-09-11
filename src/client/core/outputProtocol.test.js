import { describe, expect, test } from "bun:test";
import { buildOutputSocketUrl, detectOutputServer, parseSocketMessage } from "./outputProtocol.js";

describe("buildOutputSocketUrl", () => {
  test("uses ws for http origins", () => {
    expect(buildOutputSocketUrl({ protocol: "http:", host: "localhost:3000" })).toBe(
      "ws://localhost:3000/ws/output",
    );
  });

  test("uses wss for https origins", () => {
    expect(buildOutputSocketUrl({ protocol: "https:", host: "hydractrl.example" })).toBe(
      "wss://hydractrl.example/ws/output",
    );
  });
});

describe("parseSocketMessage", () => {
  test("returns typed messages", () => {
    expect(parseSocketMessage('{"type":"state","nanoX":0.5}')).toEqual({
      type: "state",
      nanoX: 0.5,
    });
  });

  test("returns null for binary frames, garbage and untyped objects", () => {
    expect(parseSocketMessage(new ArrayBuffer(4))).toBe(null);
    expect(parseSocketMessage("nope")).toBe(null);
    expect(parseSocketMessage('{"nanoX":1}')).toBe(null);
    expect(parseSocketMessage("null")).toBe(null);
  });
});

function fakeFetch({ ok = true, contentType = "application/json", body = { outputSync: true } }) {
  return async () => ({
    ok,
    headers: { get: () => contentType },
    json: async () => body,
  });
}

describe("detectOutputServer", () => {
  test("is true when the server answers with JSON capabilities", async () => {
    expect(await detectOutputServer(fakeFetch({}))).toBe(true);
  });

  test("is false on a static host that rewrites to index.html", async () => {
    expect(await detectOutputServer(fakeFetch({ contentType: "text/html" }))).toBe(false);
  });

  test("is false on errors, non-ok responses and missing flags", async () => {
    expect(await detectOutputServer(fakeFetch({ ok: false }))).toBe(false);
    expect(await detectOutputServer(fakeFetch({ body: { outputSync: false } }))).toBe(false);
    expect(
      await detectOutputServer(async () => {
        throw new Error("offline");
      }),
    ).toBe(false);
  });
});
