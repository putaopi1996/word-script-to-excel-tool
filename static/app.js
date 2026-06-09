const form = document.getElementById("convert-form");
const fileInput = document.getElementById("file-input");
const submitButton = document.getElementById("submit-button");
const message = document.getElementById("message");
const fileName = document.getElementById("file-name");
const importPanel = document.getElementById("import-panel");
const previewPanel = document.getElementById("preview-panel");
const previewSummary = document.getElementById("preview-summary");
const previewHead = document.getElementById("preview-head");
const previewBody = document.getElementById("preview-body");
const backButton = document.getElementById("back-button");

const settingsToggle = document.getElementById("settings-toggle");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsClose = document.getElementById("settings-close");
const warnLengthEnabled = document.getElementById("warn-length-enabled");
const warnLengthThreshold = document.getElementById("warn-length-threshold");
const warnActionButton = document.getElementById("warn-action-button");
const warnStatus = document.getElementById("warn-status");

const typoCheckEnabled = document.getElementById("typo-check-enabled");
const typoActionButton = document.getElementById("typo-action-button");
const typoStatus = document.getElementById("typo-status");

const sfxEnabled = document.getElementById("sfx-enabled");
const sfxActionButton = document.getElementById("sfx-action-button");
const sfxClearButton = document.getElementById("sfx-clear-button");
const sfxStatus = document.getElementById("sfx-status");

const promptUnlock = document.getElementById("prompt-unlock");
const promptSave = document.getElementById("prompt-save");
const promptEditor = document.getElementById("prompt-editor");

const sfxPromptUnlock = document.getElementById("sfx-prompt-unlock");
const sfxPromptSave = document.getElementById("sfx-prompt-save");
const sfxPromptEditor = document.getElementById("sfx-prompt-editor");

let previewColumns = [];
let previewRows = [];
let lastWarnIndex = -1;
let typoIssues = [];
let lastTypoIndex = -1;
let sfxVisible = true;
let sfxLocks = []; // per-row lock state

const DEFAULT_TYPO_PROMPT = `你是一个中文文本校对助手。请检查以下剧本内容中的错别字、语病或不通顺的表达。
以 JSON 数组格式返回检测结果，每个问题包含：line（行号，从1开始）、field（字段名：speaker 或 content）、original（原文片段）、suggestion（建议修改）、reason（简短原因）。
如果没有问题，返回空数组 []。
只返回 JSON，不要其他内容。

剧本内容：
{{content}}`;

const DEFAULT_SFX_PROMPT = `你是一个游戏剧本音效设计师。请根据以下剧本内容，判断哪些行需要添加音效/环境音，并给出简短的音效描述。

规则：
1. 不是每行都需要音效，只在场景转换、特殊动作、环境变化、情绪转折等关键节点添加
2. 音效描述要简短精炼（2-8个字），如：转场声、门吱呀打开、风声渐起、剑出鞘声
3. 以 JSON 数组格式返回，每个条目包含：line（行号，从1开始）、sfx（音效描述）
4. 不需要音效的行不要包含在结果中
5. 如果整段都不需要音效，返回空数组 []

只返回 JSON，不要其他内容。

剧本内容：
{{content}}`;

const settings = {
  warnLength: false,
  warnThreshold: 40,
};

function showImportPage() {
  previewPanel.classList.add("hidden");
  importPanel.classList.remove("hidden");
}

function showPreviewPage() {
  importPanel.classList.add("hidden");
  previewPanel.classList.remove("hidden");
}

const CORE_COLUMNS = [
  { key: "speaker", label: "\u89d2\u8272", compact: true },
  { key: "content", label: "\u53f0\u8bcd", countable: true },
  { key: "sfx", label: "\u97f3\u6548", sfxCol: true },
];

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function clearPreview() {
  previewColumns = [];
  previewRows = [];
  previewHead.innerHTML = "";
  previewBody.innerHTML = "";
  previewSummary.textContent = "";
  previewPanel.classList.add("hidden");
  importPanel.classList.remove("hidden");
  submitButton.disabled = true;
}

function getVisibleColumns() {
  return previewColumns.filter((column) => {
    if (column.sfxCol) return sfxVisible;
    return column.visible !== false;
  });
}

function getExportColumns() {
  // Always include sfx column for export
  return previewColumns.filter((column) => column.visible !== false);
}

function buildInitialColumns() {
  return CORE_COLUMNS.map((column) => ({
    ...column,
    visible: true,
  }));
}

