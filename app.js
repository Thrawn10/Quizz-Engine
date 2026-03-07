'use strict';

/* ═══════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════ */
const manifestCache  = {};    // keyed by folderPath.join('/'), each entry is items array
const titleCache     = {};    // keyed by file path, each entry is the chapter title
let folderPath       = [];    // current navigation path (array of folder names)
let availableQuizzes = [];    // [{ file, chapter, questionCount, data }]
let currentQuiz      = null;  // active quiz data
let currentIndex     = 0;     // current question index (0-based)
let userAnswers      = [];    // Set[] of selected option indices per question
let checkedState     = [];    // 'unanswered' | 'correct' | 'partial' | 'wrong' per question

/* ═══════════════════════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════════════════════ */
const pageHome      = document.getElementById('page-home');
const pageQuiz      = document.getElementById('page-quiz');
const pageResults   = document.getElementById('page-results');
const btnHeaderHome = document.getElementById('btn-header-home');

/* ═══════════════════════════════════════════════════════════════
   SCHEMA VALIDATOR
   Returns null if valid, or a string describing the first error.
═══════════════════════════════════════════════════════════════ */
function validateQuizData(data) {
  if (!data || typeof data !== 'object')          return 'Root is not an object';
  if (typeof data.chapter !== 'string' || !data.chapter.trim())
                                                   return 'Missing or empty "chapter" string';
  if (!Array.isArray(data.questions) || data.questions.length === 0)
                                                   return '"questions" must be a non-empty array';
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    if (typeof q.question !== 'string' || !q.question.trim())
      return `Question ${i + 1}: missing "question" string`;
    if (!Array.isArray(q.options) || q.options.length < 2)
      return `Question ${i + 1}: "options" must be an array with ≥ 2 entries`;
    if (!q.options.every(o => typeof o === 'string'))
      return `Question ${i + 1}: all "options" entries must be strings`;
    if (!Array.isArray(q.correct_answers) || q.correct_answers.length === 0)
      return `Question ${i + 1}: "correct_answers" must be a non-empty array`;
    if (!q.correct_answers.every(n => Number.isInteger(n) && n >= 0 && n < q.options.length))
      return `Question ${i + 1}: "correct_answers" contains invalid option index`;
    if (q.explanations !== undefined) {
      if (typeof q.explanations !== 'object' || q.explanations === null || Array.isArray(q.explanations))
        return `Question ${i + 1}: "explanations" must be an object`;
      for (const [key, val] of Object.entries(q.explanations)) {
        if (typeof val !== 'string')
          return `Question ${i + 1}: explanation for option "${key}" must be a string`;
      }
    }
  }
  return null; // valid
}

/* ═══════════════════════════════════════════════════════════════
   MANIFEST LOADING  –  each folder has its own manifest.json,
   fetched on demand and cached. Format for every manifest.json:
   [
     { "type": "folder", "name": "Folder Name" },
     { "type": "file",   "name": "quiz_file.json" }
   ]
═══════════════════════════════════════════════════════════════ */
function manifestUrl(path) {
  return path.length
    ? `questions/${path.join('/')}/manifest.json`
    : 'questions/manifest.json';
}

