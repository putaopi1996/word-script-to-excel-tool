/* ===== SFX ID Matching Tool ===== */

// ===== Tab Navigation =====
const tabBar = document.querySelector(".tab-bar");
const tabItems = document.querySelectorAll(".tab-item");
const tabContents = document.querySelectorAll(".tab-content");

tabItems.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    tabItems.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    tabContents.forEach((content) => {
      if (content.dataset.tab === target) {
        content.classList.remove("hidden");
      } else {
        content.classList.add("hidden");
      }
    });
  });
});

// ===== SFX Dictionary Management =====
const sfxDictBody = document.getElementById("sfx-dict-body");
const sfxDictSearch = document.getElementById("sfx-dict-search");
const sfxDictCount = document.getElementById("sfx-dict-count");
const sfxDictAddRow = document.getElementById("sfx-dict-add-row");
const sfxDictClear = document.getElementById("sfx-dict-clear");
const sfxDictSave = document.getElementById("sfx-dict-save");
const sfxDictNext = document.getElementById("sfx-dict-next");
const sfxDictMessage = document.getElementById("sfx-dict-message");

let sfxDictionary = []; // [{name, id}]

function setSfxDictMessage(text, type = "") {
  sfxDictMessage.textContent = text;
  sfxDictMessage.className = `message ${type}`.trim();
}

function updateDictCount() {
  sfxDictCount.textContent = `共 ${sfxDictionary.length} 条`;
}

function renderDictTable(filter = "") {
  sfxDictBody.innerHTML = "";
  const lowerFilter = filter.toLowerCase();

  sfxDictionary.forEach((entry, index) => {
    const matchesFilter =
      !lowerFilter ||
      entry.name.toLowerCase().includes(lowerFilter) ||
      entry.id.toLowerCase().includes(lowerFilter);

    if (!matchesFilter) return;

    const tr = document.createElement("tr");
    tr.dataset.index = index;

    const tdId = document.createElement("td");
    const inputId = document.createElement("input");
    inputId.type = "text";
    inputId.className = "sfx-dict-input";
    inputId.value = entry.id;
    inputId.placeholder = "音效ID";
    inputId.addEventListener("input", () => {
      sfxDictionary[index].id = inputId.value;
    });
    tdId.appendChild(inputId);

    const tdName = document.createElement("td");
    const inputName = document.createElement("input");
    inputName.type = "text";
    inputName.className = "sfx-dict-input";
    inputName.value = entry.name;
    inputName.placeholder = "文件名称";
    inputName.addEventListener("input", () => {
      sfxDictionary[index].name = inputName.value;
    });
    tdName.appendChild(inputName);

    const tdAction = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-chip-row";
    deleteBtn.textContent = "删除";
    deleteBtn.addEventListener("click", () => {
      sfxDictionary.splice(index, 1);
      renderDictTable(sfxDictSearch.value);
      updateDictCount();
    });
    tdAction.appendChild(deleteBtn);

    tr.appendChild(tdId);
    tr.appendChild(tdName);
    tr.appendChild(tdAction);
    sfxDictBody.appendChild(tr);
  });

  updateDictCount();
}

// Add new row
sfxDictAddRow.addEventListener("click", () => {
  sfxDictionary.push({ name: "", id: "" });
  renderDictTable(sfxDictSearch.value);
  // Focus the last name input
  const inputs = sfxDictBody.querySelectorAll(".sfx-dict-input");
  if (inputs.length >= 2) {
    inputs[inputs.length - 2].focus();
  }
});

// Search/filter
sfxDictSearch.addEventListener("input", () => {
  renderDictTable(sfxDictSearch.value);
});

// Clear dictionary
sfxDictClear.addEventListener("click", () => {
  if (!sfxDictionary.length) return;
  if (!window.confirm("确认清空所有字典条目？此操作不可恢复。")) return;
  sfxDictionary = [];
  renderDictTable();
  setSfxDictMessage("字典已清空。", "success");
});

