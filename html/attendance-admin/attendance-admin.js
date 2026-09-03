/* ── Constants ──────────────────────────────────────────────────────────── */
const STATUS_LABELS = {
  'present':'Present','absent':'Absent','half-day':'Half Day',
  'paid-leave':'Paid Leave','unpaid-leave':'Unpaid Leave','sick-leave':'Sick Leave',
  'holiday':'Holiday','weekly-off':'Weekly Off','on-duty':'On Duty','active':'Active'
};
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function statusBadge(st) {
  const lbl = STATUS_LABELS[st] || st || '—';
  return `<span class="status-badge s-${st||'absent'}">${lbl}</span>`;
}

function fmt12(isoOrTime) {
  if (!isoOrTime) return '—';
  try {
    const d = isoOrTime.includes('T') ? new Date(isoOrTime) : new Date('2000-01-01T' + isoOrTime);
    return d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
  } catch { return isoOrTime; }
}

function timeToStr(iso) {
  if (!iso) return '';
  try { const d = new Date(iso); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
  catch { return ''; }
}

function dateLabel(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function dayName(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'short' });
}

function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

function getEmpShift(emp) {
  return getShifts().find(s => s.name === emp.shift) || null;
}

function resolveStatus(rec, shift) {
  if (!rec) return 'absent';
  if (rec.status) return rec.status;
  return computeAttendanceStatus(rec, shift);
}

function lateMins(rec, shift) {
  if (!rec || !rec.punchIn || !shift) return 0;
  return lateMinutes(rec.punchIn, shift);
}

function earlyMins(rec, shift) {
  if (!rec || !rec.punchOut || !shift) return 0;
  return earlyLeaveMinutes(rec.punchOut, shift);
}

function fmtMins(m) { return m > 0 ? m + ' min' : '—'; }

function allDeptOptions() {
  return getDepartments().filter(d => d.active).map(d => `<option value="${d.name}">${d.name}</option>`).join('');
}

function monthYearSelects(monthId, yearId) {
  const now = new Date();
  const mSel = document.getElementById(monthId);
  const ySel = document.getElementById(yearId);
  if (!mSel.options.length) {
    MONTH_NAMES.forEach((n, i) => mSel.add(new Option(n, i + 1)));
  }
  if (!ySel.options.length) {
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 2; y--) ySel.add(new Option(y, y));
  }
  if (!mSel.value) mSel.value = now.getMonth() + 1;
  if (!ySel.value) ySel.value = now.getFullYear();
}

/* ── Tab switching ───────────────────────────────────────────────────────── */
function switchTab(name) {
  ['daily','empwise','deptwise','monthly','correct'].forEach(t => {
    document.getElementById('tab-'+t).classList.toggle('active', t === name);
    document.getElementById('tab-'+t+'-btn').classList.toggle('active', t === name);
  });
  if (name === 'daily')    renderDaily();
  if (name === 'empwise')  initEmpwise();
  if (name === 'deptwise') initDeptwise();
  if (name === 'monthly')  initMonthly();
  if (name === 'correct')  renderCorrections();
}