function createEmptyRow() {
  return Object.fromEntries(previewColumns.map((column) => [column.key, ""]));
}

function loadPreviewRows(rows) {
  previewColumns = buildInitialColumns();
  previewRows = rows.map((row) => {
    const normalized = {};
    for (const column of previewColumns) {
      normalized[column.key] = row[column.key] || "";
    }
    return normalized;
  });
  sfxLocks = previewRows.map(() => false);
}

function updatePreviewCell(rowIndex, key, value) {
  if (!previewRows[rowIndex]) {
    return;
  }
  previewRows[rowIndex][key] = value;
}

function countTextLength(value) {
  return Array.from(value || "").length;
}

function buildEditableCell(rowIndex, column, value) {
  const td = document.createElement("td");
  td.className = column.countable ? "content-cell" : "editor-cell";
  if (column.compact) {
    td.classList.add("speaker-cell");
  }

  const wrapper = document.createElement("div");
  wrapper.className = "cell-editor";

  if (column.countable) {
    const len = countTextLength(value);
    const countBadge = document.createElement("span");
    countBadge.className = "content-count";
    countBadge.textContent = `${len}\u5b57`;
    wrapper.appendChild(countBadge);

    if (settings.warnLength && len > settings.warnThreshold) {
      td.classList.add("warn-length");
    }
  }

  // Typo highlight
  const cellIssues = typoIssues.filter(
    (issue) => issue.line === rowIndex + 1 && issue.field === column.key
  );
  if (cellIssues.length > 0) {
    td.classList.add("typo-highlight");
  }

  const input = column.key === "content" || column.key === "original_text"
    ? document.createElement("textarea")
    : document.createElement("input");

  input.className = "preview-input";
  if (column.compact) {
    input.classList.add("preview-input-speaker");
  }
  input.value = value || "";
  input.addEventListener("input", (event) => {
    const nextValue = event.target.value;
    updatePreviewCell(rowIndex, column.key, nextValue);
    if (column.countable) {
      const nextLen = countTextLength(nextValue);
      const countBadge = wrapper.querySelector(".content-count");
      countBadge.textContent = `${nextLen}\u5b57`;

      if (settings.warnLength && nextLen > settings.warnThreshold) {
        td.classList.add("warn-length");
      } else {
        td.classList.remove("warn-length");
      }
    }
  });

  wrapper.appendChild(input);

  // Inline suggestion panel (in-flow, pushes content down)
  if (cellIssues.length > 0) {
    const suggestionPanel = document.createElement("div");
    suggestionPanel.className = "typo-suggestion-inline";

    cellIssues.forEach((issue) => {
      const item = document.createElement("div");
      item.className = "typo-suggestion-item";

      const textDiv = document.createElement("div");
      textDiv.className = "typo-suggestion-text";
      const delEl = document.createElement("del");
      delEl.textContent = issue.original;
      const insEl = document.createElement("ins");
      insEl.textContent = issue.suggestion;
      textDiv.appendChild(delEl);
      textDiv.appendChild(document.createTextNode(" → "));
      textDiv.appendChild(insEl);
      if (issue.reason) {
        const reason = document.createElement("span");
        reason.className = "typo-suggestion-reason";
        reason.textContent = ` (${issue.reason})`;
        textDiv.appendChild(reason);
      }

      const acceptBtn = document.createElement("button");
      acceptBtn.type = "button";
      acceptBtn.className = "typo-accept-btn";
      acceptBtn.textContent = "\u91c7\u7eb3";
      acceptBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        applyTypoFix(rowIndex, column.key, issue);
      });

      item.appendChild(textDiv);
      item.appendChild(acceptBtn);
      suggestionPanel.appendChild(item);
    });

    wrapper.appendChild(suggestionPanel);
  }

  // SFX lock control
  if (column.sfxCol) {
    td.classList.add("sfx-cell");
    const lockRow = document.createElement("div");
    lockRow.className = "sfx-lock-row" + (sfxLocks[rowIndex] ? " locked" : "");

    const lockCheckbox = document.createElement("input");
    lockCheckbox.type = "checkbox";
    lockCheckbox.checked = sfxLocks[rowIndex];
    lockCheckbox.addEventListener("change", () => {
      sfxLocks[rowIndex] = lockCheckbox.checked;
      lockRow.classList.toggle("locked", lockCheckbox.checked);
    });

    const lockLabel = document.createElement("span");
    lockLabel.textContent = "\u{1f512}";

    lockRow.appendChild(lockCheckbox);
    lockRow.appendChild(lockLabel);
    wrapper.appendChild(lockRow);

    // Auto-lock on manual edit
    input.addEventListener("input", () => {
      if (!sfxLocks[rowIndex]) {
        sfxLocks[rowIndex] = true;
        lockCheckbox.checked = true;
        lockRow.classList.add("locked");
      }
    });
  }

  td.appendChild(wrapper);
  return td;
}

