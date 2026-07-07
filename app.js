const STORAGE_KEY = "lifelog.entries";

const MOOD_EMOJI = {
  great: "😄",
  good: "🙂",
  normal: "😐",
  bad: "😔",
  worst: "😣",
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

function formatTime(date) {
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
      const time = formatTime(new Date(entry.timestamp));
      const tagsHtml = entry.activities
        .map((activity) => `<span class="entry-tag">${escapeHtml(activity)}</span>`)
        .join("");
      html += `
        <div class="entry" data-entry-id="${entry.id}">
          <div class="entry-mood">${MOOD_EMOJI[entry.mood] || ""}</div>
          <div class="entry-body">
            <div class="entry-time">${time}</div>
            ${tagsHtml ? `<div class="entry-tags">${tagsHtml}</div>` : ""}
            ${entry.memo ? `<div class="entry-memo">${escapeHtml(entry.memo)}</div>` : ""}
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
  entryDateTime.value = toDatetimeLocalValue(new Date());
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
  entryDateTime.value = toDatetimeLocalValue(new Date(entry.timestamp));

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

  const parsedDate = entryDateTime.value ? new Date(entryDateTime.value) : new Date();
  const timestamp = isNaN(parsedDate.getTime()) ? Date.now() : parsedDate.getTime();

  const entries = loadEntries();

  if (state.editingId) {
    const editedId = state.editingId;
    const index = entries.findIndex((entry) => entry.id === editedId);
    if (index !== -1) {
      entries[index] = {
        ...entries[index],
        timestamp,
        mood: state.mood,
        activities,
        memo: memoInput.value.trim(),
      };
    }
    saveEntries(entries);
    resetForm();
    renderHistory();
    showToast("更新しました");
    scrollToEntry(editedId);
    return;
  }

  const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  entries.push({
    id: newId,
    timestamp,
    mood: state.mood,
    activities,
    memo: memoInput.value.trim(),
  });
  saveEntries(entries);

  resetForm();
  renderHistory();
  showToast("記録しました");
  scrollToEntry(newId);
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

entryDateTime.value = toDatetimeLocalValue(new Date());

renderHistory();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
