# Signature Assist for Hydra

The bundled editor plugin shows a call signature and highlights the current parameter using CodeMirror’s JavaScript syntax tree. Escape dismisses the hint. The editor’s autocomplete keeps its existing keybindings.

## Catalog audit

The native resolver uses the 76 function records in [the app’s Hydra catalog](../src/data/hydra-functions.json), checked against the locked `hydra-synth` 1.3.29 source and HYDRACTRL’s [Hydra initialization](../src/client/index.js) and [sketch bindings](../src/client/core/sketchRunner.js). The audit covers 68 callable records and excludes 8 globals or properties.

| Coverage | Recognized form |
| --- | --- |
| Seven generators | Direct `noise`, `voronoi`, `osc`, `shape`, `gradient`, `solid`, and `src` calls. |
| Texture transforms, color, composition and modulation | Catalog texture methods on a recognized generator or texture helper call, including chains of those methods. `out` is terminal. Combine methods keep the catalog’s leading `texture` parameter, which Hydra adds to the shader input list. |
| Four helpers | Direct `render`, `hush`, `setResolution`, and `setFunction` calls. |
| Five source methods | `init`, `initCam`, `initScreen`, `initVideo`, and `initImage` on `s0` through `s3`. |
| Five audio methods | `setSmooth`, `setCutoff`, `setScale`, `setBins`, and `show` on `a`. |
| Five array methods | `fast`, `smooth`, `ease`, `offset`, and `fit` on array literals and recognized array-method chains. |
| Registered GLSL transforms | Direct custom generators and texture methods registered by running `setFunction` in Setup or Sketch. The hint uses the registered input names and scalar defaults. Combine transforms include a leading `texture` parameter. |

- `time`, `speed`, `bpm`, `width`, `height`, `mouse`, and `a.fft` are values. `update` is a user-assigned frame callback, so no fixed signature is offered.
- Locked GLSL generator and transform declarations agree with the displayed numeric defaults. The plugin retains descriptive catalog labels where the runtime uses shorter shader input names, such as `source` for `src`, `repeatX` for `reps`, and `amount` for `hue`. `out` defaults to `o0` in HYDRACTRL. Omitted `render` output selects all buffers, so the signature omits the catalog’s `o0` default.
- Audio setter values in the catalog describe initial settings. The setters take arguments without call-site defaults. The tooltip omits those defaults. Array `smooth` uses the runtime parameter name and `ease` displays the string default `"linear"`.
- Source methods include the runtime’s second `params` parameter for texture options. Image and video URL defaults are empty strings. Omitted camera index lets the browser select a device. Hydra accepts a screen index but its browser implementation ignores it, so the hint displays the parameter without a default.
- `initStream` appears in the catalog’s category navigation but has no signature record. Its backing stream provider is also unavailable in HYDRACTRL's Hydra initialization. Other runtime-only APIs, such as `prev`, `shift`, `sum`, and texture `.a()`, are outside catalog coverage.
- Static matching does not resolve aliases, local shadowing, computed or optional access, or parenthesized receivers. Built-in names retain their catalog signatures. The hint stays hidden inside an unknown inner call or when a syntax error or spread before the cursor makes the parameter position uncertain. Extra arguments display the known signature without a highlight.

## Reproduce in Chromium

Start `bun run dev`, then run `node scripts/signature-assist-smoke.mjs` from the repository root. Set `CHROMIUM` or `HYDRACTRL_URL` to override the browser binary or app URL. Set `SIGNATURE_SCREENSHOT` and `SIGNATURE_NARROW_SCREENSHOT` to save screenshots of the default view and the light theme at the editor’s minimum panel width. The script checks auto-run and observes WebGL calls with the plugin installed and removed. It does not measure typing latency or frame timing.

## Custom Setup and Sketch helpers

Signature Assist supports top-level `function` declarations and arrow functions or function expressions directly assigned in `var`, `let`, or `const` declarations. Single-argument arrows, empty lists, defaults, rest parameters, and destructuring are supported. The tooltip displays the original parameter source, including defaults, without evaluating expressions. Additional positional arguments continue to highlight a final rest parameter.