function insertRowAt(index) {
  previewRows.splice(index, 0, createEmptyRow());
  sfxLocks.splice(index, 0, false);
  renderPreview();
  setMessage("\u5df2\u63d2\u5165\u65b0\u884c\u3002", "success");
}

function removeRowAt(index) {
  if (!window.confirm(`\u786e\u8ba4\u5220\u9664\u7b2c ${index + 1} \u884c\u5417\uff1f`)) {
    return;
  }

  previewRows.splice(index, 1);
  sfxLocks.splice(index, 1);
  if (!previewRows.length) {
    clearPreview();
    setMessage("\u6240\u6709\u9884\u89c8\u884c\u5df2\u5220\u9664\uff0c\u8bf7\u91cd\u65b0\u9884\u89c8\u3002", "success");
    return;
  }

  renderPreview();
  setMessage("\u5df2\u5220\u9664\u8be5\u884c\u3002", "success");
}

function createInsertRow(insertIndex, columnCount) {
  const tr = document.createElement("tr");
  tr.className = "insert-row";

  const td = document.createElement("td");
  td.colSpan = columnCount + 1;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "inline-add-row";
  button.textContent = "+ \u63d2\u5165\u65b0\u884c";
  button.addEventListener("click", () => insertRowAt(insertIndex));

  td.appendChild(button);
  tr.appendChild(td);
  return tr;
}

function renderPreview() {
  if (!previewRows.length) {
    clearPreview();
    return;
  }

  const visibleColumns = getVisibleColumns();
  previewHead.innerHTML = "";
  previewBody.innerHTML = "";

  const headerRow = document.createElement("tr");

  const actionHead = document.createElement("th");
  actionHead.className = "row-actions-head";
  actionHead.textContent = "\u64cd\u4f5c";
  headerRow.appendChild(actionHead);

  visibleColumns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column.label;
    if (column.compact) {
      th.classList.add("speaker-head");
    }
    if (column.sfxCol) {
      th.classList.add("sfx-head");
    }
    headerRow.appendChild(th);
  });

  previewHead.appendChild(headerRow);
  previewBody.appendChild(createInsertRow(0, visibleColumns.length));

  previewRows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    tr.className = "data-row";

    const actionTd = document.createElement("td");
    actionTd.className = "row-actions";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-chip-row";
    deleteButton.textContent = "\u5220\u9664";
    deleteButton.addEventListener("click", () => removeRowAt(rowIndex));

    actionTd.appendChild(deleteButton);
    tr.appendChild(actionTd);

    visibleColumns.forEach((column) => {
      tr.appendChild(buildEditableCell(rowIndex, column, row[column.key]));
    });

    previewBody.appendChild(tr);
    previewBody.appendChild(createInsertRow(rowIndex + 1, visibleColumns.length));
  });

  previewSummary.textContent = `\u5171 ${previewRows.length} \u884c\uff0c\u5f53\u524d\u663e\u793a ${visibleColumns.length} \u5217`;
  previewPanel.classList.remove("hidden");
  showPreviewPage();
  submitButton.disabled = false;
  updateWarnStatus();
}

function validateFile(file, { resetPreview = true } = {}) {
  if (!file) {
    submitButton.disabled = true;
    fileName.textContent = "\u5c1a\u672a\u9009\u62e9\u6587\u4ef6";
    clearPreview();
    return;
  }

  fileName.textContent = `\u5df2\u9009\u62e9\uff1a${file.name}`;
  if (resetPreview) {
    clearPreview();
  }

  if (!file.name.toLowerCase().endsWith(".docx")) {
    setMessage("\u4ec5\u652f\u6301\u4e0a\u4f20 .docx \u6587\u4ef6", "error");
    return;
  }
  setMessage("");
}

async function requestPreview(file) {
  const payload = new FormData();
  payload.append("file", file);

  const response = await fetch("/api/preview", {
    method: "POST",
    body: payload,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "\u9884\u89c8\u5931\u8d25");
  }

  loadPreviewRows(data.rows || []);
  renderPreview();
}

