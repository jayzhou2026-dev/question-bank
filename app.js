const STORE_KEY = "substation-practice-v1";

const state = {
  loaded: false,
  questions: [],
  filtered: [],
  session: [],
  index: 0,
  mode: "sequential",
  exam: null,
  selected: new Set(),
  progress: {
    lastQuestionId: null,
    records: {},
    favorites: [],
    exams: []
  }
};

const $ = (id) => document.getElementById(id);

const els = {
  dashboardView: $("dashboardView"),
  practiceView: $("practiceView"),
  settingsView: $("settingsView"),
  heroTitle: $("heroTitle"),
  heroSubtitle: $("heroSubtitle"),
  doneCount: $("doneCount"),
  accuracyRate: $("accuracyRate"),
  wrongCount: $("wrongCount"),
  favoriteCount: $("favoriteCount"),
  continueButton: $("continueButton"),
  typeFilter: $("typeFilter"),
  backButton: $("backButton"),
  favoriteButton: $("favoriteButton"),
  modeLabel: $("modeLabel"),
  progressLabel: $("progressLabel"),
  questionType: $("questionType"),
  questionDifficulty: $("questionDifficulty"),
  questionStem: $("questionStem"),
  optionsList: $("optionsList"),
  resultPanel: $("resultPanel"),
  prevButton: $("prevButton"),
  submitButton: $("submitButton"),
  nextButton: $("nextButton"),
  examButton: $("examButton"),
  settingsButton: $("settingsButton"),
  settingsBackButton: $("settingsBackButton"),
  exportButton: $("exportButton"),
  importInput: $("importInput"),
  resetButton: $("resetButton")
};

init();

async function init() {
  bindEvents();
  loadProgress();
  try {
    const response = await fetch("questions.json");
    const data = await response.json();
    state.questions = data.questions || [];
    state.loaded = true;
    applyFilter();
    updateDashboard();
  } catch (error) {
    els.heroTitle.textContent = "题库加载失败";
    els.heroSubtitle.textContent = "请确认 questions.json 和网页文件在同一目录。";
    console.error(error);
  }
}

function bindEvents() {
  els.continueButton.addEventListener("click", () => startMode("sequential"));
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => startMode(button.dataset.mode));
  });
  els.examButton.addEventListener("click", startExam);
  els.typeFilter.addEventListener("change", () => {
    applyFilter();
    updateDashboard();
  });
  els.backButton.addEventListener("click", showDashboard);
  els.prevButton.addEventListener("click", previousQuestion);
  els.nextButton.addEventListener("click", nextQuestion);
  els.submitButton.addEventListener("click", submitAnswer);
  els.favoriteButton.addEventListener("click", toggleFavorite);
  els.settingsButton.addEventListener("click", showSettings);
  els.settingsBackButton.addEventListener("click", showDashboard);
  els.exportButton.addEventListener("click", exportProgress);
  els.importInput.addEventListener("change", importProgress);
  els.resetButton.addEventListener("click", resetProgress);
}

function applyFilter() {
  const type = els.typeFilter.value;
  state.filtered = type === "all" ? [...state.questions] : state.questions.filter((q) => q.type === type);
}

function showDashboard() {
  state.exam = null;
  els.dashboardView.classList.remove("hidden");
  els.practiceView.classList.add("hidden");
  els.settingsView.classList.add("hidden");
  updateDashboard();
}

function showPractice() {
  els.dashboardView.classList.add("hidden");
  els.practiceView.classList.remove("hidden");
  els.settingsView.classList.add("hidden");
}

function showSettings() {
  els.dashboardView.classList.add("hidden");
  els.practiceView.classList.add("hidden");
  els.settingsView.classList.remove("hidden");
}

function updateDashboard() {
  const total = state.questions.length;
  const records = Object.values(state.progress.records);
  const done = records.filter((r) => r.attempts > 0).length;
  const attempts = records.reduce((sum, r) => sum + (r.attempts || 0), 0);
  const correct = records.reduce((sum, r) => sum + (r.correct || 0), 0);
  const wrong = records.filter((r) => r.lastCorrect === false).length;
  const favorites = state.progress.favorites.length;

  els.heroTitle.textContent = total ? `${total} 道题，随时开刷` : "题库正在加载";
  els.heroSubtitle.textContent = total
    ? `当前筛选 ${state.filtered.length} 道题，学习记录自动保存在这台 iPad。`
    : "正在读取题库数据。";
  els.doneCount.textContent = done;
  els.accuracyRate.textContent = attempts ? `${Math.round((correct / attempts) * 100)}%` : "0%";
  els.wrongCount.textContent = wrong;
  els.favoriteCount.textContent = favorites;
}

