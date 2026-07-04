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
      const activitiesText = entry.activities.join("・");
      html += `
        <div class="entry">
          <div class="entry-mood">${MOOD_EMOJI[entry.mood] || ""}</div>
          <div class="entry-body">
            <div class="entry-time">${time}</div>
            ${activitiesText ? `<div class="entry-activities">${escapeHtml(activitiesText)}</div>` : ""}
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

  const entries = loadEntries();

  if (state.editingId) {
    const index = entries.findIndex((entry) => entry.id === state.editingId);
    if (index !== -1) {
      entries[index] = {
        ...entries[index],
        mood: state.mood,
        activities,
        memo: memoInput.value.trim(),
      };
    }
    saveEntries(entries);
    resetForm();
    renderHistory();
    showToast("更新しました");
    return;
  }

  entries.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
    mood: state.mood,
    activities,
    memo: memoInput.value.trim(),
  });
  saveEntries(entries);

  resetForm();
  renderHistory();
  showToast("記録しました");
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

todayLabel.textContent = new Date().toLocaleDateString("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "short",
});

renderHistory();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