// Save dictionary
sfxDictSave.addEventListener("click", async () => {
  // Client-side duplicate check with highlighting
  const nameMap = {};
  let hasDuplicates = false;
  const duplicateIndices = new Set();

  sfxDictionary.forEach((entry, i) => {
    const name = entry.name.trim();
    if (!name) return;
    if (nameMap[name] !== undefined) {
      hasDuplicates = true;
      duplicateIndices.add(nameMap[name]);
      duplicateIndices.add(i);
    } else {
      nameMap[name] = i;
    }
  });

  // Clear previous highlights
  sfxDictBody.querySelectorAll("tr").forEach((tr) => tr.classList.remove("dict-duplicate"));

  if (hasDuplicates) {
    // Highlight duplicates
    sfxDictBody.querySelectorAll("tr").forEach((tr) => {
      const idx = parseInt(tr.dataset.index, 10);
      if (duplicateIndices.has(idx)) {
        tr.classList.add("dict-duplicate");
      }
    });

    // Scroll to first duplicate
    const firstDup = sfxDictBody.querySelector(".dict-duplicate");
    if (firstDup) {
      firstDup.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    setSfxDictMessage("存在重复的音效名称，请先处理重复项。", "error");
    return;
  }

  // Save to server
  try {
    const response = await fetch("/api/sfx-dict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dictionary: sfxDictionary }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "保存失败");
    }

    setSfxDictMessage(`字典已保存，共 ${data.count} 条。`, "success");
  } catch (error) {
    setSfxDictMessage(error.message || "保存失败", "error");
  }
});

// Next step
sfxDictNext.addEventListener("click", () => {
  if (!sfxDictionary.length) {
    setSfxDictMessage("字典为空，请先添加音效映射。", "error");
    return;
  }

  // Check if there are unsaved changes by comparing with server
  showSfxMatchPanel();
});

// Paste handler for dictionary (batch import from Excel)
const sfxDictTableShell = document.querySelector(".sfx-dict-table-shell");
sfxDictTableShell.addEventListener("paste", (e) => {
  const text = e.clipboardData.getData("text/plain");
  if (!text || !text.includes("\t")) return;

  e.preventDefault();
  const lines = text.split("\n").filter((l) => l.trim());
  let added = 0;

  lines.forEach((line) => {
    const parts = line.split("\t");
    if (parts.length >= 2) {
      const id = parts[0].trim();
      const name = parts[1].trim();
      if (name || id) {
        sfxDictionary.push({ name, id });
        added++;
      }
    }
  });

  if (added > 0) {
    renderDictTable(sfxDictSearch.value);
    setSfxDictMessage(`已粘贴导入 ${added} 条数据。`, "success");
  }
});

// Load dictionary on startup
async function loadSfxDictionary() {
  try {
    const response = await fetch("/api/sfx-dict");
    if (!response.ok) return;
    const data = await response.json();
    sfxDictionary = data.dictionary || [];
    renderDictTable();
  } catch (e) {
    // ignore load errors
  }
}

// ===== SFX Match Panel =====
const sfxMatchPanel = document.getElementById("sfx-match-panel");
const sfxDictPanel = document.getElementById("sfx-dict-panel");
const sfxMatchBack = document.getElementById("sfx-match-back");
const sfxMatchSummary = document.getElementById("sfx-match-summary");
const sfxMatchFileInput = document.getElementById("sfx-match-file-input");
const sfxMatchImportArea = document.getElementById("sfx-match-import-area");
const sfxMatchColSelect = document.getElementById("sfx-match-col-select");
const sfxMatchTableArea = document.getElementById("sfx-match-table-area");
const sfxMatchBody = document.getElementById("sfx-match-body");
const sfxMatchNameCol = document.getElementById("sfx-match-name-col");
const sfxMatchIdCol = document.getElementById("sfx-match-id-col");
const sfxMatchConfirmCols = document.getElementById("sfx-match-confirm-cols");
const sfxMatchRematch = document.getElementById("sfx-match-rematch");
const sfxMatchNextUnmatched = document.getElementById("sfx-match-next-unmatched");
const sfxMatchNavStatus = document.getElementById("sfx-match-nav-status");
const sfxMatchExport = document.getElementById("sfx-match-export");
const sfxMatchImportMessage = document.getElementById("sfx-match-import-message");

let sfxMatchImportedHeaders = [];
let sfxMatchImportedRows = [];
let sfxMatchRows = []; // [{sfx_name, sfx_id, matched}]
let sfxMatchSourceFilename = "音效匹配.xlsx";
let lastUnmatchedIndex = -1;

function showSfxMatchPanel() {
  sfxDictPanel.classList.add("hidden");
  sfxMatchPanel.classList.remove("hidden");
}

function showSfxDictPanel() {
  sfxMatchPanel.classList.add("hidden");
  sfxDictPanel.classList.remove("hidden");
}

sfxMatchBack.addEventListener("click", () => {
  showSfxDictPanel();
});

function setSfxMatchImportMessage(text, type = "") {
  sfxMatchImportMessage.textContent = text;
  sfxMatchImportMessage.className = `message ${type}`.trim();
}

// File upload
sfxMatchFileInput.addEventListener("click", () => {
  // Reset value so selecting the same file triggers change again
  sfxMatchFileInput.value = "";
});

sfxMatchFileInput.addEventListener("change", async () => {
  const [file] = sfxMatchFileInput.files;
  if (!file) return;

  setSfxMatchImportMessage("正在解析 Excel...", "");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/sfx-match/import", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "导入失败");
    }

    sfxMatchImportedHeaders = data.headers;
    sfxMatchImportedRows = data.rows;
    sfxMatchSourceFilename = data.filename || "音效匹配.xlsx";
    showColumnSelection();
    setSfxMatchImportMessage("", "");
  } catch (error) {
    setSfxMatchImportMessage(error.message || "导入失败", "error");
  }
});

