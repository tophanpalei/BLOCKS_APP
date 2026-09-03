  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const TYPE_LABELS = { 'leave':'Leave', 'sick-leave':'Sick Leave', 'unpaid-leave':'Unpaid Leave' };

  function typeBadge(t) {
    return `<span class="badge-${t}">${TYPE_LABELS[t]||t}</span>`;
  }
  function statusBadge(s) {
    const labels = { pending:'Pending', approved:'Approved', rejected:'Rejected' };
    return `<span class="badge-${s}">${labels[s]||s}</span>`;
  }
  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  }

  // ── Filters init ────────────────────────────────────────────────────────
  function initFilters() {
    const empSel = document.getElementById('f-emp');
    const cur = empSel.value;
    empSel.innerHTML = '<option value="">All Employees</option>' +
      getEmployees().filter(e=>e.active!==false).map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
    if (cur) empSel.value = cur;

    const mSel = document.getElementById('f-month');
    const now = new Date();
    if (!mSel.options.length || mSel.options.length === 1) {
      for (let m = 0; m < 12; m++) {
        mSel.add(new Option(MONTHS[m] + ' ' + now.getFullYear(), now.getFullYear() + '-' + String(m+1).padStart(2,'0')));
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    const fEmp    = document.getElementById('f-emp').value;
    const fType   = document.getElementById('f-type').value;
    const fStatus = document.getElementById('f-status').value;
    const fMonth  = document.getElementById('f-month').value;

    let leaves = getLeaves();
    if (fEmp)    leaves = leaves.filter(l => l.employeeId === fEmp);
    if (fType)   leaves = leaves.filter(l => l.leaveType === fType);
    if (fStatus) leaves = leaves.filter(l => l.status === fStatus);
    if (fMonth)  leaves = leaves.filter(l => (l.fromDate||'').startsWith(fMonth));

    // Summary
    const all = getLeaves();
    const pending  = all.filter(l => l.status === 'pending').length;
    const approved = all.filter(l => l.status === 'approved').length;
    const thisMonth = new Date().toISOString().slice(0,7);
    const thisMonthLeaves = all.filter(l => (l.fromDate||'').startsWith(thisMonth));
    const thisMonthDays = thisMonthLeaves.filter(l=>l.status==='approved').reduce((s,l)=>s+(l.days||1),0);
    document.getElementById('summary-strip').innerHTML = [
      [pending,   'Pending',          '#f9a825'],
      [approved,  'Approved Total',   '#27ae60'],
      [thisMonthDays, 'Days This Month','#1a73e8'],
      [all.length,'Total Applications','var(--text)']
    ].map(([v,l,c])=>`<div class="summary-chip"><div class="sc-val" style="color:${c}">${v}</div><div class="sc-lbl">${l}</div></div>`).join('');

    const tbody = document.getElementById('leave-body');
    if (!leaves.length) { tbody.innerHTML='<tr><td colspan="9" class="no-row">No leave applications found.</td></tr>'; return; }

    tbody.innerHTML = leaves.map(l => {
      const appliedOn = l.appliedAt ? new Date(l.appliedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—';
      const actions = l.status === 'pending'
        ? `<button class="btn-icon btn-approve" onclick="approveLeave('${l.id}')">✅ Approve</button>
           <button class="btn-icon btn-reject"  onclick="openRejectModal('${l.id}')">✕ Reject</button>`
        : `<button class="btn-icon" onclick="openEditLeave('${l.id}')">✏️ Edit</button>`;
      const noteHtml = l.rejectionNote ? `<div style="font-size:.72rem;color:#e74c3c;margin-top:.2rem">${l.rejectionNote}</div>` : '';
      return `<tr>
        <td style="font-size:.78rem;color:var(--text-muted)">${appliedOn}</td>
        <td><div style="font-weight:700">${l.employeeName||l.employeeId}</div><div style="font-size:.72rem;color:var(--text-muted)">${l.employeeId}</div></td>
        <td>${typeBadge(l.leaveType)}</td>
        <td style="font-size:.84rem">${fmtDate(l.fromDate)}</td>
        <td style="font-size:.84rem">${fmtDate(l.toDate)}</td>
        <td style="font-weight:700;text-align:center">${l.days||1}</td>
        <td style="font-size:.82rem;color:var(--text-muted);max-width:160px">${l.reason||'—'}</td>
        <td>${statusBadge(l.status)}${noteHtml}</td>
        <td><div class="action-btns">${actions}</div></td>
      </tr>`;
    }).join('');
  }

  // ── Approve ───────────────────────────────────────────────────────────────
  function approveLeave(id) {
    const leaves = getLeaves();
    const l = leaves.find(x => x.id === id);
    if (!l) return;
    l.status = 'approved';
    l.actionAt = new Date().toISOString();
    saveLeaves(leaves);
    showToast(`Leave approved for ${l.employeeName}.`, 'success');
    render();
  }

  // ── Reject ────────────────────────────────────────────────────────────────
  let _rejectId = null;
  function openRejectModal(id) {
    _rejectId = id;
    document.getElementById('reject-note').value = '';
    document.getElementById('reject-modal').classList.add('active');
  }
  function confirmReject() {
    const leaves = getLeaves();
    const l = leaves.find(x => x.id === _rejectId);
    if (!l) return;
    l.status = 'rejected';
    l.rejectionNote = document.getElementById('reject-note').value.trim();
    l.actionAt = new Date().toISOString();
    saveLeaves(leaves);
    document.getElementById('reject-modal').classList.remove('active');
    showToast(`Leave rejected for ${l.employeeName}.`, 'info');
    render();
  }

  // ── Add / Edit ────────────────────────────────────────────────────────────
  let _editLeaveId = null;

  function openAddLeave() {
    _editLeaveId = null;
    document.getElementById('lv-modal-title').textContent = 'Apply Leave';
    populateEmpDropdown(null);
    document.getElementById('lv-type').value   = 'leave';
    document.getElementById('lv-from').value   = new Date().toISOString().split('T')[0];
    document.getElementById('lv-to').value     = new Date().toISOString().split('T')[0];
    document.getElementById('lv-reason').value = '';
    document.getElementById('lv-status').value = 'pending';
    document.getElementById('lv-note').value   = '';
    document.getElementById('lv-note-group').style.display = 'none';
    document.getElementById('lv-modal-error').style.display = 'none';
    updateDays();
    document.getElementById('leave-modal').classList.add('active');
  }

  function openEditLeave(id) {
    const l = getLeaves().find(x => x.id === id);
    if (!l) return;
    _editLeaveId = id;
    document.getElementById('lv-modal-title').textContent = 'Edit Leave';
    populateEmpDropdown(l.employeeId);
    document.getElementById('lv-type').value   = l.leaveType;
    document.getElementById('lv-from').value   = l.fromDate;
    document.getElementById('lv-to').value     = l.toDate;
    document.getElementById('lv-reason').value = l.reason||'';
    document.getElementById('lv-status').value = l.status;
    document.getElementById('lv-note').value   = l.rejectionNote||'';
    document.getElementById('lv-note-group').style.display = l.status==='rejected' ? '' : 'none';
    document.getElementById('lv-modal-error').style.display = 'none';
    document.getElementById('lv-days').value = l.days||'—';
    document.getElementById('leave-modal').classList.add('active');
  }

  function populateEmpDropdown(selectedId) {
    const sel = document.getElementById('lv-emp');
    sel.innerHTML = '<option value="">Select Employee</option>' +
      getEmployees().filter(e=>e.active!==false).map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
    if (selectedId) sel.value = selectedId;
  }

  document.getElementById('lv-status').addEventListener('change', function() {
    document.getElementById('lv-note-group').style.display = this.value === 'rejected' ? '' : 'none';
  });

  function updateDays() {
    const f = document.getElementById('lv-from').value;
    const t = document.getElementById('lv-to').value;
    if (f && t && t >= f) {
      document.getElementById('lv-days').value = countLeaveDays(f, t) + ' day(s)';
    }
  }

  function closeLeaveModal() { document.getElementById('leave-modal').classList.remove('active'); }

  function saveLeave() {
    const empId = document.getElementById('lv-emp').value;
    const from  = document.getElementById('lv-from').value;
    const to    = document.getElementById('lv-to').value;
    const errEl = document.getElementById('lv-modal-error');
    errEl.style.display = 'none';
    if (!empId) { errEl.textContent='Select an employee.'; errEl.style.display='block'; return; }
    if (!from)  { errEl.textContent='From date is required.'; errEl.style.display='block'; return; }
    if (!to)    { errEl.textContent='To date is required.'; errEl.style.display='block'; return; }
    if (to < from) { errEl.textContent='To date must be on or after From date.'; errEl.style.display='block'; return; }

    const emp = getEmployees().find(e => e.id === empId);
    const leaves = getLeaves();
    const record = {
      employeeId:    empId,
      employeeName:  emp ? emp.name : empId,
      leaveType:     document.getElementById('lv-type').value,
      fromDate:      from,
      toDate:        to,
      days:          countLeaveDays(from, to),
      reason:        document.getElementById('lv-reason').value.trim(),
      status:        document.getElementById('lv-status').value,
      rejectionNote: document.getElementById('lv-note').value.trim()
    };

    if (_editLeaveId) {
      const idx = leaves.findIndex(l => l.id === _editLeaveId);
      if (idx !== -1) leaves[idx] = { ...leaves[idx], ...record };
      showToast('Leave updated.', 'success');
    } else {
      leaves.unshift({ id: generateLeaveId(), appliedAt: new Date().toISOString(), ...record });
      showToast('Leave applied.', 'success');
    }
    saveLeaves(leaves);
    closeLeaveModal();
    render();
  }

  // Overlay close
  ['leave-modal','reject-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) { if (e.target===this) this.classList.remove('active'); });
  });

  // ── Init ─────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof syncFromSheets === 'function') { try { await syncFromSheets(); } catch(_) {} }
    initFilters();
    render();
  });