async function fetchManifest(path) {
  const key = path.join('/');
  if (manifestCache[key] !== undefined) return manifestCache[key];
  const url = manifestUrl(path);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} (${url})`);
  const items = await resp.json();
  manifestCache[key] = items;
  return items;
}

async function navigateTo(path) {
  folderPath = path;
  const key = path.join('/');
  if (manifestCache[key] === undefined) {
    document.getElementById('browser-loading').classList.remove('hidden');
    document.getElementById('browser-content').classList.add('hidden');
    document.getElementById('browser-error').classList.add('hidden');
  }
  try {
    const items = await fetchManifest(path);
    showBrowserContent(items);
  } catch (err) {
    document.getElementById('browser-loading').classList.add('hidden');
    document.getElementById('browser-error').classList.remove('hidden');
    document.getElementById('browser-error-msg').textContent =
      `Manifest konnte nicht geladen werden: ${err.message}`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   FOLDER BROWSER
═══════════════════════════════════════════════════════════════ */
function showBrowserContent(items) {
  document.getElementById('browser-loading').classList.add('hidden');
  document.getElementById('browser-error').classList.add('hidden');
  document.getElementById('browser-content').classList.remove('hidden');
  renderBreadcrumb();
  renderBrowserItems(items);
}

function renderBreadcrumb() {
  const el = document.getElementById('breadcrumb');
  el.innerHTML = '';
  const parts = ['Alle Fächer', ...folderPath];
  parts.forEach((part, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.textContent = '›';
      el.appendChild(sep);
    }
    const btn = document.createElement('button');
    btn.className = 'breadcrumb-item' + (i === parts.length - 1 ? ' active' : '');
    btn.textContent = part;
    const depth = i; // capture for closure
    btn.addEventListener('click', () => navigateTo(folderPath.slice(0, depth)));
    el.appendChild(btn);
  });
}

function renderBrowserItems(items) {
  const container = document.getElementById('browser-items');
  container.innerHTML = '';

  // Sort: folders first, then files; alphabetical within each group
  const sorted = [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
  });

  if (sorted.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:16px 0">Keine Einträge gefunden.</p>';
    return;
  }

  sorted.forEach((item, idx) => {
    const btn = document.createElement('button');
    btn.className = 'browser-card';

    if (item.type === 'folder') {
      btn.innerHTML = `
        <div class="browser-card-icon">📁</div>
        <div class="browser-card-info">
          <h3>${escHtml(item.name)}</h3>
          <span>Ordner öffnen</span>
        </div>
        <div class="browser-card-arrow">›</div>
      `;
      btn.addEventListener('click', () => navigateTo([...folderPath, item.name]));
    } else {
      const titleId = `title-${idx}`;
      const filePath = `questions/${[...folderPath, item.name].join('/')}`;
      btn.innerHTML = `
        <div class="browser-card-icon">📄</div>
        <div class="browser-card-info">
          <h3 id="${titleId}">Laden...</h3>
          <span>Klicken zum Starten</span>
        </div>
        <div class="browser-card-arrow">›</div>
      `;
      btn.addEventListener('click', () => loadAndStartQuiz(filePath, btn));
      
      // Fetch title asynchronously
      fetchQuizTitle(filePath).then(title => {
        const titleEl = document.getElementById(titleId);
        if (titleEl) titleEl.textContent = title;
      });
    }
    container.appendChild(btn);
  });
}

async function fetchQuizTitle(filePath) {
  if (titleCache[filePath] !== undefined) return titleCache[filePath];
  try {
    const resp = await fetch(filePath);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const title = data.chapter || 'Untitled';
    titleCache[filePath] = title;
    return title;
  } catch (err) {
    console.error(`Failed to fetch title for ${filePath}:`, err);
    titleCache[filePath] = `Fehler beim Laden`;
    return titleCache[filePath];
  }
}

async function loadAndStartQuiz(path, btn) {
  btn.disabled = true;
  const prevHTML = btn.innerHTML;
  btn.innerHTML = '<div class="mini-spinner"></div>';
  try {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const err = validateQuizData(data);
    if (err) throw new Error(`Schema: ${err}`);
    availableQuizzes = [{
      file: path.split('/').pop(),
      chapter: data.chapter,
      questionCount: data.questions.length,
      data,
    }];
    startQuiz(0);
  } catch (err) {
    btn.innerHTML = prevHTML;
    btn.disabled = false;
    alert(`Fehler beim Laden von "${path}":\n${err.message}`);
  }
}

/* ═══════════════════════════════════════════════════════════════
   CHAPTER NUMBER EXTRACTION
   Tries filename first (ds_2_architectures.json → "2"),
   then falls back to chapter title ("Chapter 2:" → "2").
═══════════════════════════════════════════════════════════════ */
function chapterNum(filename, chapter) {
  const mf = filename.match(/^ds_(\d+)_/);
  if (mf) return mf[1];
  const mc = (chapter || '').match(/Chapter\s+(\d+)/i);
  return mc ? mc[1] : '?';
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION HELPERS
═══════════════════════════════════════════════════════════════ */
function showPage(page) {
  pageHome.classList.add('hidden');
  pageQuiz.classList.add('hidden');
  pageResults.classList.add('hidden');
  page.classList.remove('hidden');
  btnHeaderHome.classList.toggle('hidden', page === pageHome);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHome() {
  showPage(pageHome);
  navigateTo(folderPath);
}

/* ═══════════════════════════════════════════════════════════════
   QUIZ LOGIC
═══════════════════════════════════════════════════════════════ */
function startQuiz(quizIndex) {
  currentQuiz = availableQuizzes[quizIndex].data;
  currentIndex = 0;

  const n = currentQuiz.questions.length;
  userAnswers  = Array.from({ length: n }, () => new Set());
  checkedState = Array(n).fill('unanswered');

  document.getElementById('quiz-chapter-title').textContent = currentQuiz.chapter;
  buildDotNav();
  renderQuestion(0);
  showPage(pageQuiz);
}

function buildDotNav() {
  const container = document.getElementById('dot-nav');
  container.innerHTML = '';
  currentQuiz.questions.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'dot';
    dot.textContent = i + 1;
    dot.title = `Frage ${i + 1}`;
    dot.addEventListener('click', () => {
      if (checkedState[currentIndex] === 'unanswered' && userAnswers[currentIndex].size > 0) {
        // soft-save answers before navigating away without checking
      }
      renderQuestion(i);
    });
    container.appendChild(dot);
  });
}

function renderQuestion(index) {
  currentIndex = index;
  const q = currentQuiz.questions[index];
  const n = currentQuiz.questions.length;
  const answered = checkedState[index] !== 'unanswered';

  // Meta
  document.getElementById('q-num').textContent = index + 1;
  document.getElementById('q-text').textContent = q.question;
  document.getElementById('quiz-counter').textContent = `${index + 1} / ${n}`;

  // Hint – only revealed after validation
  const correctCount = q.correct_answers.length;
  const hintEl = document.getElementById('q-hint');
  if (answered) {
    hintEl.innerHTML = correctCount === 1
      ? 'Richtige Antworten: <em>1</em>'
      : `Richtige Antworten: <em>${correctCount}</em>`;
  } else {
    hintEl.innerHTML = '';
  }

  // Progress
  const checkedCount = checkedState.filter(s => s !== 'unanswered').length;
  document.getElementById('progress-bar').style.width = `${(checkedCount / n) * 100}%`;

  // Dots
  document.querySelectorAll('.dot').forEach((dot, i) => {
    dot.className = 'dot';
    if (i === index) dot.classList.add('active');
    if (checkedState[i] === 'correct')  dot.classList.add('correct');
    else if (checkedState[i] === 'partial' || checkedState[i] === 'wrong') dot.classList.add('wrong');
    else if (userAnswers[i].size > 0)   dot.classList.add('answered');
  });

  // Options
  const optContainer = document.getElementById('q-options');
  optContainer.innerHTML = '';
  q.options.forEach((optText, optIdx) => {
    const label = document.createElement('label');
    label.className = 'option-label';
    if (answered) label.classList.add('locked');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = userAnswers[index].has(optIdx);
    cb.addEventListener('change', () => {
      if (cb.checked) userAnswers[index].add(optIdx);
      else            userAnswers[index].delete(optIdx);
      updateActionBar();
    });

    const box = document.createElement('div');
    box.className = 'option-checkbox';

    const text = document.createElement('span');
    text.className = 'option-text';
    text.textContent = optText;

    const badge = document.createElement('span');
    badge.className = 'option-badge';

    // Apply validation styling if already checked
    if (answered) {
      const isCorrectOption  = q.correct_answers.includes(optIdx);
      const isSelectedOption = userAnswers[index].has(optIdx);

      if (isSelectedOption && isCorrectOption) {
        label.classList.add('result-correct');
        badge.textContent = '✓ Richtig';
      } else if (isSelectedOption && !isCorrectOption) {
        label.classList.add('result-wrong');
        badge.textContent = '✗ Falsch';
      } else if (!isSelectedOption && isCorrectOption) {
        label.classList.add('result-missed');
        badge.textContent = '! Vergessen';
      }
    }

    label.append(cb, box, text, badge);
    optContainer.appendChild(label);
  });

  // Feedback banner
  const fb = document.getElementById('q-feedback');
  fb.className = 'feedback-banner';
  const explContainer = document.getElementById('q-explanations');
  explContainer.innerHTML = '';
  
  if (answered) {
    const icon = fb.querySelector('.feedback-icon');
    const msg  = fb.querySelector('.feedback-msg');
    fb.classList.add('show');
    if (checkedState[index] === 'correct') {
      fb.classList.add('correct');
      icon.textContent = '✓';
      msg.textContent  = 'Alle Antworten korrekt!';
    } else if (checkedState[index] === 'partial') {
      fb.classList.add('partial');
      icon.textContent = '◑';
      msg.textContent  = 'Teilweise richtig – nicht alle richtigen Antworten wurden ausgewählt.';
    } else {
      fb.classList.add('incorrect');
      icon.textContent = '✗';
      msg.textContent  = 'Leider falsch. Sieh dir die richtigen Antworten an.';
    }

    // Display explanations if available
    if (q.explanations && typeof q.explanations === 'object') {
      for (const optIdx of q.correct_answers) {
        const optIdxStr = String(optIdx);
        if (q.explanations[optIdxStr]) {
          const explItem = document.createElement('div');
          explItem.className = 'explanation-item';
          explItem.innerHTML = `
            <div class="explanation-label">Option ${optIdx + 1}:</div>
            <div>${escHtml(q.explanations[optIdxStr])}</div>
          `;
          explContainer.appendChild(explItem);
        }
      }
    }
  }

  updateActionBar();
}

function updateActionBar() {
  const index  = currentIndex;
  const n      = currentQuiz.questions.length;
  const answered = checkedState[index] !== 'unanswered';
  const hasSelection = userAnswers[index].size > 0;
  const isLast = index === n - 1;

  const btnPrev   = document.getElementById('btn-prev');
  const btnCheck  = document.getElementById('btn-check');
  const btnNext   = document.getElementById('btn-next');
  const btnFinish = document.getElementById('btn-finish');
  const hint      = document.getElementById('action-hint');

  btnPrev.disabled = index === 0;

  if (!answered) {
    btnCheck.classList.remove('hidden');
    btnNext.classList.add('hidden');
    btnFinish.classList.add('hidden');
    btnCheck.disabled = !hasSelection;
    hint.textContent = hasSelection ? '' : 'Wähle mindestens eine Antwort.';
  } else {
    btnCheck.classList.add('hidden');
    if (isLast) {
      btnNext.classList.add('hidden');
      btnFinish.classList.remove('hidden');
    } else {
      btnNext.classList.remove('hidden');
      btnFinish.classList.add('hidden');
    }
    hint.textContent = '';
  }
}

function checkAnswer() {
  const index = currentIndex;
  const q = currentQuiz.questions[index];
  const selected = userAnswers[index];
  const correct  = new Set(q.correct_answers);

  const allCorrectSelected = q.correct_answers.every(c => selected.has(c));
  const noWrongSelected    = [...selected].every(s => correct.has(s));

  if (allCorrectSelected && noWrongSelected) {
    checkedState[index] = 'correct';
  } else if ([...selected].some(s => correct.has(s))) {
    checkedState[index] = 'partial';
  } else {
    checkedState[index] = 'wrong';
  }

  renderQuestion(index);
}

/* ═══════════════════════════════════════════════════════════════
   RESULTS PAGE
═══════════════════════════════════════════════════════════════ */
function showResults() {
  const n = currentQuiz.questions.length;
  let correct  = 0, wrong = 0, skipped = 0;

  checkedState.forEach((s, i) => {
    if      (s === 'correct')                       correct++;
    else if (s === 'partial' || s === 'wrong')      wrong++;
    else                                             skipped++;
  });

  const pct = Math.round((correct / n) * 100);

  // Ring animation
  const circumference = 364.4;
  const offset = circumference - (pct / 100) * circumference;
  const ring = document.getElementById('score-ring-fg');
  ring.style.strokeDashoffset = circumference;
  ring.className = 'score-ring-fg';
  if (pct >= 80)      ring.classList.add('great');
  else if (pct >= 50) ring.classList.add('ok');
  else                ring.classList.add('poor');
  setTimeout(() => { ring.style.strokeDashoffset = offset; }, 80);

  document.getElementById('score-pct').textContent = pct + '%';

  // Headline
  let title, subtitle;
  if (pct === 100)      { title = 'Perfekt! 🎉'; subtitle = 'Alle Fragen richtig beantwortet!'; }
  else if (pct >= 80)   { title = 'Sehr gut!';   subtitle = 'Du beherrschst das Thema gut.'; }
  else if (pct >= 60)   { title = 'Gut gemacht'; subtitle = 'Noch etwas Übung und du hast es!'; }
  else if (pct >= 40)   { title = 'Ausbaufähig'; subtitle = 'Nochmal lesen und dann wiederholen.'; }
  else                  { title = 'Viel zu tun'; subtitle = 'Lies das Kapitel nochmal durch.'; }

  document.getElementById('results-title').textContent = title;
  document.getElementById('results-subtitle').textContent = subtitle;
  document.getElementById('stat-correct').textContent  = correct;
  document.getElementById('stat-wrong').textContent    = wrong;
  document.getElementById('stat-skipped').textContent  = skipped;

  // Review list
  const reviewList = document.getElementById('review-list');
  reviewList.innerHTML = '';
  currentQuiz.questions.forEach((q, i) => {
    const state = checkedState[i];
    const statusClass = state === 'correct' ? 'correct' : (state === 'unanswered' ? 'skipped' : 'wrong');
    const statusMark  = state === 'correct' ? '✓' : (state === 'unanswered' ? '–' : '✗');

    const item = document.createElement('div');
    item.className = 'review-item';
    item.innerHTML = `
      <div class="review-item-header">
        <div class="review-status ${statusClass}">${statusMark}</div>
        <div class="review-q-text">${escHtml(q.question)}</div>
        <div class="review-chevron">▾</div>
      </div>
      <div class="review-detail"></div>
    `;

    const detail = item.querySelector('.review-detail');
    const selected = userAnswers[i];
    const correct  = new Set(q.correct_answers);

    q.options.forEach((opt, oi) => {
      const isCorrect  = correct.has(oi);
      const isSelected = selected.has(oi);
      let cls = 'ro-neutral', dot = '';
      if      (isSelected && isCorrect)           cls = 'ro-correct';
      else if (isSelected && !isCorrect)           cls = 'ro-wrong';
      else if (!isSelected && isCorrect)           cls = 'ro-missed';
      const div = document.createElement('div');
      div.className = `review-option ${cls}`;
      div.innerHTML = `<div class="r-dot"></div>${escHtml(opt)}`;
      detail.appendChild(div);
    });

    item.querySelector('.review-item-header').addEventListener('click', () => {
      item.classList.toggle('open');
    });

    reviewList.appendChild(item);
  });

  showPage(pageResults);
}

/* ═══════════════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════════════ */
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ═══════════════════════════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════════════════════════ */
btnHeaderHome.addEventListener('click', showHome);

document.getElementById('btn-prev').addEventListener('click', () => {
  if (currentIndex > 0) renderQuestion(currentIndex - 1);
});

document.getElementById('btn-next').addEventListener('click', () => {
  if (currentIndex < currentQuiz.questions.length - 1) renderQuestion(currentIndex + 1);
});

document.getElementById('btn-check').addEventListener('click', checkAnswer);

document.getElementById('btn-finish').addEventListener('click', () => {
  // Auto-check any remaining unchecked questions with selections
  for (let i = 0; i < currentQuiz.questions.length; i++) {
    if (checkedState[i] === 'unanswered') {
      const q = currentQuiz.questions[i];
      const selected = userAnswers[i];
      if (selected.size > 0) {
        const correct = new Set(q.correct_answers);
        const allOk = q.correct_answers.every(c => selected.has(c));
        const noWrong = [...selected].every(s => correct.has(s));
        checkedState[i] = (allOk && noWrong) ? 'correct' : ([...selected].some(s => correct.has(s)) ? 'partial' : 'wrong');
      }
    }
  }
  showResults();
});

document.getElementById('btn-retry').addEventListener('click', () => {
  const idx = availableQuizzes.findIndex(q => q.data === currentQuiz);
  startQuiz(idx >= 0 ? idx : 0);
});

document.getElementById('btn-back-home').addEventListener('click', showHome);

/* ═══════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════ */
navigateTo([]);