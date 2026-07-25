const STORAGE_KEY = "lifelog.entries";

// AIひとことコメントを生成するVercelサーバーレス関数のURL
const AI_COMMENT_API_URL = "https://life-log-self.vercel.app/api/comment";

const MOOD_EMOJI = {
  great: "😄",
  good: "🙂",
  normal: "😐",
  bad: "😔",
  worst: "😣",
};

const MOOD_LABEL = {
  great: "最高",
  good: "良い",
  normal: "普通",
  bad: "微妙",
  worst: "最悪",
};

const state = {
  mood: null,
  activities: new Set(),
  editingId: null,
};

const entryDateTime = document.getElementById("entryDateTime");
const moodGroup = document.getElementById("moodGroup");
const activityGroup = document.getElementById("activityGroup");
const activityCustom = document.getElementById("activityCustom");
const memoInput = document.getElementById("memoInput");
const saveBtn = document.getElementById("saveBtn");
const historyList = document.getElementById("historyList");
const toast = document.getElementById("toast");
const todayLabel = document.getElementById("todayLabel");
const formHeader = document.getElementById("formHeader");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const formCard = document.querySelector(".card");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const shareTextBtn = document.getElementById("shareTextBtn");

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function formatDateLabel(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "今日";
  if (sameDay(date, yesterday)) return "昨日";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatFullDateLabel(date) {
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${weekday})`;
}

// メモ帳などに貼り付けやすいプレーンテキストの日記形式に変換する
function buildEntriesText(entries) {
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);

  const groups = new Map();
  for (const entry of sorted) {
    const date = new Date(entry.timestamp);
    const key = date.toDateString();
    if (!groups.has(key)) groups.set(key, { date, items: [] });
    groups.get(key).items.push(entry);
  }

  const lines = ["ライフログ"];
  for (const { date, items } of groups.values()) {
    lines.push("", formatFullDateLabel(date));
    for (const entry of items) {
      const moodText = `${MOOD_EMOJI[entry.mood] || ""} ${MOOD_LABEL[entry.mood] || entry.mood}`;
      const tagsText = entry.activities.length > 0 ? ` ｜ ${entry.activities.join("、")}` : "";
      lines.push(`${moodText}${tagsText}`);
      if (entry.memo) lines.push(entry.memo);
      if (entry.aiComment) lines.push(`💬 ${entry.aiComment}`);
    }
  }
  return lines.join("\n");
}

function downloadTextFile(text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lifelog-${dateStr}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toDateInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "YYYY-MM-DD" をタイムゾーンのずれなくローカル日付として解釈する
function parseDateInputValue(value) {
  if (!value) return new Date();
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function renderHistory() {
  const entries = loadEntries().sort((a, b) => b.timestamp - a.timestamp);

  if (entries.length === 0) {
    historyList.innerHTML = `<div class="empty-state">まだ記録がありません</div>`;
    return;
  }

  const groups = new Map();
  for (const entry of entries) {
    const date = new Date(entry.timestamp);
    const key = date.toDateString();
    if (!groups.has(key)) groups.set(key, { date, items: [] });
    groups.get(key).items.push(entry);
  }

  let html = "";
  for (const { date, items } of groups.values()) {
    html += `<div class="history-day">`;
    html += `<div class="history-day-label">${formatDateLabel(date)}</div>`;
    for (const entry of items) {
      const tagsHtml = entry.activities
        .map((activity) => `<span class="entry-tag">${escapeHtml(activity)}</span>`)
        .join("");
      html += `
        <div class="entry" data-entry-id="${entry.id}">
          <div class="entry-mood">${MOOD_EMOJI[entry.mood] || ""}</div>
          <div class="entry-body">
            ${tagsHtml ? `<div class="entry-tags">${tagsHtml}</div>` : ""}
            ${entry.memo ? `<div class="entry-memo">${escapeHtml(entry.memo)}</div>` : ""}
            ${entry.aiComment ? `<div class="entry-ai-comment">${escapeHtml(entry.aiComment)}</div>` : ""}
          </div>
          <button type="button" class="entry-edit" data-id="${entry.id}">✎</button>
          <button type="button" class="entry-delete" data-id="${entry.id}">×</button>
        </div>`;
    }
    html += `</div>`;
  }
  historyList.innerHTML = html;
}

function scrollToEntry(id) {
  const el = historyList.querySelector(`[data-entry-id="${id}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function fetchAiComment(mood, activities, memo) {
  try {
    const response = await fetch(AI_COMMENT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood, activities, memo }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.comment === "string" ? data.comment : null;
  } catch {
    return null;
  }
}

// 記録を待たせないよう、AIコメントは保存・表示のあとに非同期で取得して追記する
function requestAiComment(id, mood, activities, memo) {
  fetchAiComment(mood, activities, memo).then((comment) => {
    if (!comment) return;
    const entries = loadEntries();
    const index = entries.findIndex((entry) => entry.id === id);
    if (index === -1) return;
    entries[index] = { ...entries[index], aiComment: comment };
    saveEntries(entries);
    renderHistory();
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1400);
}

function resetForm() {
  state.mood = null;
  state.activities.clear();
  state.editingId = null;
  moodGroup.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("selected"));
  activityGroup.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
  activityCustom.value = "";
  memoInput.value = "";
  entryDateTime.value = toDateInputValue(new Date());
  formHeader.hidden = true;
  saveBtn.textContent = "記録する";
}

function startEdit(entry) {
  state.mood = entry.mood;
  state.activities = new Set();
  moodGroup.querySelectorAll(".mood-btn").forEach((b) => {
    b.classList.toggle("selected", b.dataset.mood === entry.mood);
  });

  const knownActivities = new Set(
    Array.from(activityGroup.querySelectorAll(".chip")).map((c) => c.dataset.activity)
  );
  const customActivities = [];
  for (const activity of entry.activities) {
    if (knownActivities.has(activity)) {
      state.activities.add(activity);
    } else {
      customActivities.push(activity);
    }
  }
  activityGroup.querySelectorAll(".chip").forEach((c) => {
    c.classList.toggle("selected", state.activities.has(c.dataset.activity));
  });
  activityCustom.value = customActivities.join("、");
  memoInput.value = entry.memo || "";
  entryDateTime.value = toDateInputValue(new Date(entry.timestamp));

  state.editingId = entry.id;
  formHeader.hidden = false;
  saveBtn.textContent = "更新する";
  formCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

moodGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".mood-btn");
  if (!btn) return;
  const mood = btn.dataset.mood;
  const wasSelected = btn.classList.contains("selected");
  moodGroup.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("selected"));
  if (wasSelected) {
    state.mood = null;
  } else {
    btn.classList.add("selected");
    state.mood = mood;
  }
});