function startMode(mode) {
  if (!state.loaded) return;
  applyFilter();
  state.mode = mode;
  state.exam = null;

  if (mode === "wrong") {
    state.session = state.filtered.filter((q) => state.progress.records[q.id]?.lastCorrect === false);
  } else if (mode === "favorite") {
    const favorites = new Set(state.progress.favorites);
    state.session = state.filtered.filter((q) => favorites.has(q.id));
  } else if (mode === "random") {
    state.session = shuffle([...state.filtered]);
  } else {
    state.session = [...state.filtered];
  }

  if (!state.session.length) {
    alert(mode === "wrong" ? "当前没有错题。" : mode === "favorite" ? "当前没有收藏题。" : "当前筛选下没有题目。");
    return;
  }

  const lastIndex = state.session.findIndex((q) => q.id === state.progress.lastQuestionId);
  state.index = mode === "sequential" && lastIndex >= 0 ? lastIndex : 0;
  showPractice();
  renderQuestion();
}

function startExam() {
  if (!state.loaded) return;
  applyFilter();
  const session = shuffle([...state.filtered]).slice(0, Math.min(100, state.filtered.length));
  if (!session.length) {
    alert("当前筛选下没有题目。");
    return;
  }
  state.mode = "exam";
  state.exam = {
    startedAt: new Date().toISOString(),
    answers: {},
    submitted: false
  };
  state.session = session;
  state.index = 0;
  showPractice();
  renderQuestion();
}

function renderQuestion() {
  const question = currentQuestion();
  if (!question) return;

  state.selected = new Set(state.exam?.answers[question.id] || []);
  state.progress.lastQuestionId = question.id;
  saveProgress();

  els.modeLabel.textContent = modeName(state.mode);
  els.progressLabel.textContent = `${state.index + 1} / ${state.session.length}`;
  els.questionType.textContent = question.type;
  els.questionDifficulty.textContent = question.difficulty ? `难度：${question.difficulty}` : "难度：未标注";
  els.questionStem.textContent = question.stem;
  els.favoriteButton.textContent = isFavorite(question.id) ? "已收藏" : "收藏";
  els.resultPanel.className = "result-panel hidden";
  els.resultPanel.textContent = "";
  els.submitButton.textContent = state.mode === "exam" && state.index === state.session.length - 1 ? "交卷" : "提交答案";

  els.optionsList.innerHTML = "";
  const inputType = question.type === "多选题" ? "checkbox" : "radio";
  question.options.forEach((option) => {
    const label = document.createElement("label");
    label.className = "option-item";
    const input = document.createElement("input");
    input.type = inputType;
    input.name = `answer-${question.id}`;
    input.value = option.key;
    input.checked = state.selected.has(option.key);
    input.addEventListener("change", () => updateSelection(input, inputType));
    const text = document.createElement("span");
    text.className = "option-text";
    text.textContent = `${option.key}. ${option.text}`;
    label.append(input, text);
    els.optionsList.appendChild(label);
  });
}

function updateSelection(input, inputType) {
  if (inputType === "radio") {
    state.selected = new Set([input.value]);
  } else if (input.checked) {
    state.selected.add(input.value);
  } else {
    state.selected.delete(input.value);
  }

  if (state.mode === "exam" && state.exam) {
    state.exam.answers[currentQuestion().id] = [...state.selected].sort();
  }
}

function submitAnswer() {
  const question = currentQuestion();
  if (!question) return;
  if (!state.selected.size) {
    alert("请先选择答案。");
    return;
  }

  const selected = [...state.selected].sort().join("");
  const correctAnswer = normalizeAnswer(question.answer);
  const isCorrect = selected === correctAnswer;

  if (state.mode === "exam") {
    state.exam.answers[question.id] = [...state.selected].sort();
    if (state.index < state.session.length - 1) {
      nextQuestion();
    } else {
      finishExam();
    }
    return;
  }

  recordAnswer(question.id, selected, isCorrect);
  showResult(question, selected, isCorrect);
  updateDashboard();
}

