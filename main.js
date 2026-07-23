// ============================================================
// SUPABASE
// ============================================================
var SUPABASE_URL = 'https://kyhbgkfetxmqtegjhqsz.supabase.co';
var SUPABASE_KEY = 'sb_publishable_70RLAQJoYff_ie2dtXX0aw_i1aqZFoB';
var supabase;
try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch(e) {
  console.error('Supabase init error:', e);
  supabase = null;
}

// ============================================================
// STATE
// ============================================================
var currentUser = '';
var currentPaper = null;
var currentScript = null;
var timerInterval = null;
var timerSeconds = 0;
var questionScores = {};

// ============================================================
// LOGIN
// ============================================================
function doLogin() {
  const name = document.getElementById('nameInput').value.trim();
  if (!name) { alert('Please enter your name'); return; }
  currentUser = name;
  showSelectionPage();
}

document.getElementById('nameInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') doLogin();
});

// ============================================================
// SELECTION PAGE
// ============================================================
function showSelectionPage() {
  hideAll();
  document.getElementById('selectionPage').classList.remove('hidden');
  document.getElementById('userInfo').textContent = currentUser;
  renderSelection();
}

function renderSelection() {
  const container = document.getElementById('selectionContent');
  const categories = {};

  for (const [pkey, pinfo] of Object.entries(PAPERS)) {
    const cat = pinfo.category;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ key: pkey, ...pinfo });
  }

  let html = '';
  for (const [cat, paperList] of Object.entries(categories)) {
    html += `<div class="category-section">`;
    html += `<div class="category-title ${cat.toLowerCase()}">${cat === 'IG' ? 'IGCSE' : 'A-Level'} Physics</div>`;
    html += `<div class="papers-grid">`;

    for (const p of paperList) {
      html += `<div class="paper-card">`;
      html += `<h3>${p.subject} - ${p.paper}</h3>`;
      html += `<div class="paper-sub">Full mark: ${p.fullMark} | Scripts: ${Object.keys(p.scripts).join(', ')}</div>`;
      html += `<div class="script-list">`;

      for (const sid of Object.keys(p.scripts)) {
        const doneKey = `done_${p.key}_${sid}`;
        const isDone = localStorage.getItem(doneKey) === 'true';
        html += `<button class="script-btn ${isDone ? 'done' : ''}" onclick="startMarking('${p.key}', '${sid}')">Script ${sid}${isDone ? ' \u2713' : ''}</button>`;
      }

      html += `</div></div>`;
    }

    html += `</div></div>`;
  }

  container.innerHTML = html;
}