/* ── DAILY ───────────────────────────────────────────────────────────────── */
function renderDaily() {
  const date   = document.getElementById('daily-date').value;
  const deptF  = document.getElementById('daily-dept').value;
  const stF    = document.getElementById('daily-status-filter').value;
  if (!date) return;

  let emps = getEmployees().filter(e => e.active !== false);
  if (deptF) emps = emps.filter(e => e.department === deptF);

  const tbody = document.getElementById('daily-body');
  const counts = {};
  const rows = emps.map(emp => {
    const rec   = getAttendanceRecord(emp.id, date);
    const shift = getEmpShift(emp);
    const st    = resolveStatus(rec, shift);
    counts[st]  = (counts[st] || 0) + 1;
    if (stF && st !== stF) return '';

    const lm = lateMins(rec, shift);
    const em = earlyMins(rec, shift);
    const hrs = rec && rec.hoursWorked ? rec.hoursWorked.toFixed(1) + 'h' : (rec && rec.punchIn && !rec.punchOut ? '<em style="color:var(--primary)">Active</em>' : '—');

    return `<tr>
      <td><div style="font-weight:700;font-size:.86rem">${emp.name}</div><div style="font-size:.72rem;color:var(--text-muted)">${emp.id}</div></td>
      <td style="font-size:.82rem;color:var(--text-muted)">${emp.department||'—'}</td>
      <td style="font-size:.8rem">${emp.shift||'—'}</td>
      <td>${fmt12(rec && rec.punchIn)}</td>
      <td>${fmt12(rec && rec.punchOut)}</td>
      <td>${hrs}</td>
      <td style="color:${lm>0?'#e74c3c':'var(--text-muted)'}">${fmtMins(lm)}</td>
      <td style="color:${em>0?'#e65c00':'var(--text-muted)'}">${fmtMins(em)}</td>
      <td>
        <select class="status-sel" data-emp="${emp.id}" data-date="${date}" onchange="quickMarkStatus(this)">
          ${Object.keys(STATUS_LABELS).filter(k=>k!=='active').map(k =>
            `<option value="${k}" ${st===k?'selected':''}>${STATUS_LABELS[k]}</option>`
          ).join('')}
        </select>
      </td>
      <td><button class="btn-icon" onclick="openAttModal('${emp.id}','${date}')">✏️</button></td>
    </tr>`;
  }).filter(Boolean);

  tbody.innerHTML = rows.length ? rows.join('') : `<tr><td colspan="10" class="no-row">No employees match the filter.</td></tr>`;

  // Summary strip
  const total = emps.length;
  const p = counts['present']||0, a = counts['absent']||0, h = counts['half-day']||0;
  const leaves = (counts['paid-leave']||0)+(counts['unpaid-leave']||0)+(counts['sick-leave']||0);
  const other  = (counts['holiday']||0)+(counts['weekly-off']||0)+(counts['on-duty']||0);
  document.getElementById('daily-summary').innerHTML = [
    [`${p}`,`Present`,'#27ae60'],
    [`${a}`,`Absent`,'#e74c3c'],
    [`${h}`,`Half Day`,'#e65c00'],
    [`${leaves}`,`On Leave`,'#1a73e8'],
    [`${other}`,`Hol/WO/OD`,'#757575'],
    [`${total}`,`Total`,'var(--text)']
  ].map(([v,l,c])=>`<div class="summary-chip"><div class="sc-val" style="color:${c}">${v}</div><div class="sc-lbl">${l}</div></div>`).join('');
}

function quickMarkStatus(sel) {
  const empId = sel.dataset.emp, date = sel.dataset.date, status = sel.value;
  const rec = getAttendanceRecord(empId, date) || { id:'ATT'+Date.now(), employeeId:empId, employeeName:(getEmployees().find(e=>e.id===empId)||{}).name||'', date, punchIn:null, punchOut:null, hoursWorked:null };
  rec.status = status;
  rec.corrected = true;
  rec.correctionAt = new Date().toISOString();
  upsertAttendanceRecord(rec);
  showToast('Status updated.', 'success');
}

function markAllAbsent() {
  const date = document.getElementById('daily-date').value;
  if (!date) { showToast('Select a date first.', 'error'); return; }
  if (!confirm('Mark all employees with no record as Absent?')) return;
  const emps = getEmployees().filter(e => e.active !== false);
  let count = 0;
  emps.forEach(emp => {
    const rec = getAttendanceRecord(emp.id, date);
    if (!rec || (!rec.punchIn && !rec.status)) {
      upsertAttendanceRecord({ id:'ATT'+Date.now()+emp.id, employeeId:emp.id, employeeName:emp.name, date, punchIn:null, punchOut:null, hoursWorked:null, status:'absent', corrected:true, correctionAt:new Date().toISOString() });
      count++;
    }
  });
  showToast(`${count} employee(s) marked Absent.`, 'success');
  renderDaily();
}