- The plugin uses the current texts from both editor tabs. An unchanged inactive tab is parsed once and its index is reused. The active tab uses CodeMirror’s syntax tree and is indexed when its text changes and signature lookup needs it. An incomplete background parse temporarily suppresses hints that would require an unverified binding index. All parser work stays outside the renderer and sketch runner.
- The runtime concatenates Setup before Sketch in one function body. The index treats function declarations as hoisted across both tabs. A variable-bound signature is offered after its initializer in the current tab, or in Sketch if its initializer is in Setup. Write each tab as self-contained JavaScript and use explicit statement terminators when leading Sketch syntax could continue a Setup expression. The index does not follow code that spans the tab boundary or infer when callbacks run.
- A single supported declaration wins over the native catalog. Duplicate or non-function bindings, malformed declarations, and visible assignments suppress hints for that name. A matching nested binding suppresses lookup within its enclosing function, without resolving narrower block scopes. Nested bindings outside a function and visible writes are treated conservatively across the whole script. These rules can suppress some valid hints. Dynamic writes such as `globalThis[name] = ...`, Unicode-escaped identifiers, aliases, and factory-generated functions are outside static discovery.
- A binding that shadows a native generator, source, or audio object also suppresses its native receiver-chain hints. A normal native call remains available when no matching binding is found.
- Texture-method hints work on helpers such as `const carrier = () => osc(40);` when a synchronous helper directly returns a known native generator or texture chain. Use an expression-bodied arrow or a body with a single `return` statement. The index checks for shadows at the returned generator call and skips dynamic return values.

For manual verification, paste this into Setup and switch to Sketch without pressing Run or Save.

```js
var clamp = (value, min, max) => Math.min(Math.max(value, min), max);
function lerp(a, b, t) { return a + (b - a) * t; }
const tide = (period, amplitude = 1) => Math.sin(time * 2 * Math.PI / period) * amplitude;
```

Type `clamp(0.5,` to highlight **min**, `lerp(0, 1,` to highlight **t**, or `tide(20,` to highlight **amplitude = 1**. Edit the default in Setup and return to Sketch to see it update. The browser smoke script also verifies discovery after clearing persisted Setup storage, along with nested custom and native calls, slot changes, and existing editor interactions. Set `SIGNATURE_CUSTOM_SCREENSHOT` to capture the `clamp` example.

## In-editor JSDoc

Signature Assist shows a short summary and the active argument’s documentation below the custom signature. The signature still uses source-derived names, defaults, and rest or destructuring syntax.

```js
/**
 * Restricts a value to a specified range.
 * @param {number} max - Upper bound.
 * @param {number} value - Input value to constrain.
 * @param {number} min - Lower bound.
 */
var clamp = (value, min, max) => Math.min(Math.max(value, min), max);
```

- Place a single `/** … */` block immediately before a supported declaration, on its own line or before the declaration on the same line. A blank line, intervening comment or statement, trailing comment on another statement’s line, stacked JSDoc blocks, and multiple declarators in one statement prevent association.
- Write the summary before any tags. Put each `@param` on its own line. A simple `{type}` and the hyphen before the description are optional. Description text can continue on the following lines. `[name]`, `[name=default]` with a simple bracket-free default, and `...name` match the underlying parameter name. Types and JSDoc defaults are not used to infer or display the signature.
- Unmatched tags, conflicting entries for the same name, and destructured bindings receive no parameter documentation. Unknown tags, nested property paths, complex brace types, inline tags, and overloads are outside this subset. User-authored text is displayed literally, with each documentation section capped at three visible lines.

Paste the example into Setup, then switch to Sketch without pressing Run or Save. Type `clamp(0.5,` and check that **min** is highlighted, the summary is visible, and the argument text says “Lower bound.” Type `0,` to see “Upper bound.” Edit just the description in Setup and return to the same call in Sketch. Removing the block leaves the signature. To reproduce these checks in Chromium, run the smoke command above and optionally set `SIGNATURE_CUSTOM_SCREENSHOT` and `SIGNATURE_DOC_NARROW_SCREENSHOT`.