// ============================================================
// MARKING PAGE
// ============================================================
function startMarking(paperKey, scriptId) {
  currentPaper = paperKey;
  currentScript = scriptId;
  const pinfo = PAPERS[paperKey];
  const sinfo = pinfo.scripts[scriptId];

  hideAll();
  document.getElementById('markingPage').classList.remove('hidden');
  document.getElementById('markingTitle').textContent = `${pinfo.subject} ${pinfo.paper} - Script ${scriptId}`;
  document.getElementById('markingUserInfo').textContent = currentUser;
  document.getElementById('fullMark').textContent = pinfo.fullMark;

  // Render script images (left panel) with zoom/pan wrapper
  let scriptHtml = '<div class="panel-content">';
  for (const img of sinfo.images) {
    scriptHtml += `<img src="${img}" loading="lazy" alt="Script page">`;
  }
  scriptHtml += '</div>';
  scriptHtml += '<div class="zoom-controls"><button onclick="zoomPanel(\'scriptPanel\',-1)">\u2212</button><span class="zoom-label" id="zoomLabel_scriptPanel">100%</span><button onclick="zoomPanel(\'scriptPanel\',1)">+</button><button onclick="zoomPanel(\'scriptPanel\',0)" style="font-size:13px;">\u21BA</button></div>';
  document.getElementById('scriptPanel').innerHTML = scriptHtml;

  // Render MS images (middle panel) with zoom/pan wrapper
  let msHtml = '<div class="panel-content">';
  for (const img of pinfo.msImages) {
    msHtml += `<img src="${img}" loading="lazy" alt="Mark scheme page">`;
  }
  msHtml += '</div>';
  msHtml += '<div class="zoom-controls"><button onclick="zoomPanel(\'msPanel\',-1)">\u2212</button><span class="zoom-label" id="zoomLabel_msPanel">100%</span><button onclick="zoomPanel(\'msPanel\',1)">+</button><button onclick="zoomPanel(\'msPanel\',0)" style="font-size:13px;">\u21BA</button></div>';
  document.getElementById('msPanel').innerHTML = msHtml;

  // Initialize zoom/pan for both panels
  initZoomPan('scriptPanel');
  initZoomPan('msPanel');

  // Build question list (right panel)
  questionScores = {};
  document.getElementById('totalScore').textContent = '0';

  // Generate question items from feedback if available, or generic list
  let questions = [];
  if (pinfo.hasFb && pinfo.feedback && pinfo.feedback[scriptId]) {
    const fb = pinfo.feedback[scriptId];
    questions = fb.questions || [];
  }

  let qHtml = '';
  if (questions.length > 0) {
    // Group by question number
    const groups = {};
    const groupOrder = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qNum = parseInt(q.label.match(/(\d+)/)?.[1]) || 0;
      if (!groups[qNum]) {
        groups[qNum] = [];
        groupOrder.push(qNum);
      }
      groups[qNum].push({ ...q, _idx: i });
    }

    for (const qNum of groupOrder) {
      const gItems = groups[qNum];
      const gMax = gItems.reduce((s, q) => s + (q.maxMark || 0), 0);

      if (groupOrder.length > 1) {
        qHtml += `<div class="q-group">`;
        qHtml += `<div class="q-group-header" onclick="toggleGroup(this)" id="qgh_${qNum}">`;
        qHtml += `<div class="qg-left"><span class="qg-arrow">\u25BC</span><span>Q${qNum}</span></div>`;
        qHtml += `<span class="q-group-sub" id="qgs_${qNum}">- / ${gMax}</span>`;
        qHtml += `</div>`;
        qHtml += `<div class="q-group-body" id="qgb_${qNum}">`;
      }

      for (const q of gItems) {
        const i = q._idx;
        const qid = `q_${i}`;
        questionScores[qid] = { label: q.label, questionNum: qNum, score: null, maxMark: q.maxMark, officialMark: q.officialMark };

        qHtml += `<div class="q-item" id="qi_${i}">`;
        qHtml += `<div class="q-label">${q.label}</div>`;
        qHtml += `<div class="q-marks">Max: ${q.maxMark !== null ? q.maxMark : '?'}</div>`;
        qHtml += `<div class="q-controls">`;
        qHtml += `<button onclick="markCorrect('${qid}', ${i})" id="btn_c_${i}">\u2713</button>`;
        qHtml += `<button onclick="markWrong('${qid}', ${i})" id="btn_w_${i}">\u2717</button>`;
        qHtml += `<input type="number" min="0" max="${q.maxMark || 99}" id="inp_${i}" onchange="markManual('${qid}', ${i})" placeholder="0">`;
        qHtml += `<span class="q-score-display" id="sd_${i}">-</span>`;
        qHtml += `</div></div>`;
      }

      if (groupOrder.length > 1) {
        qHtml += `</div></div>`;
      }
    }
  } else {
    // No feedback data - show generic question inputs
    for (let i = 0; i < 15; i++) {
      const qid = `q_${i}`;
      questionScores[qid] = { label: `Q${i+1}`, questionNum: i+1, score: null, maxMark: null, officialMark: null };
      qHtml += `<div class="q-item" id="qi_${i}">`;
      qHtml += `<div class="q-label">Q${i+1}</div>`;
      qHtml += `<div class="q-controls">`;
      qHtml += `<button onclick="markCorrect('${qid}', ${i})" id="btn_c_${i}">\u2713</button>`;
      qHtml += `<button onclick="markWrong('${qid}', ${i})" id="btn_w_${i}">\u2717</button>`;
      qHtml += `<input type="number" min="0" max="99" id="inp_${i}" onchange="markManual('${qid}', ${i})" placeholder="0">`;
      qHtml += `<span class="q-score-display" id="sd_${i}">-</span>`;
      qHtml += `</div></div>`;
    }
  }

  document.getElementById('questionList').innerHTML = qHtml;

  // Start timer
  startTimer();
}

function markCorrect(qid, idx) {
  const q = questionScores[qid];
  const maxM = q.maxMark !== null ? q.maxMark : 0;
  q.score = maxM;
  document.getElementById(`btn_c_${idx}`).className = 'active-correct';
  document.getElementById(`btn_w_${idx}`).className = '';
  document.getElementById(`inp_${idx}`).value = maxM;
  document.getElementById(`sd_${idx}`).textContent = `${maxM}/${maxM}`;
  document.getElementById(`qi_${idx}`).classList.add('scored');
  updateTotal();
}

function markWrong(qid, idx) {
  const q = questionScores[qid];
  q.score = 0;
  document.getElementById(`btn_c_${idx}`).className = '';
  document.getElementById(`btn_w_${idx}`).className = 'active-wrong';
  document.getElementById(`inp_${idx}`).value = 0;
  document.getElementById(`sd_${idx}`).textContent = `0/${q.maxMark !== null ? q.maxMark : '?'}`;
  document.getElementById(`qi_${idx}`).classList.add('scored');
  updateTotal();
}