// Paste handler for match import area
const sfxMatchImportAreaEl = document.getElementById("sfx-match-import-area");
sfxMatchImportAreaEl.addEventListener("paste", (e) => {
  const text = e.clipboardData.getData("text/plain");
  if (!text) return;

  e.preventDefault();
  // Split by line breaks, preserve empty rows (they represent empty Excel rows)
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Remove only the trailing empty line (Excel always adds one)
  if (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  if (lines.length < 1) return;

  // Parse tab-separated, keep empty cells as-is
  const allRows = lines.map((line) => line.split("\t"));

  // First row as headers
  sfxMatchImportedHeaders = allRows[0].map((cell) => cell.trim());
  sfxMatchImportedRows = allRows.slice(1).map((row) => row.map((cell) => cell.trim()));
  sfxMatchSourceFilename = "粘贴数据.xlsx";

  showColumnSelection();
  setSfxMatchImportMessage("", "");
});

function showColumnSelection() {
  sfxMatchImportArea.classList.add("hidden");
  sfxMatchColSelect.classList.remove("hidden");
  sfxMatchTableArea.classList.add("hidden");

  // Populate column selects
  sfxMatchNameCol.innerHTML = "";
  sfxMatchIdCol.innerHTML = '<option value="">-- 不选择 --</option>';

  sfxMatchImportedHeaders.forEach((header, i) => {
    const opt1 = document.createElement("option");
    opt1.value = i;
    opt1.textContent = header || `列 ${i + 1}`;
    sfxMatchNameCol.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = i;
    opt2.textContent = header || `列 ${i + 1}`;
    sfxMatchIdCol.appendChild(opt2);
  });
}

// Confirm column selection and do matching
sfxMatchConfirmCols.addEventListener("click", () => {
  const nameColIdx = parseInt(sfxMatchNameCol.value, 10);
  const idColIdx = sfxMatchIdCol.value !== "" ? parseInt(sfxMatchIdCol.value, 10) : -1;

  // Build match rows
  sfxMatchRows = sfxMatchImportedRows.map((row) => {
    const sfxName = (row[nameColIdx] || "").trim();
    const existingId = idColIdx >= 0 ? (row[idColIdx] || "").trim() : "";
    return {
      sfx_name: sfxName,
      sfx_id: existingId,
      matched: false,
      original_id: existingId, // Track if it had an ID from import
    };
  });

  // Run matching
  runMatching();

  // Show table
  sfxMatchColSelect.classList.add("hidden");
  sfxMatchTableArea.classList.remove("hidden");
  sfxMatchRematch.disabled = false;
  sfxMatchExport.disabled = false;
});

function runMatching() {
  // Build dictionary lookup
  const dictMap = {};
  sfxDictionary.forEach((entry) => {
    const name = entry.name.trim();
    if (name) {
      dictMap[name] = entry.id;
    }
  });

  let matchedCount = 0;
  let unmatchedCount = 0;

  sfxMatchRows.forEach((row) => {
    // Only match if the cell is empty (no existing ID)
    if (!row.sfx_id) {
      const lookupName = row.sfx_name.trim();
      if (dictMap[lookupName] !== undefined) {
        row.sfx_id = dictMap[lookupName];
        row.matched = true;
        matchedCount++;
      } else {
        row.matched = false;
        if (lookupName) unmatchedCount++;
      }
    } else {
      row.matched = true; // Already has ID (from import or manual)
      matchedCount++;
    }
  });

  const total = sfxMatchRows.length;
  sfxMatchSummary.textContent = `共 ${total} 条，已匹配 ${matchedCount} 条，未匹配 ${unmatchedCount} 条`;

  // Update navigation button
  lastUnmatchedIndex = -1;
  updateUnmatchedNavigation();

  renderMatchTable();

  if (unmatchedCount > 0) {
    sfxMatchNavStatus.textContent = `${unmatchedCount} 条未匹配`;
    sfxMatchNavStatus.classList.remove("hidden");
  } else {
    sfxMatchNavStatus.textContent = "全部匹配完成";
    sfxMatchNavStatus.classList.remove("hidden");
  }
}

function getUnmatchedIndices() {
  const indices = [];
  sfxMatchRows.forEach((row, i) => {
    if (!row.sfx_id && row.sfx_name.trim()) {
      indices.push(i);
    }
  });
  return indices;
}

function updateUnmatchedNavigation() {
  const unmatched = getUnmatchedIndices();
  sfxMatchNextUnmatched.disabled = unmatched.length === 0;
}

function renderMatchTable() {
  sfxMatchBody.innerHTML = "";

  sfxMatchRows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.className = "data-row";

    const isUnmatched = !row.sfx_id && row.sfx_name.trim();
    if (isUnmatched) {
      tr.classList.add("sfx-unmatched");
    }

    // Index column
    const tdIdx = document.createElement("td");
    tdIdx.className = "sfx-match-idx-cell";
    tdIdx.textContent = index + 1;
    tr.appendChild(tdIdx);

    // ID column
    const tdId = document.createElement("td");
    tdId.className = "sfx-match-id-cell";
    const idInput = document.createElement("input");
    idInput.type = "text";
    idInput.className = "preview-input";
    idInput.value = row.sfx_id;
    idInput.placeholder = isUnmatched ? "(未匹配)" : "";
    idInput.addEventListener("input", () => {
      sfxMatchRows[index].sfx_id = idInput.value;
      // If user manually fills in, update styling
      if (idInput.value.trim()) {
        tr.classList.remove("sfx-unmatched");
        sfxMatchRows[index].matched = true;
      } else {
        if (sfxMatchRows[index].sfx_name.trim()) {
          tr.classList.add("sfx-unmatched");
          sfxMatchRows[index].matched = false;
        }
      }
      updateMatchSummary();
      updateUnmatchedNavigation();
    });
    tdId.appendChild(idInput);
    tr.appendChild(tdId);

    // Name column
    const tdName = document.createElement("td");
    tdName.className = "sfx-match-name-cell";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "preview-input";
    nameInput.value = row.sfx_name;
    nameInput.addEventListener("input", () => {
      sfxMatchRows[index].sfx_name = nameInput.value;
    });
    tdName.appendChild(nameInput);
    tr.appendChild(tdName);

    sfxMatchBody.appendChild(tr);
  });
}