function showResult(question, selected, isCorrect) {
  els.resultPanel.className = `result-panel ${isCorrect ? "" : "wrong"}`;
  const selectedText = selected || "未选择";
  const answerText = normalizeAnswer(question.answer);
  els.resultPanel.innerHTML = `
    <strong>${isCorrect ? "回答正确" : "回答错误"}</strong><br>
    你的答案：${selectedText}<br>
    正确答案：${answerText}
    ${question.explanation ? `<br>解析：${escapeHtml(question.explanation)}` : ""}
  `;
}

function finishExam() {
  let correct = 0;
  const details = state.session.map((question) => {
    const selected = (state.exam.answers[question.id] || []).sort().join("");
    const isCorrect = selected === normalizeAnswer(question.answer);
    if (isCorrect) correct += 1;
    recordAnswer(question.id, selected, isCorrect);
    return { id: question.id, selected, correct: isCorrect };
  });

  const examRecord = {
    startedAt: state.exam.startedAt,
    finishedAt: new Date().toISOString(),
    total: state.session.length,
    correct,
    rate: Math.round((correct / state.session.length) * 100),
    details
  };
  state.progress.exams.unshift(examRecord);
  state.progress.exams = state.progress.exams.slice(0, 20);
  saveProgress();
  updateDashboard();
  alert(`交卷完成：${correct} / ${state.session.length}，正确率 ${examRecord.rate}%`);
  showDashboard();
}

function recordAnswer(id, selected, isCorrect) {
  const record = state.progress.records[id] || {
    attempts: 0,
    correct: 0,
    lastAnswer: "",
    lastCorrect: null,
    updatedAt: ""
  };
  record.attempts += 1;
  if (isCorrect) record.correct += 1;
  record.lastAnswer = selected;
  record.lastCorrect = isCorrect;
  record.updatedAt = new Date().toISOString();
  state.progress.records[id] = record;
  saveProgress();
}

function previousQuestion() {
  if (state.index > 0) {
    state.index -= 1;
    renderQuestion();
  }
}

function nextQuestion() {
  if (state.index < state.session.length - 1) {
    state.index += 1;
    renderQuestion();
  } else if (state.mode === "exam") {
    finishExam();
  } else {
    alert("已经是最后一题。");
  }
}

function toggleFavorite() {
  const question = currentQuestion();
  if (!question) return;
  const favorites = new Set(state.progress.favorites);
  if (favorites.has(question.id)) {
    favorites.delete(question.id);
  } else {
    favorites.add(question.id);
  }
  state.progress.favorites = [...favorites];
  saveProgress();
  els.favoriteButton.textContent = isFavorite(question.id) ? "已收藏" : "收藏";
  updateDashboard();
}

function currentQuestion() {
  return state.session[state.index];
}

function isFavorite(id) {
  return state.progress.favorites.includes(id);
}

function normalizeAnswer(answer) {
  return String(answer || "").toUpperCase().replace(/[^A-G]/g, "").split("").sort().join("");
}

function modeName(mode) {
  return {
    sequential: "顺序刷题",
    random: "随机练习",
    wrong: "错题复习",
    favorite: "收藏题",
    exam: "模拟考试"
  }[mode] || "练习";
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.progress = {
      lastQuestionId: parsed.lastQuestionId || null,
      records: parsed.records || {},
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      exams: Array.isArray(parsed.exams) ? parsed.exams : []
    };
  } catch {
    localStorage.removeItem(STORE_KEY);
  }
}

function saveProgress() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.progress));
}

function exportProgress() {
  const payload = {
    app: "变电运维刷题",
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: state.progress
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `变电运维刷题记录-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importProgress(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || "{}"));
      const progress = data.progress || data;
      state.progress = {
        lastQuestionId: progress.lastQuestionId || null,
        records: progress.records || {},
        favorites: Array.isArray(progress.favorites) ? progress.favorites : [],
        exams: Array.isArray(progress.exams) ? progress.exams : []
      };
      saveProgress();
      updateDashboard();
      alert("学习记录已导入。");
    } catch {
      alert("导入失败，请选择正确的备份文件。");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
}

function resetProgress() {
  if (!confirm("确定清空这台设备上的学习记录吗？")) return;
  state.progress = {
    lastQuestionId: null,
    records: {},
    favorites: [],
    exams: []
  };
  saveProgress();
  updateDashboard();
  alert("学习记录已清空。");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
