  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  // ── Tab ──────────────────────────────────────────────────────────────────
  function switchTab(name) {
    ['master','assign','history'].forEach(t => {
      document.getElementById('tab-'+t).classList.toggle('active', t===name);
      document.getElementById('tab-'+t+'-btn').classList.toggle('active', t===name);
    });
    if (name === 'master')  renderShiftMaster();
    if (name === 'assign')  { populateAssignFilters(); renderAssignment(); }
    if (name === 'history') renderHistory();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function fmt12(t) {
    if (!t) return '—';
    const [h,m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return ((h % 12) || 12) + ':' + String(m).padStart(2,'0') + ' ' + ampm;
  }

  function shiftById(id) { return getShifts().find(s => s.id === id); }
  function shiftByName(name) { return getShifts().find(s => s.name === name); }

  function weeklyOffLabel(s) {
    if (s.weeklyOffType === 'rotational') return `<span class="badge-rotat">Rotational</span>`;
    const days = (s.fixedDays || []).join(', ') || '—';
    return `<span class="badge-fixed">Fixed</span> <span style="font-size:0.8rem">${days}</span>`;
  }

  // ── SHIFT MASTER ─────────────────────────────────────────────────────────
  function renderShiftMaster() {
    const shifts = getShifts();
    const emps   = getEmployees();
    const tbody  = document.getElementById('shift-master-body');
    if (!shifts.length) { tbody.innerHTML = '<tr><td colspan="9" class="no-row">No shifts yet.</td></tr>'; return; }
    tbody.innerHTML = shifts.map(s => {
      const empCount = emps.filter(e => e.shift === s.name).length;
      return `<tr>
        <td style="font-family:monospace;font-size:0.76rem;color:var(--text-muted)">${s.id}</td>
        <td style="font-weight:700">${s.name}</td>
        <td style="font-size:0.83rem">${fmt12(s.startTime)} – ${fmt12(s.endTime)}</td>
        <td style="color:var(--text-muted)">${s.breakMinutes || 0} min</td>
        <td style="color:var(--text-muted)">${s.gracePeriodMinutes || 0} min</td>
        <td style="color:var(--text-muted)">${s.overtimeThresholdMinutes || 0} min</td>
        <td>${weeklyOffLabel(s)}</td>
        <td>${s.active ? '<span class="badge-active">Active</span>' : '<span class="badge-inactive">Inactive</span>'}</td>
        <td><div class="action-btns">
          <button class="btn-icon" onclick="openEditShift('${s.id}')">✏️ Edit</button>
          <button class="btn-icon" onclick="toggleShiftStatus('${s.id}')">${s.active ? '🔴 Deactivate' : '🟢 Activate'}</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  let _editingShiftId = null;

  function buildDayChips(selected) {
    const grid = document.getElementById('sf-days-grid');
    grid.innerHTML = DAYS.map(d => {
      const on = selected.includes(d);
      return `<label class="day-chip ${on ? 'checked' : ''}" id="chip-${d}">
        <input type="checkbox" value="${d}" ${on ? 'checked' : ''}
          onchange="this.parentElement.classList.toggle('checked',this.checked)">
        ${d.slice(0,3)}
      </label>`;
    }).join('');
  }

  function getSelectedDays() {
    return DAYS.filter(d => {
      const chip = document.getElementById('chip-'+d);
      return chip && chip.querySelector('input').checked;
    });
  }

  function toggleWOType() {
    const type = document.getElementById('sf-wo-type').value;
    document.getElementById('sf-fixed-section').style.display  = type === 'fixed'      ? '' : 'none';
    document.getElementById('sf-rotat-section').style.display  = type === 'rotational' ? '' : 'none';
  }

  function openAddShift() {
    _editingShiftId = null;
    document.getElementById('shift-modal-title').textContent = 'Add Shift';
    document.getElementById('sf-name').value   = '';
    document.getElementById('sf-start').value  = '09:00';
    document.getElementById('sf-end').value    = '18:00';
    document.getElementById('sf-break').value  = '60';
    document.getElementById('sf-grace').value  = '15';
    document.getElementById('sf-ot').value     = '30';
    document.getElementById('sf-wo-type').value = 'fixed';
    document.getElementById('sf-rotat-note').value = '';
    document.getElementById('shift-modal-error').style.display = 'none';
    buildDayChips(['Sunday']);
    toggleWOType();
    document.getElementById('shift-modal').classList.add('active');
  }

  function openEditShift(id) {
    const s = shiftById(id);
    if (!s) return;
    _editingShiftId = id;
    document.getElementById('shift-modal-title').textContent = 'Edit Shift';
    document.getElementById('sf-name').value   = s.name;
    document.getElementById('sf-start').value  = s.startTime;
    document.getElementById('sf-end').value    = s.endTime;
    document.getElementById('sf-break').value  = s.breakMinutes || '';
    document.getElementById('sf-grace').value  = s.gracePeriodMinutes || '';
    document.getElementById('sf-ot').value     = s.overtimeThresholdMinutes || '';
    document.getElementById('sf-wo-type').value = s.weeklyOffType || 'fixed';
    document.getElementById('sf-rotat-note').value = s.rotationalNote || '';
    document.getElementById('shift-modal-error').style.display = 'none';
    buildDayChips(s.fixedDays || ['Sunday']);
    toggleWOType();
    document.getElementById('shift-modal').classList.add('active');
  }

  function closeShiftModal() {
    document.getElementById('shift-modal').classList.remove('active');
  }

  function saveShift() {
    const name  = document.getElementById('sf-name').value.trim();
    const start = document.getElementById('sf-start').value;
    const end   = document.getElementById('sf-end').value;
    const errEl = document.getElementById('shift-modal-error');
    errEl.style.display = 'none';
    if (!name)  { errEl.textContent = 'Shift name is required.'; errEl.style.display = 'block'; return; }
    if (!start) { errEl.textContent = 'Start time is required.'; errEl.style.display = 'block'; return; }
    if (!end)   { errEl.textContent = 'End time is required.';   errEl.style.display = 'block'; return; }

    const shifts = getShifts();
    const dup = shifts.find(s => s.name.toLowerCase() === name.toLowerCase() && s.id !== _editingShiftId);
    if (dup) { errEl.textContent = 'A shift with this name already exists.'; errEl.style.display = 'block'; return; }

    const woType = document.getElementById('sf-wo-type').value;
    const record = {
      name,
      startTime:               start,
      endTime:                 end,
      breakMinutes:            parseInt(document.getElementById('sf-break').value) || 0,
      gracePeriodMinutes:      parseInt(document.getElementById('sf-grace').value) || 0,
      overtimeThresholdMinutes:parseInt(document.getElementById('sf-ot').value)    || 0,
      weeklyOffType:           woType,
      fixedDays:               woType === 'fixed' ? getSelectedDays() : [],
      rotationalNote:          document.getElementById('sf-rotat-note').value.trim(),
      active:                  true
    };

    if (_editingShiftId) {
      const idx = shifts.findIndex(s => s.id === _editingShiftId);
      if (idx !== -1) {
        const oldActive = shifts[idx].active;
        shifts[idx] = { ...shifts[idx], ...record, active: oldActive };
      }
      showToast('Shift updated.', 'success');
    } else {
      shifts.push({ id: generateShiftId(), ...record });
      showToast('Shift added.', 'success');
    }
    saveShifts(shifts);
    closeShiftModal();
    renderShiftMaster();
    populateAssignFilters();
  }

  function toggleShiftStatus(id) {
    const shifts = getShifts();
    const s      = shifts.find(x => x.id === id);
    if (!s) return;
    const using = getEmployees().filter(e => e.shift === s.name).length;
    if (s.active && using > 0) {
      if (!confirm(`"${s.name}" is assigned to ${using} employee(s). Deactivate anyway?`)) return;
    }
    s.active = !s.active;
    saveShifts(shifts);
    showToast(`"${s.name}" ${s.active ? 'activated' : 'deactivated'}.`, 'info');
    renderShiftMaster();
  }

  // ── EMPLOYEE ASSIGNMENT ───────────────────────────────────────────────────
  function populateAssignFilters() {
    const deptSel  = document.getElementById('assign-filter-dept');
    const shiftSel = document.getElementById('assign-filter-shift');
    const curDept  = deptSel.value;
    const curShift = shiftSel.value;

    deptSel.innerHTML = '<option value="">All Departments</option>' +
      getDepartments().filter(d => d.active).map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    shiftSel.innerHTML = '<option value="">All Shifts</option>' +
      getShifts().filter(s => s.active).map(s => `<option value="${s.name}">${s.name}</option>`).join('');

    if (curDept)  deptSel.value  = curDept;
    if (curShift) shiftSel.value = curShift;
  }

  function renderAssignment() {
    const filterDept  = document.getElementById('assign-filter-dept').value;
    const filterShift = document.getElementById('assign-filter-shift').value;
    let emps = getEmployees().filter(e => e.active !== false);
    if (filterDept)  emps = emps.filter(e => e.department === filterDept);
    if (filterShift) emps = emps.filter(e => (e.shift || '') === filterShift);

    const tbody = document.getElementById('assign-body');
    if (!emps.length) { tbody.innerHTML = '<tr><td colspan="6" class="no-row">No employees found.</td></tr>'; return; }

    tbody.innerHTML = emps.map(emp => {
      const shiftName = emp.shift || '—';
      const s = shiftByName(emp.shift || '');
      const timings = s ? `${fmt12(s.startTime)} – ${fmt12(s.endTime)}` : '—';
      const wo = s ? weeklyOffLabel(s) : '—';
      return `<tr>
        <td>
          <div style="font-weight:700;font-size:0.87rem">${emp.name}</div>
          <div style="font-size:0.74rem;color:var(--text-muted)">${emp.id}</div>
        </td>
        <td style="color:var(--text-muted);font-size:0.84rem">${emp.department || '—'}</td>
        <td style="font-weight:600;color:var(--primary)">${shiftName}</td>
        <td style="font-size:0.82rem;color:var(--text-muted)">${timings}</td>
        <td>${wo}</td>
        <td><button class="btn-icon" onclick="openAssignModal('${emp.id}')">🔄 Change Shift</button></td>
      </tr>`;
    }).join('');
  }

  let _assigningEmpId = null;

  function openAssignModal(empId) {
    const emp = getEmployees().find(e => e.id === empId);
    if (!emp) return;
    _assigningEmpId = empId;
    document.getElementById('assign-emp-name').textContent     = emp.name;
    document.getElementById('assign-current-shift').textContent = emp.shift || 'None';
    document.getElementById('assign-effective').value = new Date().toISOString().split('T')[0];
    document.getElementById('assign-reason').value = '';
    document.getElementById('assign-modal-error').style.display = 'none';

    const sel = document.getElementById('assign-new-shift');
    sel.innerHTML = '<option value="">Select Shift</option>' +
      getShifts().filter(s => s.active).map(s =>
        `<option value="${s.name}" ${s.name === emp.shift ? 'selected' : ''}>${s.name} (${fmt12(s.startTime)} – ${fmt12(s.endTime)})</option>`
      ).join('');
    document.getElementById('assign-modal').classList.add('active');
  }

  function closeAssignModal() {
    document.getElementById('assign-modal').classList.remove('active');
  }

  function confirmAssign() {
    const newShift    = document.getElementById('assign-new-shift').value;
    const effectiveFrom = document.getElementById('assign-effective').value;
    const reason      = document.getElementById('assign-reason').value.trim();
    const errEl = document.getElementById('assign-modal-error');
    errEl.style.display = 'none';
    if (!newShift) { errEl.textContent = 'Please select a shift.'; errEl.style.display = 'block'; return; }
    if (!effectiveFrom) { errEl.textContent = 'Please set an effective date.'; errEl.style.display = 'block'; return; }

    const employees = getEmployees();
    const idx = employees.findIndex(e => e.id === _assigningEmpId);
    if (idx === -1) return;

    const emp = employees[idx];
    const oldShift = emp.shift || '';
    if (oldShift === newShift) { errEl.textContent = 'Employee is already on this shift.'; errEl.style.display = 'block'; return; }

    logShiftChange(emp, oldShift, newShift, effectiveFrom, reason);
    employees[idx].shift = newShift;
    saveEmployees(employees);

    showToast(`${emp.name} assigned to "${newShift}".`, 'success');
    closeAssignModal();
    renderAssignment();
  }

  // ── CHANGE HISTORY ────────────────────────────────────────────────────────
  function renderHistory() {
    const q = (document.getElementById('hist-search').value || '').toLowerCase();
    let hist = getShiftHistory();
    if (q) hist = hist.filter(h => h.employeeName.toLowerCase().includes(q) || h.employeeId.toLowerCase().includes(q));

    const tbody = document.getElementById('history-body');
    if (!hist.length) { tbody.innerHTML = '<tr><td colspan="6" class="no-row">No history yet.</td></tr>'; return; }

    tbody.innerHTML = hist.map(h => {
      const dt = new Date(h.changedAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true });
      const eff = h.effectiveFrom ? new Date(h.effectiveFrom+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—';
      return `<tr>
        <td style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">${dt}</td>
        <td>
          <div style="font-weight:600;font-size:0.86rem">${h.employeeName}</div>
          <div class="hist-meta">${h.employeeId}</div>
        </td>
        <td style="color:var(--text-muted)">${h.oldShift}</td>
        <td style="font-weight:700;color:var(--primary)">${h.newShift}</td>
        <td style="font-size:0.83rem">${eff}</td>
        <td style="color:var(--text-muted);font-size:0.82rem">${h.reason || '—'}</td>
      </tr>`;
    }).join('');
  }

  function clearHistory() {
    if (!confirm('Clear all shift change history? This cannot be undone.')) return;
    saveShiftHistory([]);
    renderHistory();
    showToast('History cleared.', 'info');
  }

  // ── Overlay close ─────────────────────────────────────────────────────────
  ['shift-modal','assign-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('active');
    });
  });

  // ── Init ─────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof syncFromSheets === 'function') { try { await syncFromSheets(); } catch(_) {} }
    renderShiftMaster();
    populateAssignFilters();
  });
