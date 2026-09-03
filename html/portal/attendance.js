  let _empSession  = null;
  let _clockTimer  = null;

  function togglePin() {
    const inp = document.getElementById('emp-pin');
    const btn = document.getElementById('pin-eye-btn');
    inp.type   = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁' : '🙈';
  }

  function showLoginError(msg) {
    const el = document.getElementById('emp-login-error');
    el.textContent   = msg;
    el.style.display = 'block';
  }

  function employeeLogin() {
    const raw = document.getElementById('emp-pin').value.trim();
    document.getElementById('emp-login-error').style.display = 'none';

    if (!raw) { showLoginError('Please enter your Employee ID or PIN.'); return; }

    // Match by employee ID (case-insensitive) OR by PIN
    const emp = getEmployees().find(e =>
      e.active !== false &&
      (e.id.toLowerCase() === raw.toLowerCase() || String(e.pin) === raw)
    );
    if (!emp) { showLoginError('Employee ID or PIN not found. Please try again or contact admin.'); return; }

    _empSession = { employeeId: emp.id, name: emp.name, role: emp.role || emp.designation || 'Employee' };
    Store.set('bm_employee_session', _empSession);
    openDashboard();
  }

  function employeeLogout() {
    Store.remove('bm_employee_session');
    _empSession = null;
    if (_clockTimer) { clearInterval(_clockTimer); _clockTimer = null; }
    document.getElementById('emp-dashboard').style.display   = 'none';
    document.getElementById('emp-login-screen').style.display = 'block';
    document.getElementById('emp-pin').value = '';
    document.getElementById('emp-login-error').style.display = 'none';
  }

  function openDashboard() {
    document.getElementById('emp-login-screen').style.display = 'none';
    document.getElementById('emp-dashboard').style.display    = 'block';
    document.getElementById('emp-welcome-name').textContent   = 'Welcome, ' + _empSession.name + '! 👋';
    document.getElementById('emp-role-display').textContent   = _empSession.role;
    startClock();
    refreshPunchCard();
    renderHistory();
    renderMyLeaves();
  }

  function startClock() {
    if (_clockTimer) clearInterval(_clockTimer);
    function tick() {
      const now = new Date();
      document.getElementById('emp-clock-date').textContent =
        now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      document.getElementById('emp-clock-time').textContent =
        now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }
    tick();
    _clockTimer = setInterval(tick, 1000);
  }

  function fmt12(isoStr) {
    return new Date(isoStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function refreshPunchCard() {
    const rec   = getTodayRecord(_empSession.employeeId);
    const label = document.getElementById('punch-status-label');
    const info  = document.getElementById('punch-time-info');
    const btn   = document.getElementById('punch-btn');
    const undo  = document.getElementById('undo-punch-btn');

    if (!rec) {
      label.textContent = 'You have not punched in today.';
      info.textContent  = '';
      btn.textContent   = '🟢  Punch In';
      btn.className     = 'punch-btn punch-in';
      btn.disabled      = false;
      undo.style.display = 'none';
    } else if (rec.punchIn && !rec.punchOut) {
      label.textContent = '✅ You are currently punched in.';
      info.textContent  = 'Since ' + fmt12(rec.punchIn);
      btn.textContent   = '🔴  Punch Out';
      btn.className     = 'punch-btn punch-out';
      btn.disabled      = false;
      undo.style.display = 'none';
    } else {
      const hrs = rec.hoursWorked ? rec.hoursWorked.toFixed(1) + ' hrs' : '';
      label.textContent = '✅ Attendance recorded for today.';
      info.textContent  = 'In: ' + fmt12(rec.punchIn) + '  ·  Out: ' + fmt12(rec.punchOut) + (hrs ? '  ·  ' + hrs : '');
      btn.textContent   = '✔  Done for Today';
      btn.className     = 'punch-btn punch-done';
      btn.disabled      = true;
      undo.style.display = 'block';
    }
  }

  function undoPunchOut() {
    if (!confirm('Undo punch out? You can punch out again at the correct time.')) return;
    const all = getAttendance();
    const idx = all.findIndex(r => r.employeeId === _empSession.employeeId && r.date === todayStr());
    if (idx !== -1) {
      all[idx].punchOut    = null;
      all[idx].hoursWorked = null;
      saveAttendance(all);
      showToast('Punch out undone. You can punch out again.', 'info');
      refreshPunchCard();
      renderHistory();
    }
  }

  function punchInOut() {
    const empId = _empSession.employeeId;
    const rec   = getTodayRecord(empId);
    const now   = new Date();
    const all   = getAttendance();

    if (!rec) {
      all.unshift({
        id:           'ATT' + Date.now(),
        employeeId:   empId,
        employeeName: _empSession.name,
        date:         todayStr(),
        punchIn:      now.toISOString(),
        punchOut:     null,
        hoursWorked:  null
      });
      saveAttendance(all);
      showToast('Punched In at ' + fmt12(now.toISOString()), 'success');
    } else if (rec.punchIn && !rec.punchOut) {
      const hrs = (now - new Date(rec.punchIn)) / 3600000;
      const idx = all.findIndex(r => r.id === rec.id);
      if (idx !== -1) {
        all[idx].punchOut   = now.toISOString();
        all[idx].hoursWorked = Math.round(hrs * 100) / 100;
      }
      saveAttendance(all);
      showToast('Punched Out · ' + hrs.toFixed(1) + ' hrs worked today', 'success');
    }

    refreshPunchCard();
    renderHistory();
  }

  function renderHistory() {
    const recs  = getAttendance().filter(r => r.employeeId === _empSession.employeeId).slice(0, 10);
    const tbody = document.getElementById('att-history');

    if (!recs.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="no-history">No attendance records yet</td></tr>';
      return;
    }

    tbody.innerHTML = recs.map(r => {
      const d   = new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const inT = r.punchIn  ? fmt12(r.punchIn)  : '—';
      const outT= r.punchOut ? fmt12(r.punchOut) : '—';
      const hrs = r.hoursWorked ? r.hoursWorked.toFixed(1) + 'h' : (r.punchIn && !r.punchOut ? '<em>active</em>' : '—');
      const badge = r.punchOut
        ? '<span class="badge-present">Present</span>'
        : (r.punchIn ? '<span class="badge-active">Active</span>' : '—');
      return `<tr><td>${d}</td><td>${inT}</td><td>${outT}</td><td>${hrs}</td><td>${badge}</td></tr>`;
    }).join('');
  }

  // ── My Leaves ─────────────────────────────────────────────────────────────
  const LV_LABELS = { 'leave':'Leave', 'sick-leave':'Sick Leave', 'unpaid-leave':'Unpaid Leave' };

  function renderMyLeaves() {
    const empId = _empSession && _empSession.employeeId;
    if (!empId) return;
    const leaves = getLeaves().filter(l => l.employeeId === empId);
    const tbody = document.getElementById('my-leave-body');
    if (!leaves.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="no-history">No leave applications yet.</td></tr>';
      return;
    }
    tbody.innerHTML = leaves.slice(0, 8).map(l => {
      const f = l.fromDate ? new Date(l.fromDate+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '—';
      const t = l.toDate   ? new Date(l.toDate  +'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '—';
      const badge = `<span class="badge-${l.status}">${l.status.charAt(0).toUpperCase()+l.status.slice(1)}</span>`;
      return `<tr><td>${LV_LABELS[l.leaveType]||l.leaveType}</td><td>${f}</td><td>${t}</td><td style="text-align:center">${l.days||1}</td><td>${badge}</td></tr>`;
    }).join('');
  }

  function openApplyLeave() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('lv-from').value  = today;
    document.getElementById('lv-to').value    = today;
    document.getElementById('lv-reason').value = '';
    document.getElementById('lv-type').value  = 'leave';
    document.getElementById('lv-err').style.display = 'none';
    calcLvDays();
    document.getElementById('apply-leave-modal').classList.add('active');
  }

  function closeApplyLeave() {
    document.getElementById('apply-leave-modal').classList.remove('active');
  }

  function calcLvDays() {
    const f = document.getElementById('lv-from').value;
    const t = document.getElementById('lv-to').value;
    const lbl = document.getElementById('lv-days-label');
    if (f && t && t >= f) lbl.textContent = countLeaveDays(f, t) + ' day(s)';
    else lbl.textContent = '—';
  }

  function submitLeave() {
    const from = document.getElementById('lv-from').value;
    const to   = document.getElementById('lv-to').value;
    const err  = document.getElementById('lv-err');
    err.style.display = 'none';
    if (!from) { err.textContent='Please select From date.'; err.style.display='block'; return; }
    if (!to)   { err.textContent='Please select To date.'; err.style.display='block'; return; }
    if (to < from) { err.textContent='To date must be on or after From date.'; err.style.display='block'; return; }

    const leaves = getLeaves();
    leaves.unshift({
      id:           generateLeaveId(),
      appliedAt:    new Date().toISOString(),
      employeeId:   _empSession.employeeId,
      employeeName: _empSession.name,
      leaveType:    document.getElementById('lv-type').value,
      fromDate:     from,
      toDate:       to,
      days:         countLeaveDays(from, to),
      reason:       document.getElementById('lv-reason').value.trim(),
      status:       'pending',
      rejectionNote:''
    });
    saveLeaves(leaves);
    closeApplyLeave();
    showToast('Leave application submitted. Awaiting admin approval.', 'success');
    renderMyLeaves();
  }

  document.getElementById('apply-leave-modal').addEventListener('click', function(e) {
    if (e.target === this) closeApplyLeave();
  });

  // ── Init ────────────────────────────────────────────────────────────────
  (function init() {
    const saved = Store.get('bm_employee_session');
    if (saved && saved.employeeId) {
      const emp = getEmployees().find(e => e.id === saved.employeeId && e.active !== false);
      if (emp) {
        _empSession = { employeeId: emp.id, name: emp.name, role: emp.role || 'Employee' };
        openDashboard();
      }
    }
  })();
