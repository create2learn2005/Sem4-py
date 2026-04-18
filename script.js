// ══════════════════════════════════════════════════
//  PyBank — script.js  (v4 — Mobile Edition)
//  Jump to Q# · Descriptive Only · DB + fallback
// ══════════════════════════════════════════════════

import { neon } from 'https://esm.sh/@neondatabase/serverless@0.10.4';

const DATABASE_URL = 'postgresql://neondb_owner:npg_kuXI3LOC1QAf@ep-lucky-hall-a10bbj3u-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const sanitizedDbUrl = new URL(DATABASE_URL);
sanitizedDbUrl.searchParams.delete('channel_binding');
const sql = neon(sanitizedDbUrl.toString());

// ── STATE ─────────────────────────────────────────
let ALL_QUESTIONS  = [];
let filteredList   = [];
let currentUnit    = 'all';
let currentView    = 'list';
let descOnly       = false;   // "Descriptive Only" toggle state

// ── UNIT META ─────────────────────────────────────
const UNIT_META = {
  all: { label: 'All Questions',               icon: 'bi-grid-3x3-gap-fill',  sub: 'Fundamentals of Computer Science using Python II' },
  1:   { label: 'Unit 1 — Pandas',             icon: 'bi-table',               sub: 'Pandas DataFrames, Cleaning, Groupby & Merging' },
  2:   { label: 'Unit 2 — Visualization',      icon: 'bi-bar-chart-fill',      sub: 'Seaborn, Plotly Express, Matplotlib, NetworkX' },
  3:   { label: 'Unit 3 — Feature Eng.',       icon: 'bi-cpu-fill',            sub: 'Polynomial Features, Label Encoding, Binning, Scaling' },
  4:   { label: 'Unit 4 — Regression',         icon: 'bi-diagram-3-fill',      sub: 'Linear, Polynomial, Multiple Regression · sklearn' },
  5:   { label: 'Unit 5 — Classification',     icon: 'bi-bezier2',             sub: 'kNN, Decision Tree, SVM, Random Forest' },
  6:   { label: 'Unit 6 — Deep Learning',      icon: 'bi-layers-fill',         sub: 'TensorFlow, Keras, CNN, Transfer Learning' },
  7:   { label: 'Unit 7 — Web & APIs',         icon: 'bi-globe2',              sub: 'BeautifulSoup, requests, OpenWeatherMap, REST APIs' },
  8:   { label: 'Unit 8 — Django Basics',      icon: 'bi-server',              sub: 'MVT, Models, Views, Templates, Forms, Admin' },
  9:   { label: 'Unit 9 — Django Auth',        icon: 'bi-person-lock',         sub: 'Authentication, CRUD Projects, CRM, Blog, Booking' },
  10:  { label: 'Unit 10 — DRF',               icon: 'bi-braces-asterisk',     sub: 'Django REST Framework · JWT · Serializers · ViewSets' },
};

const UNIT_COLORS = {
  1: 'tag-unit1', 2: 'tag-unit2',  3: 'tag-unit3',
  4: 'tag-unit4', 5: 'tag-unit5',  6: 'tag-unit6',
  7: 'tag-unit7', 8: 'tag-unit8',  9: 'tag-unit9',
  10: 'tag-unit10',
};

// ── DB MAPPING ────────────────────────────────────
function mapDbRowsToQuestions(rows) {
  return rows.map((r) => {
    const options = [r.option_a, r.option_b, r.option_c, r.option_d]
      .map((opt) => (opt ?? '').trim())
      .filter(Boolean);
    const isMCQ   = options.length > 0;
    const pyqRaw  = (r.pyq_year ?? '').trim();
    const pyqYear = pyqRaw && pyqRaw.toLowerCase() !== 'no' ? pyqRaw : null;
    const marks   = Number.parseInt(r.marks, 10);

    const question = {
      id:       Number.parseInt(r.id, 10),
      unit:     Number.parseInt(r.unit, 10),
      type:     isMCQ ? 'mcq' : 'descriptive',
      question: r.question ?? '',
      marks:    Number.isFinite(marks) ? marks : 1,
      pyq:      Boolean(pyqYear),
      pyq_year: pyqYear,
    };

    if (isMCQ) {
      const answer       = String(r.answer ?? '').trim().toUpperCase();
      const answerLetter = answer.charAt(0);
      question.options   = options;
      question.answer    = ['A', 'B', 'C', 'D'].includes(answerLetter) ? answerLetter : 'A';
    } else {
      question.code = r.answer ?? '';
    }

    return question;
  });
}