function markManual(qid, idx) {
  const q = questionScores[qid];
  const val = parseInt(document.getElementById(`inp_${idx}`).value);
  if (isNaN(val)) return;
  q.score = val;
  document.getElementById(`btn_c_${idx}`).className = '';
  document.getElementById(`btn_w_${idx}`).className = '';
  document.getElementById(`sd_${idx}`).textContent = `${val}/${q.maxMark !== null ? q.maxMark : '?'}`;
  document.getElementById(`qi_${idx}`).classList.add('scored');
  updateTotal();
}

function updateTotal() {
  let total = 0;
  const groupData = {};
  for (const q of Object.values(questionScores)) {
    if (q.score !== null) total += q.score;
    const gn = q.questionNum;
    if (gn !== undefined && gn !== null) {
      if (!groupData[gn]) groupData[gn] = { scored: 0, max: 0, allScored: true, allCorrect: true };
      groupData[gn].max += (q.maxMark || 0);
      if (q.score !== null) {
        groupData[gn].scored += q.score;
        if (q.score !== q.maxMark) groupData[gn].allCorrect = false;
      } else {
        groupData[gn].allScored = false;
        groupData[gn].allCorrect = false;
      }
    }
  }
  document.getElementById('totalScore').textContent = total;
  for (const [gn, gd] of Object.entries(groupData)) {
    const subEl = document.getElementById('qgs_' + gn);
    if (subEl) subEl.textContent = gd.scored + ' / ' + gd.max;
    const hdrEl = document.getElementById('qgh_' + gn);
    if (hdrEl) {
      hdrEl.classList.remove('all-correct', 'has-wrong');
      if (gd.allScored && gd.allCorrect) hdrEl.classList.add('all-correct');
      else if (gd.allScored && !gd.allCorrect) hdrEl.classList.add('has-wrong');
    }
  }
}

function toggleGroup(el) {
  el.classList.toggle('collapsed');
  const bodyId = 'qgb_' + el.id.split('_')[1];
  const body = document.getElementById(bodyId);
  if (body) body.classList.toggle('collapsed');
}