/* ── EMPLOYEE-WISE ───────────────────────────────────────────────────────── */
function initEmpwise() {
  const sel = document.getElementById('ew-emp');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Select Employee</option>' +
    getEmployees().filter(e=>e.active!==false).map(e=>`<option value="${e.id}">${e.name} (${e.id})</option>`).join('');
  if (cur) sel.value = cur;
  monthYearSelects('ew-month','ew-year');
}

function renderEmpwise() {
  const empId = document.getElementById('ew-emp').value;
  const month = parseInt(document.getElementById('ew-month').value);
  const year  = parseInt(document.getElementById('ew-year').value);
  if (!empId) return;

  const emp = getEmployees().find(e => e.id === empId);
  const shift = emp ? getEmpShift(emp) : null;
  const days = daysInMonth(year, month);
  const prefix = year + '-' + String(month).padStart(2,'0');
  const recs = getMonthAttendance(empId, year, month);
  const recMap = {};
  recs.forEach(r => { recMap[r.date] = r; });

  // Summary
  const counts = {};
  let totalHrs = 0, totalLate = 0, otHrs = 0;
  const shiftHrs = shift ? shiftDurationHours(shift) : 8;
  const otThresh = shift ? (shift.overtimeThresholdMinutes || 30) : 30;

  for (let d = 1; d <= days; d++) {
    const dateStr = prefix + '-' + String(d).padStart(2,'0');
    const rec = recMap[dateStr] || null;
    const st  = resolveStatus(rec, shift);
    counts[st] = (counts[st]||0)+1;
    if (rec && rec.hoursWorked) {
      totalHrs += rec.hoursWorked;
      const ot = rec.hoursWorked - shiftHrs;
      if (ot * 60 > otThresh) otHrs += ot;
    }
    totalLate += lateMins(rec, shift);
  }

  const p=(counts['present']||0), a=(counts['absent']||0), h=(counts['half-day']||0);
  const pl=(counts['paid-leave']||0), ul=(counts['unpaid-leave']||0), sl=(counts['sick-leave']||0);
  document.getElementById('ew-summary').style.display = 'flex';
  document.getElementById('ew-summary').innerHTML = [
    [p,'Present','#27ae60'],[a,'Absent','#e74c3c'],[h,'Half Day','#e65c00'],
    [pl,'PL','#1a73e8'],[ul,'UL','#7b1fa2'],[sl,'SL','#f9a825'],
    [totalHrs.toFixed(1)+'h','Total Hrs','var(--text)'],[otHrs.toFixed(1)+'h','OT Hrs','var(--primary)'],
    [totalLate>0?totalLate+' min':'0','Late Total','#e74c3c']
  ].map(([v,l,c])=>`<div class="summary-chip"><div class="sc-val" style="color:${c}">${v}</div><div class="sc-lbl">${l}</div></div>`).join('');

  // Table
  const rows = [];
  for (let d = 1; d <= days; d++) {
    const dateStr = prefix + '-' + String(d).padStart(2,'0');
    const rec = recMap[dateStr] || null;
    const st  = resolveStatus(rec, shift);
    const lm  = lateMins(rec, shift);
    const em  = earlyMins(rec, shift);
    const hrs = rec && rec.hoursWorked ? rec.hoursWorked.toFixed(1)+'h' : (rec && rec.punchIn && !rec.punchOut ? '<em style="color:var(--primary)">Active</em>' : '—');
    rows.push(`<tr>
      <td>${dateLabel(dateStr)}</td>
      <td style="color:var(--text-muted)">${dayName(dateStr)}</td>
      <td>${fmt12(rec&&rec.punchIn)}</td>
      <td>${fmt12(rec&&rec.punchOut)}</td>
      <td>${hrs}</td>
      <td style="color:${lm>0?'#e74c3c':'var(--text-muted)'}">${fmtMins(lm)}</td>
      <td style="color:${em>0?'#e65c00':'var(--text-muted)'}">${fmtMins(em)}</td>
      <td>${statusBadge(st)}</td>
      <td><button class="btn-icon" onclick="openAttModal('${empId}','${dateStr}')">✏️</button></td>
    </tr>`);
  }
  document.getElementById('ew-body').innerHTML = rows.join('');
}