async function fetchQuestions(unitParam) {
  if (unitParam === 'all') {
    return sql`
      SELECT
        sr_no         AS id,
        unit_number   AS unit,
        question_text AS question,
        answer,
        marks,
        previous_year AS pyq_year,
        option_a, option_b, option_c, option_d
      FROM questions_clean
      WHERE marks IS NOT NULL
      ORDER BY sr_no ASC
    `;
  }
  const unitNum = Number.parseInt(unitParam, 10);
  if (!Number.isInteger(unitNum) || unitNum < 1 || unitNum > 10)
    throw new Error("Invalid unit number. Use 1-10 or 'all'.");

  return sql`
    SELECT
      sr_no         AS id,
      unit_number   AS unit,
      question_text AS question,
      answer,
      marks,
      previous_year AS pyq_year,
      option_a, option_b, option_c, option_d
    FROM questions_clean
    WHERE marks IS NOT NULL AND unit_number = ${unitNum}
    ORDER BY sr_no ASC
  `;
}

// ── INIT ──────────────────────────────────────────
async function init() {
  const params   = new URLSearchParams(window.location.search);
  currentUnit    = params.get('unit') || 'all';
  const pyqParam = params.get('pyq');

  showLoading(true);
  loadVisitorCount();

  try {
    setLoadingMsg('Connecting to database...');
    const rows = await fetchQuestions(currentUnit === 'all' ? 'all' : currentUnit);
    ALL_QUESTIONS = mapDbRowsToQuestions(rows);
    setLoadingMsg(`${ALL_QUESTIONS.length} questions loaded ✓`);
    setTimeout(() => showLoading(false), 400);
  } catch (err) {
    console.error('Direct DB fetch failed:', err.message);
    setLoadingMsg('DB unavailable — trying local fallback...');
    try {
      const res = await fetch('data.json');
      if (!res.ok) throw new Error('No data.json either');
      ALL_QUESTIONS = await res.json();
      setLoadingMsg(`Loaded ${ALL_QUESTIONS.length} questions from cache`);
      setTimeout(() => showLoading(false), 600);
    } catch {
      showLoading(false);
      document.getElementById('cardsContainer').innerHTML = `
        <div style="color:var(--red);font-family:var(--mono);padding:40px;grid-column:1/-1;text-align:center">
          <div style="font-size:2rem;margin-bottom:16px">⚠️</div>
          <strong>Could not load questions.</strong><br>
          <span style="color:var(--muted);font-size:0.85rem">
            Error: ${err.message}<br><br>
            1. Check DATABASE_URL in script.js<br>
            2. Ensure table questions_clean exists in Neon<br>
            3. Open this project via localhost (not file://)
          </span>
        </div>`;
      return;
    }
  }

  if (pyqParam === 'true') document.getElementById('f-pyq').checked = true;

  setView('list', false);
  buildUnitNav();
  bindEvents();
  filterAndRender();

  // Auto-close sidebar on small screens after load
  if (window.innerWidth <= 900) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }

  // Show the mobile filter bar after data loads
  document.getElementById('mobileFilterBar')?.classList.add('loaded');
}

// ── VISITOR COUNTER ───────────────────────────────
// Increments only ONCE per browser per calendar day via localStorage.
async function loadVisitorCount() {
  const el = document.getElementById('visitorCount');
  if (!el) return;

  const TODAY      = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const STORED_KEY = 'pybank_visited_date';
  const alreadyCounted = localStorage.getItem(STORED_KEY) === TODAY;

  try {
    let rows;
    if (alreadyCounted) {
      // Just read — don't increment again today
      rows = await sql`SELECT count FROM visitor_counter WHERE id = 1`;
    } else {
      rows = await sql`
        INSERT INTO visitor_counter (id, count, last_visited)
        VALUES (1, 1, NOW())
        ON CONFLICT (id) DO UPDATE
        SET
          count        = visitor_counter.count + 1,
          last_visited = NOW()
        RETURNING count
      `;
      localStorage.setItem(STORED_KEY, TODAY);
    }

    const count = Number.parseInt(rows?.[0]?.count ?? 0, 10) || 0;
    animateVisitorCount(el, count);
  } catch {
    el.textContent = '—';
  }
}