// ============================================================
// TIMER
// ============================================================
function startTimer() {
  stopTimer();
  timerSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(function() {
    timerSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  document.getElementById('timerDisplay').textContent =
    String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m + 'm ' + s + 's';
}

// ============================================================
// SUBMIT
// ============================================================
function submitMarking() {
  if (!confirm('Submit your marking? You cannot change it after submission.')) return;

  stopTimer();

  const pinfo = PAPERS[currentPaper];
  let myTotal = 0;
  const results = [];
  const mismatches = [];

  for (const [qid, q] of Object.entries(questionScores)) {
    const score = q.score !== null ? q.score : 0;
    myTotal += score;
    const entry = {
      label: q.label,
      questionNum: q.questionNum,
      myMark: score,
      officialMark: q.officialMark,
      maxMark: q.maxMark,
    };
    results.push(entry);

    // Check mismatch (only if we have official mark)
    if (q.officialMark !== null && q.officialMark !== undefined && score !== q.officialMark) {
      mismatches.push(entry);
    }
  }

  // Get commentary from feedback
  let fbQuestions = [];
  if (pinfo.hasFb && pinfo.feedback && pinfo.feedback[currentScript]) {
    fbQuestions = pinfo.feedback[currentScript].questions || [];
  }

  const officialTotal = pinfo.feedback && pinfo.feedback[currentScript]
    ? pinfo.feedback[currentScript].totalMark : null;

  // Save to Supabase
  supabase.from('marking_results').insert({
    teacher_name: currentUser,
    paper: currentPaper,
    script: currentScript,
    my_total: myTotal,
    official_total: officialTotal,
    full_mark: pinfo.fullMark,
    time_taken: timerSeconds,
    results: results,
  }).then(({ error }) => {
    if (error) console.error('Supabase save error:', error);
  });

  const saveData = {
    user: currentUser,
    paper: currentPaper,
    script: currentScript,
    myTotal: myTotal,
    officialTotal: officialTotal,
    fullMark: pinfo.fullMark,
    timeTaken: timerSeconds,
    results: results,
  };
  localStorage.setItem(`done_${currentPaper}_${currentScript}`, 'true');

  // Show results
  showResults(saveData, mismatches, fbQuestions);
}

// ============================================================
// RESULTS PAGE
// ============================================================
function showResults(saveData, mismatches, fbQuestions) {
  hideAll();
  document.getElementById('resultsPage').classList.remove('hidden');
  document.getElementById('resultsUserInfo').textContent = currentUser;

  const pinfo = PAPERS[saveData.paper];
  const sinfo = pinfo.scripts[saveData.script];

  // Left panel: student script images
  let scriptHtml = '';
  for (const img of sinfo.images) {
    scriptHtml += `<img src="${img}" loading="lazy" alt="Script page">`;
  }
  document.getElementById('resultsScript').innerHTML = scriptHtml;

  // Right panel: summary + mismatched questions with feedback
  let html = `<div class="results-summary">`;
  html += `<h2 style="font-size:16px;margin-bottom:4px;">${pinfo.subject} ${pinfo.paper} - Script ${saveData.script}</h2>`;
  html += `<div class="big-score">${saveData.myTotal} / ${saveData.fullMark}</div>`;
  html += `<div class="score-detail">Your mark: ${saveData.myTotal}`;
  if (saveData.officialTotal !== null && saveData.officialTotal !== undefined) {
    html += ` | Official: ${saveData.officialTotal}`;
    const diff = saveData.myTotal - saveData.officialTotal;
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    html += ` | Diff: ${diffStr}`;
  }
  html += `</div>`;
  html += `<div class="time-taken">Time: ${formatTime(saveData.timeTaken)}</div>`;
  html += `</div>`;

  // Build feedback map
  const fbMap = {};
  for (const fq of fbQuestions) { fbMap[fq.label] = fq; }

  // Find mismatched questions
  const mismatched = [];
  for (const r of saveData.results) {
    if (r.officialMark !== null && r.officialMark !== undefined && r.myMark !== r.officialMark) {
      mismatched.push(r);
    }
  }

  if (mismatched.length > 0) {
    html += `<div class="fb-section">`;
    html += `<h3>Mismatched (${mismatched.length})</h3>`;

    // Group by question number
    const groups = {};
    const groupOrder = [];
    for (const m of mismatched) {
      const qn = m.questionNum || 0;
      if (!groups[qn]) { groups[qn] = []; groupOrder.push(qn); }
      groups[qn].push(m);
    }

    for (const qn of groupOrder) {
      const items = groups[qn];
      html += `<div style="margin-bottom:14px;">`;
      html += `<div style="font-weight:700;font-size:15px;margin-bottom:6px;color:#333;padding:6px 10px;background:#f0f0f0;border-radius:6px;">Q${qn}</div>`;
      for (const m of items) {
        const fb = fbMap[m.label];
        const fbCommentary = fb ? fb.commentary : '';
        html += `<div class="fb-item">`;
        html += `<div class="fb-label">${m.label}</div>`;
        html += `<div class="fb-marks">`;
        html += `<span style="color:#e74c3c;font-weight:600;">Your: ${m.myMark}</span>`;
        html += ` | <span style="color:#27ae60;font-weight:600;">Official: ${m.officialMark}</span>`;
        html += ` / Max: ${m.maxMark !== null ? m.maxMark : '?'}`;
        html += `</div>`;
        if (fbCommentary) {
          html += `<div class="fb-commentary">${fbCommentary}</div>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  } else {
    html += `<div style="text-align:center;padding:40px 20px;color:#27ae60;font-size:18px;font-weight:600;">All marks match official!</div>`;
  }

  document.getElementById('resultsContent').innerHTML = html;
}

// ============================================================
// NAVIGATION
// ============================================================
function goBackToSelection() {
  stopTimer();
  showSelectionPage();
}

function hideAll() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('selectionPage').classList.add('hidden');
  document.getElementById('markingPage').classList.add('hidden');
  document.getElementById('resultsPage').classList.add('hidden');
}

// === Zoom & Pan for image panels ===
var panelStates = {};

function initZoomPan(panelId) {
  var panel = document.getElementById(panelId);
  var content = panel.querySelector('.panel-content');
  if (!content) return;

  panelStates[panelId] = { scale: 1, tx: 0, ty: 0 };

  // Button-only zoom, no wheel hijack, no drag — native scroll handles page navigation
}

function zoomPanel(panelId, dir) {
  var s = panelStates[panelId];
  if (!s) return;

  if (dir === 0) {
    s.scale = 1;
    applyTransform(panelId);
    updateZoomLabel(panelId);
    return;
  }

  var factor = dir > 0 ? 1.2 : 1 / 1.2;
  s.scale = Math.min(Math.max(s.scale * factor, 0.5), 5);

  applyTransform(panelId);
  updateZoomLabel(panelId);
}

function applyTransform(panelId) {
  var s = panelStates[panelId];
  var panel = document.getElementById(panelId);
  var content = panel.querySelector('.panel-content');
  if (!content) return;
  content.style.width = (s.scale * 100) + '%';
}

function updateZoomLabel(panelId) {
  var s = panelStates[panelId];
  var label = document.getElementById('zoomLabel_' + panelId);
  if (label) label.textContent = Math.round(s.scale * 100) + '%';
}
