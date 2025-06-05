/**
 * Documentation Panel Component
 * A draggable panel with Hydra function reference
 */
import { loadPanelPosition, savePanelPosition } from "./utils/PanelStorage.js";
import hydraData from "./data/hydra-functions.json" assert { type: "json" };

// Extract categories and functions from the shared JSON resource
const FUNCTION_CATEGORIES = hydraData.categories;
const FUNCTION_DOCS = hydraData.functions;

export function createDocPanel() {
  // Load saved position or use defaults
  const savedPosition = loadPanelPosition("doc-panel");

  // Create the panel container
  const panel = document.createElement("div");
  panel.id = "doc-panel";
  panel.className = "doc-panel";
  panel.style.position = "absolute";
  panel.style.display = "none"; // Hidden by default

  if (savedPosition) {
    panel.style.left = savedPosition.left + "px";
    panel.style.top = savedPosition.top + "px";
    panel.style.width = savedPosition.width ? savedPosition.width + "px" : "500px";
    panel.style.height = savedPosition.height ? savedPosition.height + "px" : "900px";
  } else {
    panel.style.left = "60px";
    panel.style.top = "60px";
    panel.style.width = "500px";
    panel.style.height = "900px";
  }

  panel.style.backgroundColor = "rgba(var(--color-bg-secondary-rgb), var(--panel-opacity)) !important";
  panel.style.borderRadius = "8px";
  panel.style.boxShadow = "0 4px 15px var(--color-panel-shadow)";
  panel.style.backdropFilter = "blur(var(--color-panel-blur))";
  panel.style.zIndex = "999";
  panel.style.overflow = "hidden";
  panel.style.fontFamily = "sans-serif";
  panel.style.fontSize = "14px";
  panel.style.color = "var(--color-text-primary)";
  panel.style.flexDirection = "column";

  // Create the handle
  const handle = document.createElement("div");
  handle.className = "doc-handle";
  handle.style.height = "28px";
  handle.style.backgroundColor = "rgba(var(--color-bg-tertiary-rgb), var(--panel-opacity))";
  handle.style.display = "flex";
  handle.style.justifyContent = "space-between";
  handle.style.alignItems = "center";
  handle.style.padding = "0 10px";
  handle.style.cursor = "move";
  handle.style.userSelect = "none";
  handle.style.borderTopLeftRadius = "8px";
  handle.style.borderTopRightRadius = "8px";

  // Create the title container
  const titleContainer = document.createElement("div");
  titleContainer.style.display = "flex";
  titleContainer.style.alignItems = "center";

  // Create the title
  const title = document.createElement("div");
  title.textContent = "Hydra Functions";
  title.style.fontWeight = "bold";
  title.style.fontSize = "14px";

  // Create the close button
  const closeButton = document.createElement("button");
  closeButton.innerHTML = "×";
  closeButton.style.background = "none";
  closeButton.style.border = "none";
  closeButton.style.fontSize = "20px";
  closeButton.style.color = "var(--color-text-primary)";
  closeButton.style.cursor = "pointer";
  closeButton.style.padding = "0 5px";
  closeButton.title = "Close";
  closeButton.addEventListener("click", () => {
    panel.style.display = "none";
  });

  titleContainer.appendChild(title);
  handle.appendChild(titleContainer);
  handle.appendChild(closeButton);
  panel.appendChild(handle);

  // Create the content container (split into two columns)
  const contentContainer = document.createElement("div");
  contentContainer.style.display = "flex";
  contentContainer.style.flexDirection = "column";
  contentContainer.style.flex = "1";
  contentContainer.style.overflow = "hidden";

  // Create the left sidebar (categories and functions)
  const leftSidebar = document.createElement("div");
  leftSidebar.style.width = "100%";
  leftSidebar.style.height = "fit-content";
  leftSidebar.style.borderRight = "1px solid rgba(var(--color-bg-tertiary-rgb), 0.5)";
  leftSidebar.style.overflow = "auto";
  leftSidebar.style.padding = "10px";

  // Create the right content area (function details)
  const rightContent = document.createElement("div");
  rightContent.style.flex = "1";
  rightContent.style.padding = "10px";
  rightContent.style.height = "20rem";
  rightContent.style.width = "100%";
  rightContent.style.backgroundColor = "rgba(255, 255, 255, 0.1)";

  // Selected function indicator
  let selectedFunction = null;

  // Function to display simplified function details
  const showFunctionDetails = (funcName) => {
    const funcInfo = FUNCTION_DOCS[funcName];
    if (!funcInfo) {
      rightContent.innerHTML = `<div class="function-not-found">No documentation for '${funcName}'</div>`;
      return;
    }

    // Find the category for this function
    let category = null;
    for (const cat in FUNCTION_CATEGORIES) {
      if (FUNCTION_CATEGORIES[cat].functions.includes(funcName)) {
        category = FUNCTION_CATEGORIES[cat];
        break;
      }
    }

    const categoryColor = category ? category.color : "#FFFFFF";

    // Build the simplified content
    let content = `
      <div class="function-header" style="border-bottom: 1px solid ${categoryColor}4D; margin-bottom: 8px;">
        <h2 style="color: ${categoryColor}; font-size: 16px; margin: 0 0 5px 0">${funcName}()</h2>
      </div>
      <div class="function-description" style="margin-bottom: 10px; font-size: 13px;">
        ${funcInfo.description}
      </div>
    `;

    // Add example section
    if (funcInfo.example) {
      const exampleButtonId = `copy-example-btn-${funcName.replace(/\s+/g, '-')}`;
      content += `
        <div class="function-example">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <div style="font-size: 13px; font-weight: bold;">Example</div>
            <button id="${exampleButtonId}" title="Copy example" class="copy-example-button" style="background: none; border: none; cursor: pointer; color: var(--color-text-secondary); padding: 2px 4px; line-height: 1;">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Myna UI Icons by Praveen Juge - https://github.com/praveenjuge/mynaui-icons/blob/main/LICENSE --><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.829 12.861c.171-.413.171-.938.171-1.986s0-1.573-.171-1.986a2.25 2.25 0 0 0-1.218-1.218c-.413-.171-.938-.171-1.986-.171H11.1c-1.26 0-1.89 0-2.371.245a2.25 2.25 0 0 0-.984.984C7.5 9.209 7.5 9.839 7.5 11.1v6.525c0 1.048 0 1.573.171 1.986c.229.551.667.99 1.218 1.218c.413.171.938.171 1.986.171s1.573 0 1.986-.171m7.968-7.968a2.25 2.25 0 0 1-1.218 1.218c-.413.171-.938.171-1.986.171s-1.573 0-1.986.171a2.25 2.25 0 0 0-1.218 1.218c-.171.413-.171.938-.171 1.986s0 1.573-.171 1.986a2.25 2.25 0 0 1-1.218 1.218m7.968-7.968a11.68 11.68 0 0 1-7.75 7.9l-.218.068M16.5 7.5v-.9c0-1.26 0-1.89-.245-2.371a2.25 2.25 0 0 0-.983-.984C14.79 3 14.16 3 12.9 3H6.6c-1.26 0-1.89 0-2.371.245a2.25 2.25 0 0 0-.984.984C3 4.709 3 5.339 3 6.6v6.3c0 1.26 0 1.89.245 2.371c.216.424.56.768.984.984c.48.245 1.111.245 2.372.245H7.5"/></svg>
            </button>
          </div>
          <pre style="background-color: rgba(0,0,0,0.2); padding: 6px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 12px; margin: 0;">${funcInfo.example}</pre>
        </div>
      `;
    }

    rightContent.innerHTML = content;

    // Add event listener for the copy button if it exists
    if (funcInfo.example) {
      const exampleButtonId = `copy-example-btn-${funcName.replace(/\s+/g, '-')}`;
      const copyButton = rightContent.querySelector(`#${exampleButtonId}`);
      if (copyButton) {
        copyButton.addEventListener('click', (event) => {
          event.stopPropagation(); // Prevent any other click listeners on parent elements
          navigator.clipboard.writeText(funcInfo.example)
            .then(() => {
              const originalIconHTML = copyButton.innerHTML;
              copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Myna UI Icons by Praveen Juge - https://github.com/praveenjuge/mynaui-icons/blob/main/LICENSE --><path fill="none" stroke="var(--color-success, green)" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.829 12.861c.171-.413.171-.938.171-1.986s0-1.573-.171-1.986a2.25 2.25 0 0 0-1.218-1.218c-.413-.171-.938-.171-1.986-.171H11.1c-1.26 0-1.89 0-2.371.245a2.25 2.25 0 0 0-.984.984C7.5 9.209 7.5 9.839 7.5 11.1v6.525c0 1.048 0 1.573.171 1.986c.229.551.667.99 1.218 1.218c.413.171.938.171 1.986.171s1.573 0 1.986-.171m7.968-7.968a2.25 2.25 0 0 1-1.218 1.218c-.413.171-.938.171-1.986.171s-1.573 0-1.986.171a2.25 2.25 0 0 0-1.218 1.218c-.171.413-.171.938-.171 1.986s0 1.573-.171 1.986a2.25 2.25 0 0 1-1.218 1.218m7.968-7.968a11.68 11.68 0 0 1-7.75 7.9l-.218.068M16.5 7.5v-.9c0-1.26 0-1.89-.245-2.371a2.25 2.25 0 0 0-.983-.984C14.79 3 14.16 3 12.9 3H6.6c-1.26 0-1.89 0-2.371.245a2.25 2.25 0 0 0-.984.984C3 4.709 3 5.339 3 6.6v6.3c0 1.26 0 1.89.245 2.371c.216.424.56.768.984.984c.48.245 1.111.245 2.372.245H7.5"/></svg>';

              setTimeout(() => {
                copyButton.innerHTML = originalIconHTML;
              }, 2000);
            })
            .catch(err => {
              console.error('Failed to copy example to clipboard:', err);
              alert('Failed to copy example. See console for details.');
            });
        });
      }
    }
  };

  // Create function tags container (horizontal flow)
  const functionTagsContainer = document.createElement("div");
  functionTagsContainer.style.display = "flex";
  functionTagsContainer.style.flexWrap = "wrap";
  functionTagsContainer.style.gap = "4px";
  functionTagsContainer.style.padding = "4px 0";
  functionTagsContainer.style.alignItems = "center";

  // Create function list by categories
  Object.keys(FUNCTION_CATEGORIES).forEach(catKey => {
    const category = FUNCTION_CATEGORIES[catKey];

    // Create category heading
    const categoryHeading = document.createElement("div");
    categoryHeading.style.fontWeight = "bold";
    categoryHeading.style.backgroundColor = category.color;
    categoryHeading.style.color = "black";
    categoryHeading.style.padding = ".5rem 1rem";
    categoryHeading.style.borderRadius = "4px";
    categoryHeading.textContent = category.title;

    functionTagsContainer.appendChild(categoryHeading);

    category.functions.forEach(funcName => {
      // Create tag-like container for each function
      const funcTag = document.createElement("div");
      funcTag.textContent = funcName;
      funcTag.style.backgroundColor = `${category.color}20`; // 12% opacity background
      funcTag.style.color = "var(--color-text-primary)";
      funcTag.style.padding = ".5rem 1rem";
      funcTag.style.borderRadius = "3px";
      funcTag.style.fontSize = "12px";
      funcTag.style.cursor = "pointer";
      funcTag.style.height = "fit-content";
      funcTag.style.transition = "all 0.15s ease";
      funcTag.style.border = `1px solid ${category.color}30`; // 19% opacity border

      // Hover effects
      funcTag.addEventListener("mouseenter", () => {
        funcTag.style.backgroundColor = `${category.color}40`; // 25% opacity on hover
        funcTag.style.transform = "translateY(-1px)";
        funcTag.style.boxShadow = `0 2px 4px rgba(0,0,0,0.1)`;
      });

      funcTag.addEventListener("mouseleave", () => {
        if (selectedFunction !== funcName) {
          funcTag.style.backgroundColor = `${category.color}20`; // Back to 12% opacity
          funcTag.style.transform = "translateY(0)";
          funcTag.style.boxShadow = "none";
        }
      });

      // Click event to show details
      funcTag.addEventListener("click", () => {
        // Clear previous selection styling
        if (selectedFunction) {
          const tags = functionTagsContainer.querySelectorAll("div");
          tags.forEach(tag => {
            if (tag.textContent === selectedFunction) {
              tag.style.backgroundColor = `${category.color}20`; // Reset background
              tag.style.transform = "translateY(0)";
              tag.style.boxShadow = "none";
              tag.style.fontWeight = "normal";
            }
          });
        }

        // Set new selection
        selectedFunction = funcName;
        funcTag.style.backgroundColor = `${category.color}40`; // 25% opacity for selected
        funcTag.style.fontWeight = "bold";
        funcTag.style.boxShadow = `0 2px 4px rgba(0,0,0,0.15)`;

        // Show function details
        showFunctionDetails(funcName);
      });

      functionTagsContainer.appendChild(funcTag);
    });
  });
  leftSidebar.appendChild(functionTagsContainer);

  // Add initial content to right panel
  rightContent.innerHTML = `
    <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; color: var(--color-text-secondary);">
      <div style="font-size: 36px; margin-bottom: 10px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Myna UI Icons by Praveen Juge - https://github.com/praveenjuge/mynaui-icons/blob/main/LICENSE --><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9.8V20m0-10.2c0-1.704.107-3.584-1.638-4.473C9.72 5 8.88 5 7.2 5H4.6C3.364 5 3 5.437 3 6.6v8.8c0 .568-.036 1.195.546 1.491c.214.109.493.109 1.052.109H7.43c2.377 0 3.26 1.036 4.569 3m0-10.2c0-1.704-.108-3.584 1.638-4.473C14.279 5 15.12 5 16.8 5h2.6c1.235 0 1.6.436 1.6 1.6v8.8c0 .567.035 1.195-.546 1.491c-.213.109-.493.109-1.052.109h-2.833c-2.377 0-3.26 1.036-4.57 3"/></svg>
      </div>
      <div>Select a function from in the list below to view its documentation</div>
    </div>
  `;

  // Add columns to the content container
  contentContainer.appendChild(rightContent);
  contentContainer.appendChild(leftSidebar);


  // Add content container to panel
  panel.appendChild(contentContainer);

  // Make panel resizable
  const resizeHandle = document.createElement("div");
  resizeHandle.style.position = "absolute";
  resizeHandle.style.width = "10px";
  resizeHandle.style.height = "10px";
  resizeHandle.style.bottom = "0";
  resizeHandle.style.right = "0";
  resizeHandle.style.cursor = "nwse-resize";
  resizeHandle.style.zIndex = "5";
  panel.appendChild(resizeHandle);

  let isResizing = false;
  let initialX, initialY, initialWidth, initialHeight;

  resizeHandle.addEventListener("mousedown", (e) => {
    isResizing = true;
    initialX = e.clientX;
    initialY = e.clientY;
    initialWidth = panel.offsetWidth;
    initialHeight = panel.offsetHeight;
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    const width = initialWidth + (e.clientX - initialX);
    const height = initialHeight + (e.clientY - initialY);

    if (width > 300) panel.style.width = width + "px";
    if (height > 200) panel.style.height = height + "px";

    // Save the new dimensions
    savePanelPosition("doc-panel", {
      left: parseInt(panel.style.left),
      top: parseInt(panel.style.top),
      width: parseInt(panel.style.width),
      height: parseInt(panel.style.height)
    });
  });

  document.addEventListener("mouseup", () => {
    isResizing = false;
  });

  // Add the panel to the document
  document.body.appendChild(panel);

  // Make the panel draggable
  let isDragging = false;
  let offsetX, offsetY;

  handle.addEventListener("mousedown", (e) => {
    isDragging = true;
    panel.classList.add("dragging");
    offsetX = e.clientX - panel.getBoundingClientRect().left;
    offsetY = e.clientY - panel.getBoundingClientRect().top;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    panel.style.left = (e.clientX - offsetX) + "px";
    panel.style.top = (e.clientY - offsetY) + "px";
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      panel.classList.remove("dragging");

      // Save the new position
      savePanelPosition("doc-panel", {
        left: parseInt(panel.style.left),
        top: parseInt(panel.style.top),
        width: parseInt(panel.style.width),
        height: parseInt(panel.style.height)
      });
    }
  });

  // Return an object with methods to control the panel
  return {
    panel,
    toggle: () => {
      if (panel.style.display === "none") {
        panel.style.display = "flex";
      } else {
        panel.style.display = "none";
      }
    },
    show: () => {
      panel.style.display = "flex";
    },
    hide: () => {
      panel.style.display = "none";
    },
    isVisible: () => panel.style.display !== "none"
  };
}