fileInput.addEventListener("change", async () => {
  const [file] = fileInput.files;
  validateFile(file);

  if (!file || !file.name.toLowerCase().endsWith(".docx")) {
    return;
  }

  submitButton.disabled = true;
  setMessage("\u6b63\u5728\u751f\u6210\u9884\u89c8\uff0c\u8bf7\u7a0d\u5019...", "");

  try {
    await requestPreview(file);
    setMessage("\u9884\u89c8\u5df2\u66f4\u65b0\uff0c\u53ef\u76f4\u63a5\u7f16\u8f91\u4e0e\u589e\u5220\u884c\u3002", "success");
  } catch (error) {
    clearPreview();
    setMessage(error.message || "\u9884\u89c8\u5931\u8d25", "error");
  } finally {
    submitButton.disabled = !previewRows.length;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const [file] = fileInput.files;
  if (!file) {
    setMessage("\u8bf7\u5148\u9009\u62e9\u4e00\u4e2a Word \u6587\u4ef6", "error");
    return;
  }

  if (!previewRows.length) {
    setMessage("\u8bf7\u5148\u9884\u89c8\u89e3\u6790\u7ed3\u679c\uff0c\u518d\u4e0b\u8f7d Excel\u3002", "error");
    return;
  }

  submitButton.disabled = true;
  setMessage("\u6b63\u5728\u751f\u6210 Excel\uff0c\u8bf7\u7a0d\u5019...", "");

  try {
    const response = await fetch("/api/export-rows", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_filename: file.name,
        columns: getExportColumns().map((column) => ({
          key: column.key,
          label: column.label,
        })),
        rows: previewRows,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "\u8f6c\u6362\u5931\u8d25");
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const disposition = response.headers.get("Content-Disposition") || "";
    const encodedNameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const plainNameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
    const downloadName = encodedNameMatch
      ? decodeURIComponent(encodedNameMatch[1])
      : plainNameMatch
        ? plainNameMatch[1]
        : `${file.name.replace(/\.docx$/i, "")}-\u914d\u8868.xlsx`;

    link.href = downloadUrl;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    setMessage("Excel \u5df2\u5f00\u59cb\u4e0b\u8f7d\u3002", "success");
  } catch (error) {
    setMessage(error.message || "\u8f6c\u6362\u5931\u8d25", "error");
  } finally {
    submitButton.disabled = !previewRows.length;
  }
});

/* Back button */
backButton.addEventListener("click", () => {
  showImportPage();
});

/* Settings panel */
settingsToggle.addEventListener("click", () => {
  settingsOverlay.classList.remove("hidden");
});

settingsClose.addEventListener("click", () => {
  settingsOverlay.classList.add("hidden");
});

settingsOverlay.addEventListener("click", (event) => {
  if (event.target === settingsOverlay) {
    settingsOverlay.classList.add("hidden");
  }
});

warnLengthEnabled.addEventListener("change", () => {
  settings.warnLength = warnLengthEnabled.checked;
  lastWarnIndex = -1;
  if (warnLengthEnabled.checked) {
    warnActionButton.disabled = false;
    warnActionButton.classList.add("active");
    warnActionButton.textContent = "\u4e0b\u4e00\u4e2a";
    updateWarnStatus();
  } else {
    warnActionButton.disabled = true;
    warnActionButton.classList.remove("active");
    warnActionButton.textContent = "\u5b57\u6570\u9884\u8b66";
    warnStatus.classList.add("hidden");
  }
  if (previewRows.length) {
    renderPreview();
  }
});

warnLengthThreshold.addEventListener("input", () => {
  const value = parseInt(warnLengthThreshold.value, 10);
  if (value > 0) {
    settings.warnThreshold = value;
    lastWarnIndex = -1;
    if (settings.warnLength && previewRows.length) {
      renderPreview();
    }
  }
});

/* Next warning row navigation */
function updateWarnStatus() {
  if (!settings.warnLength) {
    warnStatus.classList.add("hidden");
    return;
  }
  const tableShell = previewPanel.querySelector(".preview-table-shell");
  if (!tableShell) {
    warnStatus.classList.add("hidden");
    return;
  }
  const warnCells = tableShell.querySelectorAll(".warn-length");
  const warnRows = [];
  warnCells.forEach((cell) => {
    const row = cell.closest(".data-row");
    if (row && !warnRows.includes(row)) {
      warnRows.push(row);
    }
  });
  if (warnRows.length) {
    warnStatus.textContent = `\u5171 ${warnRows.length} \u884c\u8d85\u9650`;
    warnStatus.classList.remove("hidden");
  } else {
    warnStatus.textContent = "\u6240\u6709\u53f0\u8bcd\u5747\u7b26\u5408\u5b57\u6570\u8981\u6c42";
    warnStatus.classList.remove("hidden");
  }
}

warnActionButton.addEventListener("click", () => {
  if (!settings.warnLength) {
    setMessage("\u8bf7\u52fe\u9009\u5b57\u6570\u9884\u8b66", "error");
    return;
  }

  const tableShell = previewPanel.querySelector(".preview-table-shell");
  const warnCells = tableShell.querySelectorAll(".warn-length");

  if (!warnCells.length) {
    warnStatus.textContent = "\u6240\u6709\u53f0\u8bcd\u5747\u7b26\u5408\u5b57\u6570\u8981\u6c42";
    warnStatus.classList.remove("hidden");
    return;
  }

  const warnRows = [];
  warnCells.forEach((cell) => {
    const row = cell.closest(".data-row");
    if (row && !warnRows.includes(row)) {
      warnRows.push(row);
    }
  });

  if (!warnRows.length) {
    warnStatus.textContent = "\u6240\u6709\u53f0\u8bcd\u5747\u7b26\u5408\u5b57\u6570\u8981\u6c42";
    warnStatus.classList.remove("hidden");
    return;
  }

  lastWarnIndex++;
  if (lastWarnIndex >= warnRows.length) {
    lastWarnIndex = 0;
  }

  const targetRow = warnRows[lastWarnIndex];
  const shellTop = tableShell.getBoundingClientRect().top;
  const rowTop = targetRow.getBoundingClientRect().top;
  const headerHeight = tableShell.querySelector("thead").offsetHeight || 0;
  const offset = rowTop - shellTop + tableShell.scrollTop - headerHeight;

  tableShell.scrollTo({
    top: offset,
    behavior: "smooth",
  });

  warnStatus.textContent = `\u7b2c ${lastWarnIndex + 1}/${warnRows.length} \u4e2a\u8d85\u9650\u884c`;
  warnStatus.classList.remove("hidden");
});

/* AI Settings */
const aiApiKey = document.getElementById("ai-api-key");
const aiApiUrl = document.getElementById("ai-api-url");
const aiModelName = document.getElementById("ai-model-name");
const aiModelSelect = document.getElementById("ai-model-select");
const aiKeyToggle = document.getElementById("ai-key-toggle");
const aiFetchModels = document.getElementById("ai-fetch-models");
const aiSpeedTest = document.getElementById("ai-speed-test");
const aiTestConnection = document.getElementById("ai-test-connection");
const aiTestResult = document.getElementById("ai-test-result");

function setAiResult(text, type = "") {
  aiTestResult.textContent = text;
  aiTestResult.className = `settings-test-result ${type}`.trim();
}

function saveConfig() {
  const config = {
    ai_api_key: aiApiKey.value,
    ai_api_url: aiApiUrl.value,
    ai_model: aiModelName.value,
    warn_threshold: parseInt(warnLengthThreshold.value, 10) || 40,
  };
  fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) return;
    const config = await response.json();
    if (config.ai_api_key) aiApiKey.value = config.ai_api_key;
    if (config.ai_api_url) aiApiUrl.value = config.ai_api_url;
    if (config.ai_model) aiModelName.value = config.ai_model;
    if (config.warn_threshold) {
      warnLengthThreshold.value = config.warn_threshold;
      settings.warnThreshold = config.warn_threshold;
    }
    if (config.typo_prompt) {
      promptEditor.value = config.typo_prompt;
    }
    if (config.sfx_prompt) {
      sfxPromptEditor.value = config.sfx_prompt;
    }
  } catch (e) {
    // ignore load errors
  }
}