/* ── DEPT-WISE ───────────────────────────────────────────────────────────── */
function initDeptwise() {
  const sel = document.getElementById('dw-dept');
  sel.innerHTML = '<option value="">All Departments</option>' + allDeptOptions();
  monthYearSelects('dw-month','dw-year');
}

function renderDeptwise() {
  const deptF = document.getElementById('dw-dept').value;
  const month = parseInt(document.getElementById('dw-month').value);
  const year  = parseInt(document.getElementById('dw-year').value);
  let emps = getEmployees().filter(e => e.active !== false);
  if (deptF) emps = emps.filter(e => e.department === deptF);
  const tbody = document.getElementById('dw-body');
  if (!emps.length) { tbody.innerHTML='<tr><td colspan="9" class="no-row">No employees.</td></tr>'; return; }

  const rows = emps.map(emp => {
    const shift = getEmpShift(emp);
    const recs  = getMonthAttendance(emp.id, year, month);
    const recMap = {}; recs.forEach(r => recMap[r.date] = r);
    const days = daysInMonth(year, month);
    const prefix = year + '-' + String(month).padStart(2,'0');
    let p=0,a=0,h=0,leaves=0,other=0,totalHrs=0,lateDays=0;
    for (let d=1; d<=days; d++) {
      const ds = prefix+'-'+String(d).padStart(2,'0');
      const rec = recMap[ds]||null;
      const st  = resolveStatus(rec, shift);
      if (st==='present') p++;
      else if (st==='absent') a++;
      else if (st==='half-day') h++;
      else if (['paid-leave','unpaid-leave','sick-leave'].includes(st)) leaves++;
      else other++;
      if (rec&&rec.hoursWorked) totalHrs+=rec.hoursWorked;
      if (lateMins(rec,shift)>0) lateDays++;
    }
    return `<tr>
      <td><div style="font-weight:700">${emp.name}</div><div style="font-size:.72rem;color:var(--text-muted)">${emp.id}</div></td>
      <td style="font-size:.82rem;color:var(--text-muted)">${emp.department||'—'}</td>
      <td style="color:#27ae60;font-weight:700">${p}</td>
      <td style="color:#e74c3c;font-weight:700">${a}</td>
      <td style="color:#e65c00">${h}</td>
      <td style="color:#1a73e8">${leaves}</td>
      <td style="color:var(--text-muted)">${other}</td>
      <td style="font-weight:600">${totalHrs.toFixed(1)}h</td>
      <td style="color:${lateDays>0?'#e74c3c':'var(--text-muted)'}">${lateDays}</td>
    </tr>`;
  });
  tbody.innerHTML = rows.join('');
}

/* ── MONTHLY SUMMARY ─────────────────────────────────────────────────────── */
function initMonthly() { monthYearSelects('ms-month','ms-year'); }