function animateVisitorCount(el, target) {
  if (target <= 0) { el.textContent = target.toLocaleString(); return; }
  const duration = 1200;
  const start    = Date.now();
  const from     = Math.max(0, target - Math.min(target, 80));
  const tick = () => {
    const progress = Math.min((Date.now() - start) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current  = Math.round(from + (target - from) * ease);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ── LOADING STATE ─────────────────────────────────
function showLoading(show) {
  const ls = document.getElementById('loadingState');
  const cc = document.getElementById('cardsContainer');
  if (!ls) return;
  ls.style.display = show ? 'flex' : 'none';
  cc.style.display = show ? 'none'  : '';
}
function setLoadingMsg(msg) {
  const el = document.getElementById('loadingMsg');
  if (el) el.textContent = msg;
}

// ── BUILD UNIT NAV ────────────────────────────────
function buildUnitNav() {
  const nav   = document.getElementById('unitNav');
  const units = ['all','1','2','3','4','5','6','7','8','9','10'];

  nav.innerHTML = units.map(uid => {
    const meta  = UNIT_META[uid] || UNIT_META['all'];
    const count = uid === 'all'
      ? ALL_QUESTIONS.length
      : ALL_QUESTIONS.filter(q => q.unit === parseInt(uid)).length;

    return `
      <button class="unit-nav-btn ${currentUnit === uid ? 'active' : ''}" data-unit="${uid}">
        <i class="${meta.icon}"></i>
        <span>${meta.label}</span>
        <span class="nav-badge">${count}</span>
      </button>`;
  }).join('');

  document.querySelectorAll('.unit-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentUnit = btn.dataset.unit;
      document.querySelectorAll('.unit-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateTitles();
      document.querySelectorAll('[data-unit-link]').forEach(a => {
        a.classList.toggle('active', a.dataset.unitLink === currentUnit);
      });
      filterAndRender();
      // Close sidebar on mobile after selecting unit
      if (window.innerWidth <= 900) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('show');
      }
    });
  });
}

function updateTitles() {
  const meta = UNIT_META[currentUnit] || UNIT_META['all'];
  document.getElementById('pageTitle').textContent    = meta.label;
  document.getElementById('pageSubtitle').textContent = meta.sub;
}

// ── JUMP TO Q NO. ─────────────────────────────────
function doJump() {
  const input = document.getElementById('jumpInput');
  const val   = parseInt(input.value, 10);
  if (!val || val < 1) { showToast('Enter a valid Q number'); return; }

  // If the question isn't in the current filter, temporarily show all
  const exists = filteredList.some(q => q.id === val);
  if (!exists) {
    // Expand filters so the question is visible
    document.getElementById('f-mcq').checked  = true;
    document.getElementById('f-code').checked = true;
    document.getElementById('f-pyq').checked  = false;
    if (descOnly) { descOnly = false; updateDescBtn(); }
    filterAndRender();
  }

  setTimeout(() => {
    const card = document.getElementById(`card-${val}`);
    if (!card) { showToast(`Q${val} not found`); return; }
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.outline   = '2px solid var(--red)';
    card.style.boxShadow = '0 0 0 6px rgba(230,51,51,0.18)';
    clearTimeout(card._jumpTimer);
    card._jumpTimer = setTimeout(() => {
      card.style.outline   = '';
      card.style.boxShadow = '';
    }, 1800);
    showToast(`📌 Jumped to Q${val}`);
    input.value = '';
  }, exists ? 0 : 100);
}

// ── DESCRIPTIVE ONLY TOGGLE ───────────────────────
function toggleDescOnly() {
  descOnly = !descOnly;
  updateDescBtn();
  // Sync with sidebar checkbox
  document.getElementById('f-mcq').checked  = !descOnly;
  document.getElementById('f-code').checked = true;
  filterAndRender();
}

