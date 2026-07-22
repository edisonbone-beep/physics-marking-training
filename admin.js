var ADMIN_PWD = "123456";
var SUPABASE_URL = 'https://kyhbgkfetxmqtegjhqsz.supabase.co';
var SUPABASE_KEY = 'sb_publishable_70RLAQJoYff_ie2dtXX0aw_i1aqZFoB';
var supabase;
try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch(e) {
  console.error('Supabase init error:', e);
  supabase = null;
}

var allResults = [];

function adminLogin() {
  const pwd = document.getElementById('pwdInput').value;
  if (pwd === ADMIN_PWD) {
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('adminDash').classList.remove('hidden');
    loadAdminData();
  } else {
    document.getElementById('errorMsg').classList.remove('hidden');
  }
}

document.getElementById('pwdInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') adminLogin();
});

async function loadAdminData() {
  document.getElementById('resultsTable').innerHTML = '<div class="loading">Loading...</div>';

  const { data, error } = await supabase
    .from('marking_results')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    document.getElementById('resultsTable').innerHTML = '<div class="loading" style="color:#e74c3c;">Error: ' + error.message + '</div>';
    return;
  }

  allResults = data || [];
  const userSet = new Set(allResults.map(r => r.teacher_name));

  // Calculate accuracy: % of questions where myMark === officialMark
  let totalQuestions = 0;
  let matchedQuestions = 0;
  for (const r of allResults) {
    if (r.results && Array.isArray(r.results)) {
      for (const q of r.results) {
        if (q.officialMark !== null && q.officialMark !== undefined) {
          totalQuestions++;
          if (q.myMark === q.officialMark) matchedQuestions++;
        }
      }
    }
  }
  const accuracy = totalQuestions > 0 ? Math.round(matchedQuestions / totalQuestions * 100) : 0;

  // Stats
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card"><h3>Total Teachers</h3><div class="stat-value">${userSet.size}</div></div>
    <div class="stat-card"><h3>Total Submissions</h3><div class="stat-value">${allResults.length}</div></div>
    <div class="stat-card"><h3>Avg Marking Accuracy</h3><div class="stat-value">${accuracy}%</div></div>
    <div class="stat-card"><h3>Avg Time</h3><div class="stat-value">${allResults.length > 0 ? formatTime(Math.round(allResults.reduce((s,r) => s + r.time_taken, 0) / allResults.length)) : '-'}</div></div>
  `;

  // Results table
  let tableHtml = `<table>
    <tr><th></th><th>Teacher</th><th>Paper</th><th>Script</th><th>My Mark</th><th>Official</th><th>Full</th><th>Diff</th><th>Accuracy</th><th>Time</th><th>Date</th></tr>`;

  for (let idx = 0; idx < allResults.length; idx++) {
    const r = allResults[idx];
    const diff = r.official_total !== null && r.official_total !== undefined ? r.my_total - r.official_total : null;
    let diffHtml = '-';
    if (diff !== null) {
      if (diff > 0) diffHtml = `<span class="diff-pos">+${diff}</span>`;
      else if (diff < 0) diffHtml = `<span class="diff-neg">${diff}</span>`;
      else diffHtml = `<span class="diff-zero">0</span>`;
    }

    // Per-submission accuracy
    let subTotal = 0, subMatch = 0;
    if (r.results && Array.isArray(r.results)) {
      for (const q of r.results) {
        if (q.officialMark !== null && q.officialMark !== undefined) {
          subTotal++;
          if (q.myMark === q.officialMark) subMatch++;
        }
      }
    }
    const subAcc = subTotal > 0 ? Math.round(subMatch / subTotal * 100) + '%' : '-';

    const dateStr = new Date(r.created_at).toLocaleString();

    tableHtml += `<tr>
      <td><button class="expand-btn" onclick="toggleDetail(${idx}, this)">+</button></td>
      <td>${r.teacher_name}</td>
      <td>${r.paper}</td>
      <td>${r.script}</td>
      <td>${r.my_total}</td>
      <td>${r.official_total !== null && r.official_total !== undefined ? r.official_total : '-'}</td>
      <td>${r.full_mark}</td>
      <td>${diffHtml}</td>
      <td>${subAcc}</td>
      <td>${formatTime(r.time_taken)}</td>
      <td>${dateStr}</td>
    </tr>`;
    tableHtml += `<tr class="detail-row hidden" id="detail_${idx}"><td colspan="11"><div id="detail_content_${idx}"></div></td></tr>`;
  }

  tableHtml += `</table>`;
  document.getElementById('resultsTable').innerHTML = tableHtml;
}

function toggleDetail(idx, btn) {
  const row = document.getElementById('detail_' + idx);
  const isHidden = row.classList.contains('hidden');
  row.classList.toggle('hidden');
  btn.textContent = isHidden ? '-' : '+';

  if (isHidden) {
    const r = allResults[idx];
    let html = '<table class="detail-table"><tr><th>Part</th><th>Your Mark</th><th>Official</th><th>Max</th><th>Match</th></tr>';
    if (r.results && Array.isArray(r.results)) {
      for (const q of r.results) {
        const isMatch = q.officialMark !== null && q.officialMark !== undefined ? q.myMark === q.officialMark : null;
        const icon = isMatch === null ? '-' : (isMatch ? '<span style="color:#27ae60;">&#10003;</span>' : '<span style="color:#e74c3c;">&#10007;</span>');
        const bg = isMatch === false ? '#ffeaea' : 'transparent';
        html += `<tr style="background:${bg};">`;
        html += `<td style="font-weight:600;">${q.label}</td>`;
        html += `<td>${q.myMark}</td>`;
        html += `<td>${q.officialMark !== null && q.officialMark !== undefined ? q.officialMark : '-'}</td>`;
        html += `<td>${q.maxMark !== null ? q.maxMark : '-'}</td>`;
        html += `<td>${icon}</td>`;
        html += `</tr>`;
      }
    }
    html += '</table>';
    document.getElementById('detail_content_' + idx).innerHTML = html;
  }
}

function formatTime(secs) {
  if (!secs && secs !== 0) return '-';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m + 'm ' + s + 's';
}

function exportCSV() {
  if (allResults.length === 0) { alert('No data to export'); return; }

  let csv = 'Teacher,Paper,Script,My Mark,Official,Full Mark,Diff,Accuracy,Time,Date\n';
  for (const r of allResults) {
    const diff = r.official_total !== null && r.official_total !== undefined ? r.my_total - r.official_total : '';
    let subTotal = 0, subMatch = 0;
    if (r.results && Array.isArray(r.results)) {
      for (const q of r.results) {
        if (q.officialMark !== null && q.officialMark !== undefined) {
          subTotal++;
          if (q.myMark === q.officialMark) subMatch++;
        }
      }
    }
    const acc = subTotal > 0 ? Math.round(subMatch / subTotal * 100) + '%' : '';
    csv += `"${r.teacher_name}","${r.paper}","${r.script}",${r.my_total},${r.official_total ?? ''},${r.full_mark},${diff},${acc},"${formatTime(r.time_taken)}","${new Date(r.created_at).toLocaleString()}"\n`;
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'marking_results_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}
