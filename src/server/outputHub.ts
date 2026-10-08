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
 *   client -> hub   { type: "hello", role: "controller" | "output", primary? }
 *   controller -> hub { type: "sketch", setup, main, runId? } fan-out to outputs
 *   controller -> hub { type: "state", nanoX?, nanoY? }      fan-out to outputs
 *   controller -> hub { type: "run", id, setup, main }       to primary outputs only
 *   output -> hub   { type: "result", id, success, message? } to the controller that asked
 *   output -> hub   { type: "error", message }               fan-out to controllers
 *   hub -> controller { type: "outputs", count, primaries }  on every change
 *   hub -> controller { type: "output-error", message, outputId }
 *   hub -> controller { type: "result", id, success: false, message, reason: "no-output" }
 *
 * A primary output is the desktop app's own output (`/output?primary`), which
 * the interface shows instead of rendering every sketch itself. The
 * interface sends it each sketch as a `run` and waits for the `result`; only a
 * sketch that worked then goes out to every output as a `sketch`, tagged with
 * the run's id so the primary output doesn't run it twice. `primaries`
 * counts the primary outputs that have a sketch to show. A `run` with no
 * primary output to take it, or whose primary output goes away, is answered
 * at once with reason "no-output", so the interface never waits in vain.
 */

export type ClientRole = "controller" | "output";

export interface HelloMessage {
  type: "hello";
  role: ClientRole;
  /** An output that runs the interface's sketches itself (the desktop app's own). */
  primary?: boolean;
}

export interface SketchMessage {
  type: "sketch";
  setup: string;
  main: string;
  /** The run that produced this sketch, when a primary output ran it first. */
  runId?: string;
}

export interface RunMessage {
  type: "run";
  id: string;
  setup: string;
  main: string;
}

export interface ResultMessage {
  type: "result";
  id: string;
  success: boolean;
  message?: string;
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

export type IncomingMessage =
  | HelloMessage
  | SketchMessage
  | StateMessage
  | RunMessage
  | ResultMessage
  | ErrorMessage;

export interface OutputsMessage {
  type: "outputs";
  count: number;
  /** Primary outputs that have a sketch to show. */
  primaries: number;
}

export interface NoOutputResultMessage extends ResultMessage {
  success: false;
  reason: "no-output";
}

export interface OutputErrorMessage {
  type: "output-error";
  message: string;
  outputId: string;
}

export type OutgoingMessage =
  | SketchMessage
  | StateMessage
  | RunMessage
  | ResultMessage
  | NoOutputResultMessage
  | OutputsMessage
  | OutputErrorMessage;

interface HubClient {
  id: string;
  role: ClientRole | null;
  primary: boolean;
  /** A primary output that was sent a sketch to show. */
  hasSketch: boolean;
  send: (text: string) => void;
}

/** Upper bound for setup + main code, generous for any sketch, tight enough to stop abuse. */
export const MAX_SKETCH_LENGTH = 1_000_000;
/** Error messages relayed to controllers are truncated to this length. */
export const MAX_ERROR_LENGTH = 2_000;
/** Upper bound for run ids. */
export const MAX_RUN_ID_LENGTH = 64;
/** Runs waiting for a result; the oldest is forgotten beyond this. */
export const MAX_PENDING_RUNS = 256;
/** What a run with no primary output to take it is answered with. */
export const NO_OUTPUT_MESSAGE = "The output isn't connected";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRunId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_RUN_ID_LENGTH;
}