// Auto-save on input blur
aiApiKey.addEventListener("change", saveConfig);
aiApiUrl.addEventListener("change", saveConfig);
aiModelName.addEventListener("change", saveConfig);
warnLengthThreshold.addEventListener("change", saveConfig);

aiKeyToggle.addEventListener("click", () => {
  const isPassword = aiApiKey.type === "password";
  aiApiKey.type = isPassword ? "text" : "password";
  aiKeyToggle.textContent = isPassword ? "🙈" : "👁";
});

aiFetchModels.addEventListener("click", async () => {
  const apiUrl = aiApiUrl.value.trim();
  const apiKey = aiApiKey.value.trim();

  if (!apiUrl || !apiKey) {
    setAiResult("请先填写 API 地址和密钥", "error");
    return;
  }

  setAiResult("正在获取模型列表...", "");
  aiFetchModels.disabled = true;

  try {
    const response = await fetch("/api/ai/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_url: apiUrl, api_key: apiKey }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "获取失败");
    }

    const models = data.models || [];
    if (!models.length) {
      setAiResult("未获取到可用模型", "error");
      return;
    }

    aiModelSelect.innerHTML = '<option value="">-- 选择模型 --</option>';
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      aiModelSelect.appendChild(option);
    });

    aiModelSelect.classList.remove("hidden");
    setAiResult(`获取到 ${models.length} 个模型`, "success");
  } catch (error) {
    setAiResult(error.message || "获取失败", "error");
  } finally {
    aiFetchModels.disabled = false;
  }
});