function renderMonthlySummary() {
  const month = parseInt(document.getElementById('ms-month').value);
  const year  = parseInt(document.getElementById('ms-year').value);
  const emps  = getEmployees().filter(e => e.active !== false);
  const tbody = document.getElementById('ms-body');
  if (!emps.length) { tbody.innerHTML='<tr><td colspan="14" class="no-row">No active employees.</td></tr>'; return; }
  const days = daysInMonth(year, month);
  const prefix = year + '-' + String(month).padStart(2,'0');

  const rows = emps.map(emp => {
    const shift = getEmpShift(emp);
    const recs  = getMonthAttendance(emp.id, year, month);
    const recMap = {}; recs.forEach(r => recMap[r.date]=r);
    const shiftHrs = shift ? shiftDurationHours(shift) : 8;
    const otThresh = shift ? (shift.overtimeThresholdMinutes||30) : 30;
    let p=0,a=0,h=0,pl=0,ul=0,sl=0,hol=0,wo=0,od=0,totalHrs=0,otHrs=0,lateDays=0;
    for (let d=1;d<=days;d++) {
      const ds=prefix+'-'+String(d).padStart(2,'0');
      const rec=recMap[ds]||null;
      const st=resolveStatus(rec,shift);
      if(st==='present')p++; else if(st==='absent')a++; else if(st==='half-day')h++;
      else if(st==='paid-leave')pl++; else if(st==='unpaid-leave')ul++; else if(st==='sick-leave')sl++;
      else if(st==='holiday')hol++; else if(st==='weekly-off')wo++; else if(st==='on-duty')od++;
      if(rec&&rec.hoursWorked){totalHrs+=rec.hoursWorked;const ot=rec.hoursWorked-shiftHrs;if(ot*60>otThresh)otHrs+=ot;}
      if(lateMins(rec,shift)>0)lateDays++;
    }
    return `<tr>
      <td><div style="font-weight:700">${emp.name}</div><div style="font-size:.71rem;color:var(--text-muted)">${emp.id}</div></td>
      <td style="font-size:.8rem;color:var(--text-muted)">${emp.department||'—'}</td>
      <td style="color:#27ae60;font-weight:700;text-align:center">${p}</td>
      <td style="color:#e74c3c;font-weight:700;text-align:center">${a}</td>
      <td style="color:#e65c00;text-align:center">${h}</td>
      <td style="color:#1a73e8;text-align:center">${pl}</td>
      <td style="color:#7b1fa2;text-align:center">${ul}</td>
      <td style="color:#f9a825;text-align:center">${sl}</td>
      <td style="color:#00838f;text-align:center">${hol}</td>
      <td style="color:#757575;text-align:center">${wo}</td>
      <td style="color:#3949ab;text-align:center">${od}</td>
      <td style="font-weight:600;text-align:center">${totalHrs.toFixed(1)}</td>
      <td style="color:var(--primary);text-align:center">${otHrs.toFixed(1)}</td>
      <td style="color:${lateDays>0?'#e74c3c':'var(--text-muted)'};text-align:center">${lateDays}</td>
    </tr>`;
  });
  tbody.innerHTML = rows.join('');
}

/* ── CORRECTIONS ─────────────────────────────────────────────────────────── */
function renderCorrections() {
  const q  = (document.getElementById('corr-search').value||'').toLowerCase();
  const fv = document.getElementById('corr-filter').value;
  let recs = getAttendance().filter(r => r.corrected || r.approval === 'pending');
  if (q)  recs = recs.filter(r => (r.employeeName||'').toLowerCase().includes(q));
  if (fv === 'pending')   recs = recs.filter(r => r.approval !== 'approved');
  if (fv === 'approved')  recs = recs.filter(r => r.approval === 'approved');
  if (fv === 'corrected') recs = recs.filter(r => r.corrected);
  recs = recs.slice(0, 100);

  const tbody = document.getElementById('corr-body');
  if (!recs.length) { tbody.innerHTML='<tr><td colspan="8" class="no-row">No corrections found.</td></tr>'; return; }
  tbody.innerHTML = recs.map(r => {
    const appr = r.approval === 'approved'
      ? '<span class="status-badge s-present">Approved</span>'
      : '<span class="status-badge s-absent">Pending</span>';
    return `<tr>
      <td style="font-size:.8rem">${dateLabel(r.date)}</td>
      <td><div style="font-weight:600">${r.employeeName||r.employeeId}</div><div style="font-size:.71rem;color:var(--text-muted)">${r.employeeId}</div></td>
      <td>${fmt12(r.punchIn)}</td>
      <td>${fmt12(r.punchOut)}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="font-size:.8rem;color:var(--text-muted)">${r.correctionNote||'—'}</td>
      <td>${appr}</td>
      <td><div style="display:flex;gap:.4rem">
        <button class="btn-icon" onclick="openAttModal('${r.employeeId}','${r.date}')">✏️</button>
        ${r.approval !== 'approved' ? `<button class="btn-icon" style="background:#e8f8ee;border-color:#27ae60;color:#27ae60" onclick="approveRecord('${r.employeeId}','${r.date}')">✅ Approve</button>` : ''}
      </div></td>
    </tr>`;
  }).join('');
}

