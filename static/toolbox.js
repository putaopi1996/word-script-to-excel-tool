/* ===== Toolbox - 常用小工具箱 ===== */

// ===== Tool Registry =====
const TOOLBOX_APPS = [
  { id: "text-join", icon: "🔗", name: "分段文本连接" },
  // 后续追加更多工具...
];

// ===== Grid Rendering =====
const toolboxGrid = document.getElementById("toolbox-grid");
const toolboxGridPanel = document.getElementById("toolbox-grid-panel");

function renderToolboxGrid() {
  toolboxGrid.innerHTML = "";
  TOOLBOX_APPS.forEach((app) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "toolbox-app-card";
    card.dataset.toolId = app.id;

    const icon = document.createElement("span");
    icon.className = "toolbox-app-icon";
    icon.textContent = app.icon;

    const name = document.createElement("span");
    name.className = "toolbox-app-name";
    name.textContent = app.name;

    card.appendChild(icon);
    card.appendChild(name);

    card.addEventListener("click", () => openTool(app.id));
    toolboxGrid.appendChild(card);
  });
}

function openTool(toolId) {
  toolboxGridPanel.classList.add("hidden");
  const toolPanel = document.getElementById(`tool-${toolId}`);
  if (toolPanel) {
    toolPanel.classList.remove("hidden");
  }
}

function closeToolToGrid() {
  // Hide all tool panels
  document.querySelectorAll("#toolbox-app > section").forEach((section) => {
    if (section.id !== "toolbox-grid-panel") {
      section.classList.add("hidden");
    }
  });
  toolboxGridPanel.classList.remove("hidden");
}

// ===== Tool: Text Join =====
const textJoinBack = document.getElementById("tool-text-join-back");
const textJoinInput = document.getElementById("text-join-input");
const textJoinOutput = document.getElementById("text-join-output");
const textJoinSeparator = document.getElementById("text-join-separator");
const textJoinDefaultCheck = document.getElementById("text-join-default-check");
const textJoinBtn = document.getElementById("text-join-btn");
const textJoinCopy = document.getElementById("text-join-copy");
const textJoinMessage = document.getElementById("text-join-message");

function setTextJoinMessage(text, type = "") {
  textJoinMessage.textContent = text;
  textJoinMessage.className = `message ${type}`.trim();
}

textJoinBack.addEventListener("click", closeToolToGrid);

// Default checkbox controls separator editability
textJoinDefaultCheck.addEventListener("change", () => {
  if (textJoinDefaultCheck.checked) {
    textJoinSeparator.value = ",";
    textJoinSeparator.disabled = true;
  } else {
    textJoinSeparator.disabled = false;
    textJoinSeparator.focus();
  }
});

// Process button
textJoinBtn.addEventListener("click", () => {
  const input = textJoinInput.value;
  if (!input.trim()) {
    setTextJoinMessage("请先输入文本", "error");
    textJoinOutput.value = "";
    textJoinCopy.disabled = true;
    return;
  }

  const separator = textJoinSeparator.value;
  const lines = input.split("\n").filter((line) => line.trim() !== "");
  const result = lines.join(separator);

  textJoinOutput.value = result;
  textJoinCopy.disabled = false;
  setTextJoinMessage(`已处理，共 ${lines.length} 段文本。`, "success");
});

// Copy button
textJoinCopy.addEventListener("click", async () => {
  const text = textJoinOutput.value;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    const originalText = textJoinCopy.textContent;
    textJoinCopy.textContent = "已复制 ✓";
    textJoinCopy.classList.add("copied");
    setTimeout(() => {
      textJoinCopy.textContent = originalText;
      textJoinCopy.classList.remove("copied");
    }, 1500);
  } catch (e) {
    // Fallback for older browsers
    textJoinOutput.select();
    document.execCommand("copy");
    textJoinCopy.textContent = "已复制 ✓";
    setTimeout(() => {
      textJoinCopy.textContent = "复制";
    }, 1500);
  }
});

// ===== Init =====
renderToolboxGrid();