aiModelSelect.addEventListener("change", () => {
  if (aiModelSelect.value) {
    aiModelName.value = aiModelSelect.value;
    saveConfig();
  }
});

aiTestConnection.addEventListener("click", async () => {
  const apiUrl = aiApiUrl.value.trim();
  const apiKey = aiApiKey.value.trim();
  const model = aiModelName.value.trim();

  if (!apiUrl || !apiKey) {
    setAiResult("请先填写 API 地址和密钥", "error");
    return;
  }
  if (!model) {
    setAiResult("请先填写模型名称", "error");
    return;
  }

  setAiResult("正在测试连接...", "");
  aiTestConnection.disabled = true;

  try {
    const response = await fetch("/api/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_url: apiUrl, api_key: apiKey, model: model }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "测试失败");
    }

    setAiResult(`连接成功，延迟 ${data.latency_ms}ms`, "success");
  } catch (error) {
    setAiResult(error.message || "连接失败", "error");
  } finally {
    aiTestConnection.disabled = false;
  }
});

aiSpeedTest.addEventListener("click", async () => {
  const apiUrl = aiApiUrl.value.trim();
  const apiKey = aiApiKey.value.trim();
  const model = aiModelName.value.trim();

  if (!apiUrl || !apiKey || !model) {
    setAiResult("请先完整填写 API 配置", "error");
    return;
  }

  setAiResult("正在测速...", "");
  aiSpeedTest.disabled = true;

  try {
    const results = [];
    for (let i = 0; i < 3; i++) {
      const response = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_url: apiUrl, api_key: apiKey, model: model }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "测速失败");
      }
      results.push(data.latency_ms);
    }
    const avg = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
    setAiResult(`测速完成，平均延迟 ${avg}ms (${results.join("/")}ms)`, "success");
  } catch (error) {
    setAiResult(error.message || "测速失败", "error");
  } finally {
    aiSpeedTest.disabled = false;
  }
});

/* AI Typo Detection */
function applyTypoFix(rowIndex, fieldKey, issue) {
  if (!previewRows[rowIndex]) return;
  const currentValue = previewRows[rowIndex][fieldKey] || "";
  const newValue = currentValue.replace(issue.original, issue.suggestion);
  previewRows[rowIndex][fieldKey] = newValue;

  // Remove this issue from typoIssues
  const idx = typoIssues.indexOf(issue);
  if (idx !== -1) typoIssues.splice(idx, 1);

  renderPreview();
  updateTypoStatus();
}

function updateTypoStatus() {
  if (!typoCheckEnabled.checked) {
    typoStatus.classList.add("hidden");
    return;
  }
  if (typoIssues.length > 0) {
    typoStatus.textContent = `\u5171 ${typoIssues.length} \u5904\u95ee\u9898`;
    typoStatus.classList.remove("hidden");
  } else {
    typoStatus.textContent = "\u672a\u53d1\u73b0\u9519\u5b57\u95ee\u9898";
    typoStatus.classList.remove("hidden");
  }
}

async function runTypoCheck() {
  typoActionButton.textContent = "\u68c0\u6d4b\u4e2d...";
  typoActionButton.disabled = true;
  typoStatus.textContent = "\u6b63\u5728\u68c0\u6d4b\uff0c\u8bf7\u7a0d\u5019...";
  typoStatus.classList.remove("hidden");

  const promptTemplate = promptEditor.value || DEFAULT_TYPO_PROMPT;

  try {
    const response = await fetch("/api/ai/check-typos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: previewRows,
        prompt: promptTemplate,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "\u68c0\u6d4b\u5931\u8d25");
    }

    typoIssues = data.issues || [];
    lastTypoIndex = -1;
    renderPreview();
    updateTypoStatus();

    if (typoIssues.length > 0) {
      typoActionButton.textContent = "\u4e0b\u4e00\u4e2a";
    } else {
      typoActionButton.textContent = "\u4e0b\u4e00\u4e2a";
    }
  } catch (error) {
    typoStatus.textContent = error.message || "\u68c0\u6d4b\u5931\u8d25";
    typoStatus.classList.remove("hidden");
    typoActionButton.textContent = "\u4e0b\u4e00\u4e2a";
  } finally {
    typoActionButton.disabled = false;
  }
}