function updateDescBtn() {
  const btn  = document.getElementById('descBtn');
  const dot  = document.getElementById('descDot');
  const lbl  = document.getElementById('descBtnLabel');
  if (!btn) return;
  if (descOnly) {
    btn.classList.add('active');
    dot.classList.add('on');
    lbl.textContent = 'Descriptive ✓';
  } else {
    btn.classList.remove('active');
    dot.classList.remove('on');
    lbl.textContent = 'Descriptive Only';
  }
}

// ── BIND EVENTS ───────────────────────────────────
function bindEvents() {
  // Sidebar filter checkboxes
  ['f-mcq','f-code','f-pyq'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      // Keep descOnly in sync if user manually unchecks MCQ
      const mcqChecked  = document.getElementById('f-mcq').checked;
      const codeChecked = document.getElementById('f-code').checked;
      if (!mcqChecked && codeChecked) {
        descOnly = true; updateDescBtn();
      } else if (mcqChecked) {
        descOnly = false; updateDescBtn();
      }
      filterAndRender();
    });
  });

  // Keyboard: Enter on jump input
  document.getElementById('jumpInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doJump(); }
  });

  // Search input in sidebar
  const searchInput = document.getElementById('searchInput');
  searchInput?.addEventListener('input', () => filterAndRender());
  searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') e.preventDefault();
  });

  // Shuffle btn
  document.getElementById('shuffleBtn')?.addEventListener('click', () => {
    filteredList = [...filteredList].sort(() => Math.random() - 0.5);
    renderCards();
    showToast('🔀 Shuffled!');
  });

  document.querySelectorAll('[data-unit-link]').forEach(a => {
    a.classList.toggle('active', a.dataset.unitLink === currentUnit);
  });
  updateTitles();
}

// ── FILTER & RENDER ───────────────────────────────
function filterAndRender() {
  const showMCQ  = document.getElementById('f-mcq').checked;
  const showCode = document.getElementById('f-code').checked;
  const pyqOnly  = document.getElementById('f-pyq').checked;
  const search   = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();

  filteredList = ALL_QUESTIONS.filter(q => {
    if (currentUnit !== 'all' && q.unit !== parseInt(currentUnit)) return false;
    if (q.type === 'mcq'         && !showMCQ)  return false;
    if (q.type === 'descriptive' && !showCode) return false;
    if (pyqOnly && !q.pyq)                     return false;
    if (search && !q.question.toLowerCase().includes(search)) return false;
    return true;
  });

  document.getElementById('statShowing').textContent = filteredList.length;
  document.getElementById('statPyq').textContent     = filteredList.filter(q => q.pyq).length;
  document.getElementById('statTotal').textContent   = ALL_QUESTIONS.length;

  renderCards();
}

// ── RENDER CARDS ──────────────────────────────────
function renderCards() {
  const container = document.getElementById('cardsContainer');
  const empty     = document.getElementById('emptyState');

  if (filteredList.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  container.className = `cards-grid${currentView === 'grid' ? '' : ' list-view'}`;
  container.innerHTML = filteredList.map((q, idx) => buildCard(q, idx)).join('');

  filteredList.forEach(q => {
    const card = document.getElementById(`card-${q.id}`);
    if (!card) return;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.opt-btn') ||
          e.target.closest('.copy-code-btn') ||
          e.target.closest('.chatgpt-btn')) return;
      toggleCard(q, card);
    });
  });
}