function updateMatchSummary() {
  let matchedCount = 0;
  let unmatchedCount = 0;

  sfxMatchRows.forEach((row) => {
    if (row.sfx_id && row.sfx_id.trim()) {
      matchedCount++;
    } else if (row.sfx_name.trim()) {
      unmatchedCount++;
    }
  });

  const total = sfxMatchRows.length;
  sfxMatchSummary.textContent = `共 ${total} 条，已匹配 ${matchedCount} 条，未匹配 ${unmatchedCount} 条`;

  if (unmatchedCount > 0) {
    sfxMatchNavStatus.textContent = `${unmatchedCount} 条未匹配`;
    sfxMatchNavStatus.classList.remove("hidden");
  } else {
    sfxMatchNavStatus.textContent = "全部匹配完成";
    sfxMatchNavStatus.classList.remove("hidden");
  }
}

// Navigate to next unmatched
sfxMatchNextUnmatched.addEventListener("click", () => {
  const unmatched = getUnmatchedIndices();
  if (!unmatched.length) return;

  lastUnmatchedIndex++;
  if (lastUnmatchedIndex >= unmatched.length) {
    lastUnmatchedIndex = 0;
  }

  const targetRowIndex = unmatched[lastUnmatchedIndex];
  const tableShell = sfxMatchTableArea.querySelector(".preview-table-shell");
  const dataRows = tableShell.querySelectorAll(".data-row");
  const targetRow = dataRows[targetRowIndex];

  if (targetRow) {
    const shellTop = tableShell.getBoundingClientRect().top;
    const rowTop = targetRow.getBoundingClientRect().top;
    const headerHeight = tableShell.querySelector("thead").offsetHeight || 0;
    const offset = rowTop - shellTop + tableShell.scrollTop - headerHeight;

    tableShell.scrollTo({ top: offset, behavior: "smooth" });

    // Brief highlight animation
    targetRow.classList.add("sfx-flash");
    setTimeout(() => targetRow.classList.remove("sfx-flash"), 1200);
  }

  sfxMatchNavStatus.textContent = `第 ${lastUnmatchedIndex + 1}/${unmatched.length} 个未匹配`;
  sfxMatchNavStatus.classList.remove("hidden");
});

// Re-match
sfxMatchRematch.addEventListener("click", () => {
  // Clear IDs that were matched (not originally imported or manually filled with different intent)
  sfxMatchRows.forEach((row) => {
    if (row.matched && !row.original_id) {
      // This was matched by dictionary, clear it for re-matching
      row.sfx_id = "";
      row.matched = false;
    }
  });
  runMatching();
});

// Export
sfxMatchExport.addEventListener("click", async () => {
  if (!sfxMatchRows.length) return;

  sfxMatchExport.disabled = true;
  sfxMatchExport.textContent = "导出中...";

  try {
    const response = await fetch("/api/sfx-match/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: sfxMatchRows.map((r) => ({ sfx_name: r.sfx_name, sfx_id: r.sfx_id })),
        source_filename: sfxMatchSourceFilename,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "导出失败");
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
        : "音效匹配-已匹配.xlsx";

    link.href = downloadUrl;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    alert(error.message || "导出失败");
  } finally {
    sfxMatchExport.disabled = false;
    sfxMatchExport.textContent = "导出 Excel";
  }
});

// ===== Init =====
loadSfxDictionary();