function approveRecord(empId, date) {
  const rec = getAttendanceRecord(empId, date);
  if (!rec) return;
  rec.approval = 'approved';
  upsertAttendanceRecord(rec);
  showToast('Attendance approved.', 'success');
  renderCorrections();
}

/* ── CORRECTION MODAL ────────────────────────────────────────────────────── */
let _modalEmpId = null, _modalDate = null;

function openAttModal(empId, date) {
  const emp = getEmployees().find(e => e.id === empId);
  const rec = getAttendanceRecord(empId, date);
  const shift = emp ? getEmpShift(emp) : null;
  _modalEmpId = empId; _modalDate = date;

  document.getElementById('am-emp-name').textContent = emp ? emp.name : empId;
  document.getElementById('am-date').textContent = dateLabel(date);
  document.getElementById('am-in').value    = timeToStr(rec && rec.punchIn);
  document.getElementById('am-out').value   = timeToStr(rec && rec.punchOut);
  document.getElementById('am-status').value = resolveStatus(rec, shift);
  document.getElementById('am-note').value  = rec && rec.correctionNote || '';
  document.getElementById('am-approval').value = rec && rec.approval || 'pending';
  document.getElementById('att-modal-error').style.display = 'none';
  document.getElementById('att-modal').classList.add('active');
}

function closeAttModal() { document.getElementById('att-modal').classList.remove('active'); }

function saveAttCorrection() {
  const inT   = document.getElementById('am-in').value;
  const outT  = document.getElementById('am-out').value;
  const st    = document.getElementById('am-status').value;
  const note  = document.getElementById('am-note').value.trim();
  const appr  = document.getElementById('am-approval').value;
  const emp   = getEmployees().find(e => e.id === _modalEmpId);

  // Build ISO punch times if times were entered
  function toISO(dateStr, timeStr) {
    if (!timeStr) return null;
    return new Date(dateStr + 'T' + timeStr + ':00').toISOString();
  }
  const punchIn  = toISO(_modalDate, inT);
  const punchOut = toISO(_modalDate, outT);
  let hrs = null;
  if (punchIn && punchOut) {
    hrs = Math.round(((new Date(punchOut) - new Date(punchIn)) / 3600000) * 100) / 100;
  }
  const existing = getAttendanceRecord(_modalEmpId, _modalDate) || {};
  const rec = {
    ...existing,
    id:             existing.id || 'ATT' + Date.now(),
    employeeId:     _modalEmpId,
    employeeName:   emp ? emp.name : (existing.employeeName || _modalEmpId),
    date:           _modalDate,
    punchIn:        punchIn  || existing.punchIn  || null,
    punchOut:       punchOut || existing.punchOut || null,
    hoursWorked:    hrs      !== null ? hrs : existing.hoursWorked || null,
    status:         st,
    corrected:      true,
    correctionNote: note,
    correctionAt:   new Date().toISOString(),
    approval:       appr
  };
  upsertAttendanceRecord(rec);
  showToast('Attendance saved.', 'success');
  closeAttModal();
  // Refresh whichever tab is active
  const active = ['daily','empwise','deptwise','monthly','correct'].find(t => document.getElementById('tab-'+t).classList.contains('active'));
  if (active === 'daily')   renderDaily();
  if (active === 'empwise') renderEmpwise();
  if (active === 'correct') renderCorrections();
}

/* ── Overlay close ───────────────────────────────────────────────────────── */
document.getElementById('att-modal').addEventListener('click', function(e) {
  if (e.target === this) closeAttModal();
});

/* ── Init ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof syncFromSheets === 'function') { try { await syncFromSheets(); } catch(_) {} }

  // Daily date defaults to today
  document.getElementById('daily-date').value = new Date().toISOString().split('T')[0];

  // Populate dept filter
  document.getElementById('daily-dept').innerHTML = '<option value="">All Departments</option>' + allDeptOptions();

  renderDaily();
});