// ── BUILD CARD HTML ───────────────────────────────
function buildCard(q, idx) {
  const typeCls   = { mcq: 'tag-mcq', descriptive: 'tag-code' };
  const typeLabel = { mcq: 'MCQ',     descriptive: 'Descriptive' };

  const pyqBadge   = q.pyq   ? `<span class="tag tag-pyq">⭐ ${q.pyq_year || 'PYQ'}</span>` : '';
  const marksBadge = q.marks ? `<span class="tag tag-marks">★ ${q.marks}m</span>`           : '';
  const unitCls    = UNIT_COLORS[q.unit] || 'tag-unit1';

  const qLines = q.question.split('\n');
  let qHtml = '';
  if (qLines.length > 1) {
    qHtml = `${escHtml(qLines[0])}<pre>${escHtml(qLines.slice(1).join('\n'))}</pre>`;
  } else {
    qHtml = escHtml(q.question);
  }

  const delay = Math.min(idx * 8, 300);

  return `
    <div class="question-card" id="card-${q.id}" style="animation-delay:${delay}ms">
      <div class="card-head">
        <span class="card-qnum">Q${q.id}</span>
        <div class="card-tags">
          <span class="tag ${typeCls[q.type]}">${typeLabel[q.type]}</span>
          <span class="tag ${unitCls}">U${q.unit}</span>
          ${pyqBadge}${marksBadge}
        </div>
      </div>
      <div class="card-question">${qHtml}</div>
      <div class="card-foot">
        <span class="card-marks-chip">${q.marks ? `★ ${q.marks} marks` : ''}</span>
        <span class="expand-hint">
          <i class="bi bi-chevron-down"></i>
          tap to ${q.type === 'mcq' ? 'answer' : 'view solution'}
        </span>
      </div>
      <div class="answer-expand" id="expand-${q.id}">
        <div class="answer-inner" id="inner-${q.id}"></div>
      </div>
    </div>`;
}

// ── TOGGLE CARD ───────────────────────────────────
function toggleCard(q, card) {
  const expandDiv = document.getElementById(`expand-${q.id}`);
  const innerDiv  = document.getElementById(`inner-${q.id}`);
  const isOpen    = expandDiv.classList.contains('show');

  if (!isOpen) {
    if (!expandDiv.dataset.loaded) {
      innerDiv.innerHTML = buildAnswerContent(q);
      expandDiv.dataset.loaded = 'true';
      if (q.type === 'mcq') attachMcqListeners(q);
      attachCopyBtn(q);
      attachChatGptBtn(q);
    }
    expandDiv.classList.add('show');
    card.classList.add('expanded');
  } else {
    expandDiv.classList.remove('show');
    card.classList.remove('expanded');
  }
}

// ── BUILD ANSWER CONTENT ─────────────────────────
function buildAnswerContent(q) {
  if (q.type === 'mcq') {
    const letters = ['A','B','C','D'];
    const opts = (q.options || []).map((opt, i) => `
      <button class="opt-btn" data-letter="${letters[i]}" data-qid="${q.id}">
        <span class="opt-letter">${letters[i]}</span>
        <span>${escHtml(opt)}</span>
      </button>`).join('');

    const expl = q.explanation
      ? `<div class="explanation-box" id="expl-${q.id}" style="display:none">${q.explanation}</div>`
      : '';

    return `
      <div class="mcq-options" id="opts-${q.id}">${opts}</div>
      <div class="feedback-line" id="fb-${q.id}" style="display:none"></div>
      ${expl}`;
  }

  if (q.type === 'descriptive') {
    const code = q.code || q.answer || '';
    const expl = q.explanation
      ? `<div class="explanation-box" style="margin-top:10px">${q.explanation}</div>`
      : '';

    return `
      <div class="code-answer-box">
        <div class="code-answer-header">
          <span class="code-answer-label"><i class="bi bi-terminal-fill me-1"></i>Python Solution</span>
          <button class="copy-code-btn" id="copy-${q.id}">⎘ Copy</button>
        </div>
        <pre class="code-answer-body">${colorizeCode(escHtml(code))}</pre>
      </div>
      ${expl}
      <button class="chatgpt-btn" id="chatgpt-${q.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494z"/>
        </svg>
        Ask ChatGPT for detailed explanation
      </button>`;
  }

  return '<p style="color:var(--dim);font-size:0.8rem">No answer available.</p>';
}

// ── ATTACH HANDLERS ───────────────────────────────
function attachCopyBtn(q) {
  const btn = document.getElementById(`copy-${q.id}`);
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const code = q.code || q.answer || '';
    navigator.clipboard.writeText(code).then(() => {
      btn.textContent = '✓ Copied!';
      setTimeout(() => btn.textContent = '⎘ Copy', 1800);
    });
  });
}

function attachChatGptBtn(q) {
  const btn = document.getElementById(`chatgpt-${q.id}`);
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const prompt = encodeURIComponent(`Python Question:\n\n${q.question}\n\nPlease give a detailed Python explanation with working code.`);
    window.open(`https://chatgpt.com/?q=${prompt}`, '_blank');
  });
}

