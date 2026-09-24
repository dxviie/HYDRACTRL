// Settings window: edits are applied immediately through the desktop API and
// the page re-renders from the state pushed back by the main process.
(() => {
  const api = window.hydractrlDesktop;
  const $ = (id) => document.getElementById(id);

  const els = {
    version: $("version"),
    saved: $("saved"),
    dot: $("status-dot"),
    statusTitle: $("status-title"),
    statusDetail: $("status-detail"),
    statusError: $("status-error"),
    toggle: $("toggle"),
    restart: $("restart"),
    name: $("name"),
    preset: $("preset"),
    width: $("width"),
    height: $("height"),
    frameRate: $("frameRate"),
    preview: $("preview"),
    includeAlpha: $("includeAlpha"),
    autoStart: $("autoStart"),
    serverUrl: $("server-url"),
    outputUrl: $("output-url"),
    copyUrl: $("copy-url"),
    openOutput: $("open-output"),
    allowNetwork: $("allowNetwork"),
    dropped: $("dropped"),
    serverMode: $("server-mode"),
    logPath: $("log-path"),
    openLogs: $("open-logs"),
  };

  let state = null;
  let savedTimer = null;

  function isEditing(element) {
    return document.activeElement === element;
  }

  function flashSaved() {
    els.saved.classList.add("visible");
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => els.saved.classList.remove("visible"), 1200);
  }

  async function update(partial) {
    try {
      await api.updateSettings(partial);
      flashSaved();
    } catch (error) {
      console.error("settings update failed", error);
    }
  }

  function fillSelect(select, options, current) {
    const values = options.map((option) => String(option.value));
    if (values.join("|") !== select.dataset.values) {
      select.innerHTML = "";
      for (const option of options) {
        const element = document.createElement("option");
        element.value = String(option.value);
        element.textContent = option.label;
        select.appendChild(element);
      }
      select.dataset.values = values.join("|");
    }
    select.value = String(current);
  }

  function describeStatus(output) {
    if (!output.available) {
      return {
        tone: "unavailable",
        title: "Output unavailable",
        detail: "",
        error: output.unavailableReason || "Texture sharing is not available on this system.",
        toggleLabel: "Start Output",
        toggleEnabled: false,
        danger: false,
      };
    }
    const size = `${output.width}×${output.height}`;
    switch (output.state) {
      case "running":
        return {
          tone: "running",
          title: `${output.protocol} output running`,
          detail: `${output.name} · ${size} · ${output.fps === null ? "–" : output.fps} fps`,
          error: output.error,
          toggleLabel: "Stop Output",
          toggleEnabled: true,
          danger: true,
        };
      case "starting":
        return {
          tone: "starting",
          title: `Starting ${output.protocol} output…`,
          detail: `${output.name} · ${size}`,
          error: null,
          toggleLabel: "Starting…",
          toggleEnabled: false,
          danger: false,
        };
      case "error":
        return {
          tone: "error",
          title: `${output.protocol} output failed`,
          detail: "",
          error: output.error || "Unknown error",
          toggleLabel: "Start Output",
          toggleEnabled: true,
          danger: false,
        };
      default:
        return {
          tone: "stopped",
          title: `${output.protocol} output stopped`,
          detail: "",
          error: null,
          toggleLabel: "Start Output",
          toggleEnabled: true,
          danger: false,
        };
    }
  }

  function render(next) {
    state = next;
    const { output, settings, server, app, presets, frameRates } = state;
    els.version.textContent = `v${app.version}`;

    const status = describeStatus(output);
    els.dot.dataset.tone = status.tone;
    els.statusTitle.textContent = status.title;
    els.statusDetail.textContent = status.detail;
    els.statusError.textContent = status.error || "";
    els.statusError.hidden = !status.error;
    els.toggle.textContent = status.toggleLabel;
    els.toggle.disabled = !status.toggleEnabled;
    els.toggle.classList.toggle("danger", status.danger);
    els.restart.disabled = output.state !== "running";

    if (!isEditing(els.name)) els.name.value = settings.output.name;
    const presetOptions = presets.map((preset) => ({
      value: `${preset.width}x${preset.height}`,
      label: `${preset.label} (${preset.width}×${preset.height})`,
    }));
    presetOptions.push({ value: "custom", label: "Custom" });
    const currentPreset = presets.find(
      (preset) =>
        preset.width === settings.output.width && preset.height === settings.output.height,
    );
    if (!isEditing(els.preset)) {
      fillSelect(
        els.preset,
        presetOptions,
        currentPreset ? `${currentPreset.width}x${currentPreset.height}` : "custom",
      );
    }
    if (!isEditing(els.width)) els.width.value = settings.output.width;
    if (!isEditing(els.height)) els.height.value = settings.output.height;

    const rateOptions = frameRates.map((rate) => ({ value: rate, label: `${rate} fps` }));
    if (!frameRates.includes(settings.output.frameRate)) {
      rateOptions.push({
        value: settings.output.frameRate,
        label: `${settings.output.frameRate} fps (custom)`,
      });
    }
    if (!isEditing(els.frameRate))
      fillSelect(els.frameRate, rateOptions, settings.output.frameRate);

    els.preview.checked = settings.output.preview;
    els.includeAlpha.checked = settings.output.includeAlpha;
    els.autoStart.checked = settings.output.autoStart;
    for (const element of [
      els.name,
      els.preset,
      els.width,
      els.height,
      els.frameRate,
      els.preview,
      els.includeAlpha,
      els.autoStart,
    ]) {
      element.disabled = !output.available;
    }

    const url = server.url || "";
    els.serverUrl.textContent = url || "not running";
    els.outputUrl.textContent = url ? `${url}/output` : "–";
    els.copyUrl.disabled = !url;
    els.openOutput.disabled = !url;
    els.allowNetwork.checked = settings.server.allowNetwork;

    els.dropped.textContent =
      String(output.droppedFrames || 0) +
      (output.lastDropReason ? ` (${output.lastDropReason})` : "");
    els.serverMode.textContent = describeServer(server);
    els.logPath.textContent = shortenPath(app.logPath);
    els.logPath.title = app.logPath;
  }

  /** Keep the tail of a long path readable: "…/HYDRACTRL/logs/file.log". */
  function shortenPath(path, keep = 3) {
    const parts = String(path)
      .split(/[\\/]+/)
      .filter(Boolean);
    if (parts.length <= keep) return path;
    const separator = path.includes("\\") ? "\\" : "/";
    return `…${separator}${parts.slice(-keep).join(separator)}`;
  }

  function describeServer(server) {
    switch (server.status) {
      case "ready":
        return server.mode === "attached"
          ? `using an existing server on port ${server.port}`
          : `running on port ${server.port}` + (server.pid ? ` (pid ${server.pid})` : "");
      case "failed":
        return `failed: ${server.error || "unknown error"}`;
      case "starting":
      case "probing":
        return "starting…";
      default:
        return server.status;
    }
  }

  function bind() {
    els.toggle.addEventListener("click", () => api.toggleOutput().catch(() => {}));
    els.restart.addEventListener("click", () => api.restartOutput().catch(() => {}));

    els.name.addEventListener("change", () => update({ output: { name: els.name.value } }));
    els.name.addEventListener("keydown", (event) => {
      if (event.key === "Enter") els.name.blur();
    });

    els.preset.addEventListener("change", () => {
      if (els.preset.value === "custom") {
        els.width.focus();
        els.width.select();
        return;
      }
      const [width, height] = els.preset.value.split("x").map(Number);
      update({ output: { width, height } });
    });
    for (const element of [els.width, els.height]) {
      element.addEventListener("change", () =>
        update({ output: { width: Number(els.width.value), height: Number(els.height.value) } }),
      );
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter") element.blur();
      });
    }
    els.frameRate.addEventListener("change", () =>
      update({ output: { frameRate: Number(els.frameRate.value) } }),
    );
    els.preview.addEventListener("change", () =>
      update({ output: { preview: els.preview.checked } }),
    );
    els.includeAlpha.addEventListener("change", () =>
      update({ output: { includeAlpha: els.includeAlpha.checked } }),
    );
    els.autoStart.addEventListener("change", () =>
      update({ output: { autoStart: els.autoStart.checked } }),
    );
    els.allowNetwork.addEventListener("change", () =>
      update({ server: { allowNetwork: els.allowNetwork.checked } }),
    );

    els.copyUrl.addEventListener("click", () => {
      api
        .copyServerUrl()
        .then(() => flashSaved())
        .catch(() => {});
    });
    els.openOutput.addEventListener("click", () => api.openOutputPage().catch(() => {}));
    els.openLogs.addEventListener("click", () => api.openLogs().catch(() => {}));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") window.close();
    });
  }

  function focusSection(section) {
    const map = {
      resolution: els.width,
      frameRate: els.frameRate,
      name: els.name,
      server: els.allowNetwork,
    };
    const target = map[section];
    if (!target) return;
    target.scrollIntoView({ block: "center" });
    target.focus();
    if (typeof target.select === "function") target.select();
  }

  if (!api) {
    document.body.innerHTML =
      '<p class="hint" style="padding:20px">This page only works inside the HYDRACTRL desktop app.</p>';
    return;
  }

  bind();
  api.onState(render);
  api.onFocusSection(focusSection);
  api
    .getState()
    .then((initial) => {
      render(initial);
      const section = window.location.hash.replace(/^#/, "");
      if (section) setTimeout(() => focusSection(section), 50);
    })
    .catch((error) => console.error("could not load state", error));
})();