/** The setup and main code of a sketch or run, or null when malformed or too long. */
function parseCode(message: Record<string, unknown>): { setup: string; main: string } | null {
  const setup = typeof message.setup === "string" ? message.setup : "";
  if (typeof message.main !== "string") return null;
  if (setup.length + message.main.length > MAX_SKETCH_LENGTH) return null;
  return { setup, main: message.main };
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
      if (message.role === "output" && message.primary === true) {
        return { type: "hello", role: "output", primary: true };
      }
      if (message.role === "controller" || message.role === "output") {
        return { type: "hello", role: message.role };
      }
      return null;
    case "sketch": {
      const code = parseCode(message);
      if (!code) return null;
      const sketch: SketchMessage = { type: "sketch", ...code };
      if (isRunId(message.runId)) sketch.runId = message.runId;
      return sketch;
    }
    case "run": {
      const code = parseCode(message);
      if (!code || !isRunId(message.id)) return null;
      return { type: "run", id: message.id, ...code };
    }
    case "result": {
      if (!isRunId(message.id) || typeof message.success !== "boolean") return null;
      const result: ResultMessage = { type: "result", id: message.id, success: message.success };
      if (typeof message.message === "string") {
        result.message = message.message.slice(0, MAX_ERROR_LENGTH);
      }
      return result;
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
  /** Runs sent to the primary outputs: run id -> id of the controller that asked. */
  const pendingRuns = new Map<string, string>();

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

  function primaryOutputs() {
    return [...clients.values()].filter((client) => client.role === "output" && client.primary);
  }

  function outputsStatus(): OutputsMessage {
    const primaries = primaryOutputs().filter((client) => client.hasSketch).length;
    return { type: "outputs", count: count("output"), primaries };
  }

  function announceOutputs() {
    broadcast("controller", outputsStatus());
  }

  /** Mark primary outputs as having a sketch; true when that changed any. */
  function markHasSketch(targets: HubClient[]) {
    let changed = false;
    for (const client of targets) {
      if (!client.hasSketch) {
        client.hasSketch = true;
        changed = true;
      }
    }
    return changed;
  }

  function noOutput(id: string): NoOutputResultMessage {
    return { type: "result", id, success: false, message: NO_OUTPUT_MESSAGE, reason: "no-output" };
  }

  /** Answer every waiting run with "no-output" (the last primary output went away). */
  function failPendingRuns() {
    for (const [runId, controllerId] of pendingRuns) {
      const controller = clients.get(controllerId);
      if (controller) deliver(controller, noOutput(runId));
    }
    pendingRuns.clear();
  }

  /** Register a freshly opened socket. Its role is unknown until it says hello. */
  function connect(id: string, send: (text: string) => void) {
    clients.set(id, { id, role: null, primary: false, hasSketch: false, send });
  }

  function disconnect(id: string) {
    const client = clients.get(id);
    if (!client) return;
    clients.delete(id);
    if (client.role === "output") {
      log(`[output-hub] output ${id} disconnected (${count("output")} left)`);
      if (client.primary && primaryOutputs().length === 0) failPendingRuns();
      announceOutputs();
    } else if (client.role === "controller") {
      for (const [runId, controllerId] of pendingRuns) {
        if (controllerId === id) pendingRuns.delete(runId);
      }
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
        client.primary = parsed.primary === true;
        if (parsed.role === "output") {
          log(`[output-hub] ${client.primary ? "primary " : ""}output ${id} connected`);
          if (lastSketch) {
            deliver(client, lastSketch);
            if (client.primary) client.hasSketch = true;
          }
          if (lastState) deliver(client, lastState);
          announceOutputs();
        } else {
          deliver(client, outputsStatus());
        }
        return true;
      case "sketch":
        if (client.role !== "controller") return false;
        lastSketch = parsed;
        broadcast("output", parsed);
        if (markHasSketch(primaryOutputs())) announceOutputs();
        return true;
      case "run": {
        if (client.role !== "controller") return false;
        const targets = primaryOutputs();
        if (targets.length === 0) {
          deliver(client, noOutput(parsed.id));
          return true;
        }
        if (pendingRuns.size >= MAX_PENDING_RUNS) {
          const oldest = pendingRuns.keys().next().value;
          if (oldest !== undefined) pendingRuns.delete(oldest);
        }
        pendingRuns.set(parsed.id, client.id);
        const text = JSON.stringify(parsed);
        for (const target of targets) safeSend(target, text);
        return true;
      }
      case "result": {
        if (client.role !== "output" || !client.primary) return false;
        const controllerId = pendingRuns.get(parsed.id);
        // Already answered (by another primary output) or never asked
        if (controllerId === undefined) return false;
        pendingRuns.delete(parsed.id);
        if (parsed.success && markHasSketch([client])) announceOutputs();
        const controller = clients.get(controllerId);
        if (controller) deliver(controller, parsed);
        return true;
      }
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
    primaryCount: () => primaryOutputs().length,
    controllerCount: () => count("controller"),
    pendingRunCount: () => pendingRuns.size,
    getLastSketch: () => lastSketch,
    getLastState: () => lastState,
  };
}

export type OutputHub = ReturnType<typeof createOutputHub>;