// ── MCQ OPTION LISTENERS ─────────────────────────
function attachMcqListeners(q) {
  const opts    = document.querySelectorAll(`#opts-${q.id} .opt-btn`);
  const fbDiv   = document.getElementById(`fb-${q.id}`);
  const explDiv = document.getElementById(`expl-${q.id}`);

  opts.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const selected = btn.dataset.letter;
      const correct  = q.answer;
      const isRight  = selected === correct;

      opts.forEach(b => b.classList.remove('correct','wrong'));
      btn.classList.add(isRight ? 'correct' : 'wrong');
      if (!isRight) {
        opts.forEach(b => { if (b.dataset.letter === correct) b.classList.add('correct'); });
      }

      fbDiv.style.display = 'block';
      fbDiv.className     = `feedback-line ${isRight ? 'feedback-correct' : 'feedback-wrong'}`;
      fbDiv.innerHTML     = isRight
        ? `✅ Correct! The answer is <strong>${correct}</strong>.`
        : `❌ Wrong! Correct answer is <strong>${correct}</strong>.`;

      if (explDiv) explDiv.style.display = 'block';
    });
  });
}

// ── SYNTAX COLORIZER ─────────────────────────────
function colorizeCode(html) {
  return html
    .replace(/(# .+)/g, '<span class="cc-comment">$1</span>')
    .replace(/\b(import|from|def|class|return|if|else|elif|for|while|in|not|and|or|True|False|None|with|as|try|except|raise|pass|break|continue|lambda|yield|async|await)\b/g,
      '<span class="cc-kw">$1</span>')
    .replace(/(&quot;[^&]*&quot;|&#039;[^&#]*&#039;)/g,
      '<span class="cc-str">$1</span>');
}

// ── EXPAND / COLLAPSE ALL ─────────────────────────
function expandAll() {
  filteredList.forEach(q => {
    const expand = document.getElementById(`expand-${q.id}`);
    const inner  = document.getElementById(`inner-${q.id}`);
    if (!expand || expand.classList.contains('show')) return;
    if (!expand.dataset.loaded) {
      inner.innerHTML = buildAnswerContent(q);
      expand.dataset.loaded = 'true';
      if (q.type === 'mcq') attachMcqListeners(q);
      attachCopyBtn(q);
      attachChatGptBtn(q);
    }
    expand.classList.add('show');
    document.getElementById(`card-${q.id}`)?.classList.add('expanded');
  });
  showToast('📖 All expanded');
}

function collapseAll() {
  document.querySelectorAll('.answer-expand.show').forEach(el => el.classList.remove('show'));
  document.querySelectorAll('.question-card.expanded').forEach(el => el.classList.remove('expanded'));
  showToast('📕 All collapsed');
}

// ── VIEW TOGGLE ───────────────────────────────────
function setView(view, reRender = true) {
  currentView = view;
  document.getElementById('viewGrid')?.classList.toggle('active', view === 'grid');
  document.getElementById('viewList')?.classList.toggle('active', view === 'list');
  if (reRender) renderCards();
}

// ── SIDEBAR TOGGLE ────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const layout  = document.querySelector('.unit-layout');
  if (window.innerWidth <= 900) {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show', sidebar.classList.contains('open'));
  } else {
    layout.classList.toggle('sidebar-closed');
  }
}

// ── NAV TOGGLE ────────────────────────────────────
function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ── RESET FILTERS ─────────────────────────────────
function resetFilters() {
  document.getElementById('f-mcq').checked    = true;
  document.getElementById('f-code').checked   = true;
  document.getElementById('f-pyq').checked    = false;
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  const jumpInput = document.getElementById('jumpInput');
  if (jumpInput) jumpInput.value = '';
  descOnly = false;
  updateDescBtn();
  filterAndRender();
  showToast('🔄 Filters reset');
}

// ── TOAST ─────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2200);
}

// ── UTILS ─────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

// ── EXPOSE GLOBALS ────────────────────────────────
Object.assign(window, {
  toggleNav,
  toggleSidebar,
  resetFilters,
  expandAll,
  collapseAll,
  setView,
  doJump,
  toggleDescOnly,
});

window.addEventListener('scroll', () => {
  document.getElementById('mainNav')?.classList.toggle('scrolled', window.scrollY > 10);
});

// ── START ─────────────────────────────────────────
init();