typoCheckEnabled.addEventListener("change", () => {
  if (typoCheckEnabled.checked) {
    typoActionButton.disabled = false;
    typoActionButton.classList.add("active");
    typoActionButton.textContent = "\u4e0b\u4e00\u4e2a";
    if (previewRows.length && typoIssues.length === 0) {
      runTypoCheck();
    } else {
      updateTypoStatus();
    }
  } else {
    typoActionButton.disabled = true;
    typoActionButton.classList.remove("active");
    typoActionButton.textContent = "\u9519\u5b57\u68c0\u6d4b";
    typoIssues = [];
    lastTypoIndex = -1;
    typoStatus.classList.add("hidden");
    renderPreview();
  }
});

typoActionButton.addEventListener("click", () => {
  if (!typoCheckEnabled.checked) {
    setMessage("\u8bf7\u52fe\u9009 AI \u68c0\u6d4b", "error");
    return;
  }

  if (typoIssues.length === 0) {
    typoStatus.textContent = "\u672a\u53d1\u73b0\u9519\u5b57\u95ee\u9898";
    typoStatus.classList.remove("hidden");
    return;
  }

  lastTypoIndex++;
  if (lastTypoIndex >= typoIssues.length) {
    lastTypoIndex = 0;
  }

  const issue = typoIssues[lastTypoIndex];
  const tableShell = previewPanel.querySelector(".preview-table-shell");
  const typoRows = tableShell.querySelectorAll(".typo-highlight");

  // Find the row that matches this issue's line
  const dataRows = tableShell.querySelectorAll(".data-row");
  const targetRow = dataRows[issue.line - 1];

  if (targetRow) {
    const shellTop = tableShell.getBoundingClientRect().top;
    const rowTop = targetRow.getBoundingClientRect().top;
    const headerHeight = tableShell.querySelector("thead").offsetHeight || 0;
    const offset = rowTop - shellTop + tableShell.scrollTop - headerHeight;

    tableShell.scrollTo({
      top: offset,
      behavior: "smooth",
    });
  }

  typoStatus.textContent = `\u7b2c ${lastTypoIndex + 1}/${typoIssues.length} \u5904\u95ee\u9898`;
  typoStatus.classList.remove("hidden");
});

/* Prompt editor */
promptEditor.value = DEFAULT_TYPO_PROMPT;
sfxPromptEditor.value = DEFAULT_SFX_PROMPT;

promptUnlock.addEventListener("change", () => {
  if (promptUnlock.checked) {
    promptEditor.removeAttribute("readonly");
    promptSave.disabled = false;
  } else {
    promptEditor.setAttribute("readonly", "");
    promptSave.disabled = true;
  }
});

promptSave.addEventListener("click", () => {
  const config = {
    typo_prompt: promptEditor.value,
  };
  fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  setAiResult("\u63d0\u793a\u8bcd\u5df2\u4fdd\u5b58", "success");
  promptUnlock.checked = false;
  promptEditor.setAttribute("readonly", "");
  promptSave.disabled = true;
});

/* SFX prompt editor */
sfxPromptUnlock.addEventListener("change", () => {
  if (sfxPromptUnlock.checked) {
    sfxPromptEditor.removeAttribute("readonly");
    sfxPromptSave.disabled = false;
  } else {
    sfxPromptEditor.setAttribute("readonly", "");
    sfxPromptSave.disabled = true;
  }
});

sfxPromptSave.addEventListener("click", () => {
  const config = {
    sfx_prompt: sfxPromptEditor.value,
  };
  fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  setAiResult("\u97f3\u6548\u63d0\u793a\u8bcd\u5df2\u4fdd\u5b58", "success");
  sfxPromptUnlock.checked = false;
  sfxPromptEditor.setAttribute("readonly", "");
  sfxPromptSave.disabled = true;
});