activityGroup.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  const activity = chip.dataset.activity;
  chip.classList.toggle("selected");
  if (chip.classList.contains("selected")) {
    state.activities.add(activity);
  } else {
    state.activities.delete(activity);
  }
});

saveBtn.addEventListener("click", () => {
  if (!state.mood) {
    showToast("気分を選んでください");
    return;
  }

  const activities = Array.from(state.activities);
  const custom = activityCustom.value.trim();
  if (custom) {
    custom.split(/[、,]/).map((s) => s.trim()).filter(Boolean).forEach((a) => activities.push(a));
  }

  const parsedDate = parseDateInputValue(entryDateTime.value);
  const timestamp = isNaN(parsedDate.getTime()) ? Date.now() : parsedDate.getTime();

  const entries = loadEntries();

  if (state.editingId) {
    const editedId = state.editingId;
    const editedMood = state.mood;
    const editedMemo = memoInput.value.trim();
    const index = entries.findIndex((entry) => entry.id === editedId);
    if (index !== -1) {
      entries[index] = {
        ...entries[index],
        timestamp,
        mood: editedMood,
        activities,
        memo: editedMemo,
      };
    }
    saveEntries(entries);
    resetForm();
    renderHistory();
    showToast("更新しました");
    scrollToEntry(editedId);
    requestAiComment(editedId, editedMood, activities, editedMemo);
    return;
  }

  const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const newMood = state.mood;
  const memo = memoInput.value.trim();
  entries.push({
    id: newId,
    timestamp,
    mood: newMood,
    activities,
    memo,
  });
  saveEntries(entries);

  resetForm();
  renderHistory();
  showToast("記録しました");
  scrollToEntry(newId);
  requestAiComment(newId, newMood, activities, memo);
});

cancelEditBtn.addEventListener("click", () => {
  resetForm();
});

historyList.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".entry-edit");
  if (editBtn) {
    const id = editBtn.dataset.id;
    const entry = loadEntries().find((entry) => entry.id === id);
    if (entry) startEdit(entry);
    return;
  }

  const deleteBtn = e.target.closest(".entry-delete");
  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    const entries = loadEntries().filter((entry) => entry.id !== id);
    saveEntries(entries);
    if (state.editingId === id) resetForm();
    renderHistory();
  }
});

shareTextBtn.addEventListener("click", async () => {
  const entries = loadEntries();
  if (entries.length === 0) {
    showToast("まだ記録がありません");
    return;
  }
  const text = buildEntriesText(entries);

  // iPhoneなど共有シートがあれば、そこから直接「メモ」アプリへ渡せる
  if (navigator.share) {
    try {
      await navigator.share({ title: "ライフログ", text });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
      // 共有に失敗した場合はクリップボード経由にフォールバックする
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast("コピーしました。メモ帳に貼り付けてください");
  } catch {
    downloadTextFile(text);
    showToast("ファイルとして書き出しました");
  }
});

exportBtn.addEventListener("click", () => {
  const entries = loadEntries();
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lifelog-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("書き出しました");
});

importBtn.addEventListener("click", () => {
  importFile.click();
});

importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  importFile.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error("invalid format");

    const existing = loadEntries();
    const existingIds = new Set(existing.map((entry) => entry.id));
    let addedCount = 0;

    for (const entry of imported) {
      if (
        entry &&
        typeof entry.id === "string" &&
        typeof entry.timestamp === "number" &&
        typeof entry.mood === "string" &&
        !existingIds.has(entry.id)
      ) {
        existing.push({
          id: entry.id,
          timestamp: entry.timestamp,
          mood: entry.mood,
          activities: Array.isArray(entry.activities) ? entry.activities : [],
          memo: typeof entry.memo === "string" ? entry.memo : "",
          ...(typeof entry.aiComment === "string" ? { aiComment: entry.aiComment } : {}),
        });
        existingIds.add(entry.id);
        addedCount++;
      }
    }

    saveEntries(existing);
    renderHistory();
    showToast(addedCount > 0 ? `${addedCount}件を復元しました` : "新しい記録はありませんでした");
  } catch {
    showToast("読み込みに失敗しました");
  }
});

todayLabel.textContent = new Date().toLocaleDateString("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "short",
});

entryDateTime.value = toDateInputValue(new Date());

renderHistory();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
