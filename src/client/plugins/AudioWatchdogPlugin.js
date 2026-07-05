/**
 * AudioWatchdogPlugin - diagnose and recover audio FFT dropouts (GitHub issue #1).
 *
 * a.fft has been observed to silently cut out mid-performance with no console
 * errors. The most common cause is the browser suspending the AudioContext
 * (tab backgrounding, device switch, OS-level interruptions). This watchdog:
 *
 *  - periodically checks the AudioContext state and attempts resume() when
 *    it is suspended (also re-tries on the next user gesture, which browsers
 *    require for resume in some cases);
 *  - detects when the FFT flatlines after having been active, and logs a
 *    timestamped diagnostic dump so the failure is no longer silent;
 *  - emits "audio:suspended", "audio:flatline" and "audio:recovered" events
 *    that other plugins/panels can react to.
 */

/** Number of consecutive silent checks before we call it a flatline. */
const FLATLINE_THRESHOLD = 4;
const EPSILON = 0.0001;

/** Pure helper: is an FFT frame effectively silent? Exported for tests. */
export function isFlatFrame(fft, epsilon = EPSILON) {
  if (!fft || typeof fft.length !== "number" || fft.length === 0) return true;
  let sum = 0;
  for (let i = 0; i < fft.length; i++) {
    sum += Math.abs(fft[i] || 0);
  }
  return sum <= epsilon;
}

export function createAudioWatchdogPlugin(options = {}) {
  const intervalMs = options.intervalMs || 3000;

  return {
    id: "audio-watchdog",
    name: "Audio Watchdog",
    description: "Detects a.fft dropouts, logs diagnostics and auto-resumes the AudioContext",

    setup(ctx) {
      let flatChecks = 0;
      let everActive = false;
      let flatlineReported = false;

      function getAudio() {
        // hydra-synth (makeGlobal) exposes the audio analyser as window.a
        return typeof window !== "undefined" ? window.a : null;
      }

      function resumeContext(context, reason) {
        if (!context || typeof context.resume !== "function") return;
        context
          .resume()
          .then(() => {
            console.warn(`[audio-watchdog] AudioContext resumed (${reason})`);
          })
          .catch((error) => {
            console.warn(`[audio-watchdog] AudioContext resume failed (${reason}):`, error);
          });
      }

      // Browsers only allow resume() from a user gesture in some situations,
      // so also retry on the next interaction whenever we saw a suspension.
      let gestureRetryArmed = false;
      function armGestureRetry(context) {
        if (gestureRetryArmed) return;
        gestureRetryArmed = true;
        const onGesture = () => {
          gestureRetryArmed = false;
          document.removeEventListener("pointerdown", onGesture);
          document.removeEventListener("keydown", onGesture);
          if (context.state === "suspended") {
            resumeContext(context, "user gesture");
          }
        };
        document.addEventListener("pointerdown", onGesture);
        document.addEventListener("keydown", onGesture);
      }

      function check() {
        try {
          const audio = getAudio();
          if (!audio || !audio.fft) return;

          const context = audio.context;
          if (context && context.state === "suspended") {
            console.warn(
              `[audio-watchdog] ${new Date().toISOString()} AudioContext is suspended — attempting resume`,
            );
            ctx.events.emit("audio:suspended", { at: Date.now() });
            resumeContext(context, "watchdog");
            armGestureRetry(context);
          }

          if (isFlatFrame(audio.fft)) {
            if (!everActive) return; // never had signal yet; nothing to report
            flatChecks++;
            if (flatChecks === FLATLINE_THRESHOLD && !flatlineReported) {
              flatlineReported = true;
              console.warn(
                `[audio-watchdog] ${new Date().toISOString()} a.fft flatlined after being active.`,
                {
                  contextState: context ? context.state : "no-context",
                  fft: Array.from(audio.fft),
                  bins: audio.bins,
                },
              );
              ctx.events.emit("audio:flatline", { at: Date.now() });
              // A suspended/interrupted context is the usual culprit; try a nudge.
              if (context) {
                resumeContext(context, "flatline recovery");
                armGestureRetry(context);
              }
            }
          } else {
            if (flatlineReported) {
              console.warn(`[audio-watchdog] ${new Date().toISOString()} a.fft signal recovered.`);
              ctx.events.emit("audio:recovered", { at: Date.now() });
            }
            everActive = true;
            flatChecks = 0;
            flatlineReported = false;
          }
        } catch (error) {
          console.error("[audio-watchdog] check failed:", error);
        }
      }

      const timer = setInterval(check, intervalMs);

      return {
        api: { check },
        dispose() {
          clearInterval(timer);
        },
      };
    },
  };
}