/* SFX generation */
async function runSfxGeneration() {
  sfxActionButton.textContent = "\u751f\u6210\u4e2d...";
  sfxActionButton.disabled = true;
  sfxStatus.textContent = "\u6b63\u5728\u751f\u6210\uff0c\u8bf7\u7a0d\u5019...";
  sfxStatus.classList.remove("hidden");

  const promptTemplate = sfxPromptEditor.value || DEFAULT_SFX_PROMPT;

  try {
    const response = await fetch("/api/ai/generate-sfx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: previewRows,
        prompt: promptTemplate,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "\u751f\u6210\u5931\u8d25");
    }

    const sfxList = data.sfx || [];
    let filled = 0;
    sfxList.forEach((item) => {
      const idx = item.line - 1;
      if (idx >= 0 && idx < previewRows.length && !sfxLocks[idx]) {
        previewRows[idx].sfx = item.sfx || "";
        if (item.sfx) filled++;
      }
    });

    sfxVisible = true;
    renderPreview();

    if (filled > 0) {
      sfxStatus.textContent = `\u5df2\u751f\u6210 ${filled} \u5904\u97f3\u6548`;
    } else {
      sfxStatus.textContent = "AI \u672a\u5efa\u8bae\u6dfb\u52a0\u97f3\u6548";
    }
    sfxStatus.classList.remove("hidden");
    sfxActionButton.textContent = "\u91cd\u65b0\u751f\u6210";
  } catch (error) {
    sfxStatus.textContent = error.message || "\u751f\u6210\u5931\u8d25";
    sfxStatus.classList.remove("hidden");
    sfxActionButton.textContent = "\u91cd\u65b0\u751f\u6210";
  } finally {
    sfxActionButton.disabled = false;
  }
}

sfxEnabled.addEventListener("change", () => {
  if (sfxEnabled.checked) {
    sfxActionButton.disabled = false;
    sfxActionButton.classList.add("active");
    sfxActionButton.textContent = "\u91cd\u65b0\u751f\u6210";
    sfxClearButton.classList.remove("hidden");
    sfxVisible = true;
    if (previewRows.length) {
      runSfxGeneration();
    }
  } else {
    sfxActionButton.disabled = true;
    sfxActionButton.classList.remove("active");
    sfxActionButton.textContent = "\u97f3\u6548\u6587\u672c";
    sfxClearButton.classList.add("hidden");
    sfxStatus.classList.add("hidden");
    if (previewRows.length) {
      renderPreview();
    }
  }
});

sfxActionButton.addEventListener("click", () => {
  if (!sfxEnabled.checked) return;
  if (previewRows.length) {
    runSfxGeneration();
  }
});

sfxClearButton.addEventListener("click", () => {
  if (!window.confirm("\u786e\u8ba4\u6e05\u7a7a\u6240\u6709\u97f3\u6548\u5185\u5bb9\uff1f")) return;
  previewRows.forEach((row) => { row.sfx = ""; });
  sfxLocks = sfxLocks.map(() => false);
  renderPreview();
  sfxStatus.textContent = "\u5df2\u6e05\u7a7a\u6240\u6709\u97f3\u6548";
  sfxStatus.classList.remove("hidden");
});

/* Load saved config on startup */
loadConfig();

/* Changelog overlay */
const versionBtn = document.getElementById("version-btn");
const changelogOverlay = document.getElementById("changelog-overlay");
const changelogClose = document.getElementById("changelog-close");
const changelogBody = document.getElementById("changelog-body");

// Load version info from backend
(async function loadVersionInfo() {
  try {
    const resp = await fetch("/api/version");
    if (!resp.ok) return;
    const data = await resp.json();

    // Update version button text
    if (data.version) {
      versionBtn.textContent = `v${data.version}`;
    }

    // Render changelog entries
    if (Array.isArray(data.entries)) {
      changelogBody.innerHTML = data.entries
        .map(
          (entry) => `
        <div class="changelog-entry">
          <h3 class="changelog-version">v${entry.version}</h3>
          <ul class="changelog-list">
            ${entry.changes.map((c) => `<li>${c}</li>`).join("")}
          </ul>
        </div>`
        )
        .join("");
    }
  } catch (e) {
    // Silently fail — button stays as "v..."
  }
})();

versionBtn.addEventListener("click", () => {
  changelogOverlay.classList.remove("hidden");
});

changelogClose.addEventListener("click", () => {
  changelogOverlay.classList.add("hidden");
});

changelogOverlay.addEventListener("click", (event) => {
  if (event.target === changelogOverlay) {
    changelogOverlay.classList.add("hidden");
  }
});

