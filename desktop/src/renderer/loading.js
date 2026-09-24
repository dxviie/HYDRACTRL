// Loading screen: shown until the HYDRACTRL server is ready and the interface
// has loaded, and again whenever either of those fails.
(() => {
  const api = window.hydractrlDesktop;
  const statusText = document.getElementById("status-text");
  const spinner = document.getElementById("spinner");
  const errorPanel = document.getElementById("error");
  const errorTitle = document.getElementById("error-title");
  const errorMessage = document.getElementById("error-message");
  const errorHint = document.getElementById("error-hint");
  const footer = document.getElementById("footer");

  function hintFor(error, state) {
    const text = String(error || "");
    if (/ENOENT/.test(text) && !state.app.packaged) {
      return "Bun was not found. Install Bun, or start `bun dev` in the repository, then retry.";
    }
    if (/did not become ready/.test(text)) {
      return "The server started but never answered. Another program may be blocking it; the log has its output.";
    }
    if (/keeps crashing/.test(text)) {
      return "The server crashed several times in a row. The log has its last output.";
    }
    if (/could not be loaded|renderer crashed/.test(text)) {
      return "The interface could not be shown. Retrying reconnects to the server and reloads it.";
    }
    return "Details are in the log.";
  }

  function render(state) {
    if (!state || !state.server) return;
    const server = state.server;
    const loadFailure = state.app && state.app.loadFailure;
    footer.textContent = state.app ? `Log: ${state.app.logPath}` : "";

    let text = "Starting…";
    let failure = null;
    switch (server.status) {
      case "idle":
      case "probing":
        text = "Looking for the HYDRACTRL server…";
        break;
      case "starting":
        text = "Starting the HYDRACTRL server…";
        break;
      case "ready":
        text = "Loading the interface…";
        break;
      case "failed":
        text = "";
        failure = { title: "The server could not be started", message: server.error };
        break;
      case "stopped":
        text = "Shutting down…";
        break;
      default:
        break;
    }
    if (loadFailure && server.status === "ready") {
      text = "";
      failure = {
        title: "The interface could not be loaded",
        message: loadFailure.description || "Unknown error",
      };
    }

    if (failure) {
      spinner.hidden = true;
      statusText.textContent = "";
      errorTitle.textContent = failure.title;
      errorMessage.textContent = failure.message || "Unknown error";
      errorHint.textContent = hintFor(failure.message, state);
      errorPanel.hidden = false;
    } else {
      spinner.hidden = false;
      statusText.textContent = text;
      errorPanel.hidden = true;
    }
  }

  if (!api) {
    statusText.textContent = "This page only works inside the HYDRACTRL desktop app.";
    spinner.hidden = true;
    return;
  }

  document.getElementById("retry").addEventListener("click", () => {
    errorPanel.hidden = true;
    spinner.hidden = false;
    statusText.textContent = "Retrying…";
    api.retryServer().catch(() => {});
  });
  document.getElementById("logs").addEventListener("click", () => {
    api.openLogs().catch(() => {});
  });

  api.onState(render);
  api
    .getState()
    .then(render)
    .catch(() => {});
})();
