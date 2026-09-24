/**
 * Output hub: fan-out between the HYDRACTRL UI (the "controller") and any
 * number of render heads (the "outputs"): the companion output app, an OBS
 * browser source, a TouchDesigner Web Render TOP, another browser window...
 *
 * The hub is transport-agnostic. The server registers each socket with a send
 * function; the hub owns the roles, validates messages, and remembers the last
 * sketch and XY-pad state so an output that connects late is brought up to
 * date immediately. Apart from calling the registered send functions it has
 * no side effects, so it is unit tested without a network.
 *
 * Protocol (JSON text frames):
 *   client -> hub   { type: "hello", role: "controller" | "output" }
 *   controller -> hub { type: "sketch", setup, main }        fan-out to outputs
 *   controller -> hub { type: "state", nanoX?, nanoY? }      fan-out to outputs
 *   output -> hub   { type: "error", message }               fan-out to controllers
 *   hub -> controller { type: "outputs", count }             on every change
 *   hub -> controller { type: "output-error", message, outputId }
 */

export type ClientRole = "controller" | "output";

export interface HelloMessage {
  type: "hello";
  role: ClientRole;
}

export interface SketchMessage {
  type: "sketch";
  setup: string;
  main: string;
}

export interface StateMessage {
  type: "state";
  nanoX?: number;
  nanoY?: number;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type IncomingMessage = HelloMessage | SketchMessage | StateMessage | ErrorMessage;

export interface OutputsMessage {
  type: "outputs";
  count: number;
}

export interface OutputErrorMessage {
  type: "output-error";
  message: string;
  outputId: string;
}

export type OutgoingMessage = SketchMessage | StateMessage | OutputsMessage | OutputErrorMessage;

interface HubClient {
  id: string;
  role: ClientRole | null;
  send: (text: string) => void;
}

/** Upper bound for setup + main code, generous for any sketch, tight enough to stop abuse. */
export const MAX_SKETCH_LENGTH = 1_000_000;
/** Error messages relayed to controllers are truncated to this length. */
export const MAX_ERROR_LENGTH = 2_000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Validate a raw incoming message. Accepts a JSON string or an already-parsed
 * object (Elysia parses JSON frames before handing them over).
 * @returns The typed message, or null when it is malformed or unknown.
 */
export function parseIncomingMessage(raw: unknown): IncomingMessage | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;

  switch (message.type) {
    case "hello":
      if (message.role === "controller" || message.role === "output") {
        return { type: "hello", role: message.role };
      }
      return null;
    case "sketch": {
      const setup = typeof message.setup === "string" ? message.setup : "";
      if (typeof message.main !== "string") return null;
      if (setup.length + message.main.length > MAX_SKETCH_LENGTH) return null;
      return { type: "sketch", setup, main: message.main };
    }
    case "state": {
      const state: StateMessage = { type: "state" };
      if (isFiniteNumber(message.nanoX)) state.nanoX = message.nanoX;
      if (isFiniteNumber(message.nanoY)) state.nanoY = message.nanoY;
      if (state.nanoX === undefined && state.nanoY === undefined) return null;
      return state;
    }
    case "error":
      if (typeof message.message !== "string") return null;
      return { type: "error", message: message.message.slice(0, MAX_ERROR_LENGTH) };
    default:
      return null;
  }
}

export interface OutputHubOptions {
  /** Diagnostic logger; silent by default. */
  log?: (message: string) => void;
}

export function createOutputHub({ log = () => {} }: OutputHubOptions = {}) {
  const clients = new Map<string, HubClient>();
  let lastSketch: SketchMessage | null = null;
  let lastState: StateMessage | null = null;

  function safeSend(client: HubClient, text: string) {
    try {
      client.send(text);
    } catch (error) {
      log(`[output-hub] send to ${client.id} failed: ${String(error)}`);
    }
  }

  function deliver(client: HubClient, message: OutgoingMessage) {
    safeSend(client, JSON.stringify(message));
  }

  function broadcast(role: ClientRole, message: OutgoingMessage) {
    const text = JSON.stringify(message);
    for (const client of clients.values()) {
      if (client.role === role) safeSend(client, text);
    }
  }

  function count(role: ClientRole) {
    let total = 0;
    for (const client of clients.values()) {
      if (client.role === role) total += 1;
    }
    return total;
  }

  function announceOutputs() {
    broadcast("controller", { type: "outputs", count: count("output") });
  }

  /** Register a freshly opened socket. Its role is unknown until it says hello. */
  function connect(id: string, send: (text: string) => void) {
    clients.set(id, { id, role: null, send });
  }

  function disconnect(id: string) {
    const client = clients.get(id);
    if (!client) return;
    clients.delete(id);
    if (client.role === "output") {
      log(`[output-hub] output ${id} disconnected (${count("output")} left)`);
      announceOutputs();
    }
  }

  /**
   * Handle a message from a registered client.
   * @returns true when the message was valid and acted upon.
   */
  function message(id: string, raw: unknown): boolean {
    const client = clients.get(id);
    if (!client) return false;
    const parsed = parseIncomingMessage(raw);
    if (!parsed) return false;

    switch (parsed.type) {
      case "hello":
        client.role = parsed.role;
        if (parsed.role === "output") {
          log(`[output-hub] output ${id} connected`);
          if (lastSketch) deliver(client, lastSketch);
          if (lastState) deliver(client, lastState);
          announceOutputs();
        } else {
          deliver(client, { type: "outputs", count: count("output") });
        }
        return true;
      case "sketch":
        if (client.role !== "controller") return false;
        lastSketch = parsed;
        broadcast("output", parsed);
        return true;
      case "state":
        if (client.role !== "controller") return false;
        lastState = { ...(lastState ?? { type: "state" }), ...parsed };
        broadcast("output", parsed);
        return true;
      case "error":
        if (client.role !== "output") return false;
        broadcast("controller", { type: "output-error", message: parsed.message, outputId: id });
        return true;
      default:
        return false;
    }
  }

  return {
    connect,
    disconnect,
    message,
    outputCount: () => count("output"),
    controllerCount: () => count("controller"),
    getLastSketch: () => lastSketch,
    getLastState: () => lastState,
  };
}

export type OutputHub = ReturnType<typeof createOutputHub>;
