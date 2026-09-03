  let _editingEmpId = null;

  // ── Tab Switching ──────────────────────────────────────────────────────
  function switchTab(name) {
    ['employees','departments','salary'].forEach(t => {
      document.getElementById('tab-'+t).classList.toggle('active', t===name);
      document.getElementById('tab-'+t+'-btn').classList.toggle('active', t===name);
    });
    if (name === 'salary') initSalarySelectors();
    if (name === 'departments') renderDeptList();
  }

  // ── Photo Upload ───────────────────────────────────────────────────────
  function handleEmpPhotoUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Photo too large — max 2 MB', 'error'); input.value=''; return; }
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const MAX = 400;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) { if (w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;} }
        const canvas = document.createElement('canvas');
        canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        document.getElementById('ef-photo-data').value = dataUrl;
        document.getElementById('ef-photo-thumb').src = dataUrl;
        document.getElementById('ef-photo-thumb').style.display = 'block';
        document.getElementById('ef-photo-placeholder').style.display = 'none';
        document.getElementById('ef-photo-remove').style.display = 'inline-block';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function clearEmpPhoto() {
    document.getElementById('ef-photo-data').value = '';
    document.getElementById('ef-photo-file').value = '';
    document.getElementById('ef-photo-thumb').src = '';
    document.getElementById('ef-photo-thumb').style.display = 'none';
    document.getElementById('ef-photo-placeholder').style.display = 'block';
    document.getElementById('ef-photo-remove').style.display = 'none';
  }

  // ── Employee List ──────────────────────────────────────────────────────
  function empTypeBadge(t) {
    const map = {
      permanent:   ['badge-permanent',  'Permanent'],
      temporary:   ['badge-temporary',  'Temporary'],
      contract:    ['badge-contract',   'Contract'],
      'daily-wage':['badge-daily-wage', 'Daily-Wage'],
      parttime:    ['badge-parttime',   'Part-Time'],
      trainee:     ['badge-trainee',    'Trainee']
    };
    const [cls, label] = map[t] || ['badge-temporary', t || '—'];
    return `<span class="${cls}">${label}</span>`;
  }

  function renderEmployeeList() {
    const employees = getEmployees();
    const tbody = document.getElementById('emp-list-body');
    if (!employees.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="no-emp">No employees yet. Click "+ Add Employee" to get started.</td></tr>';
      return;
    }
    tbody.innerHTML = employees.map(e => {
      const salaryBadge = e.salaryType === 'monthly'
        ? `<span class="badge-monthly">Monthly</span> ₹${(e.monthlySalary||0).toLocaleString('en-IN')}`
        : `<span class="badge-daily">Daily</span> ₹${(e.dailyWage||0).toLocaleString('en-IN')}/day`;
      const statusBadge = e.active !== false
        ? '<span class="badge-active">Active</span>'
        : '<span class="badge-inactive">Inactive</span>';
      const avatar = e.photo
        ? `<img class="emp-avatar" src="${e.photo}" alt="">`
        : `<div class="emp-avatar-placeholder">👷</div>`;
      const pinMask = String(e.pin||'').replace(/./g,'●');
      return `<tr>
        <td style="font-family:monospace;font-size:0.78rem;color:var(--text-muted)">${e.id}</td>
        <td>
          <div style="display:flex;align-items:center;gap:0.6rem">
            ${avatar}
            <div>
              <div style="font-weight:700;font-size:0.88rem">${e.name}</div>
              <div style="font-size:0.73rem;color:var(--text-muted)">${e.phone||'—'}</div>
            </div>
          </div>
        </td>
        <td>${empTypeBadge(e.empType)}</td>
        <td style="color:var(--text-muted);font-size:0.84rem">${e.department||'—'}</td>
        <td style="font-size:0.84rem">${e.designation||e.role||'—'}</td>
        <td style="font-size:0.82rem;color:var(--text-muted)">${e.shift||'—'}</td>
        <td>${salaryBadge}</td>
        <td>${statusBadge}</td>
        <td><div class="action-btns">
          <button class="btn-icon" onclick="openViewEmployee('${e.id}')" title="View Details">👁️</button>
          <button class="btn-icon" onclick="openEditEmployee('${e.id}')" title="Edit">✏️</button>
          <button class="btn-icon danger" onclick="deleteEmployee('${e.id}')" title="Delete">🗑️</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  // ── Salary field toggle ────────────────────────────────────────────────
  function updateSalaryFields() {
    const type = document.getElementById('ef-salary-type').value;
    document.getElementById('ef-daily-group').style.display   = type==='daily'   ? '' : 'none';
    document.getElementById('ef-monthly-group').style.display = type==='monthly' ? '' : 'none';
  }

  // ── Populate manager suggestions ───────────────────────────────────────
  function populateManagerSuggestions(excludeId) {
    const names = getEmployees()
      .filter(e => e.id !== excludeId && e.active !== false)
      .map(e => `<option value="${e.name}">`);
    document.getElementById('manager-suggestions').innerHTML = names.join('');
  }

  // ── Open Add ──────────────────────────────────────────────────────────
  function openAddEmployee() {
    _editingEmpId = null;
    document.getElementById('emp-modal-title').textContent = 'Add Employee';
    const newId = generateEmployeeId();
    document.getElementById('ef-id-display').textContent = newId;
    clearEmpPhoto();
    const fields = ['ef-name','ef-parent-name','ef-phone','ef-alt-phone','ef-address',
      'ef-village','ef-district','ef-state','ef-pincode','ef-emergency',
      'ef-department','ef-designation','ef-reporting-manager','ef-work-location',
      'ef-daily-wage','ef-monthly-salary'];
    fields.forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('ef-pin').value = newId.replace(/\D/g, '');
    document.getElementById('ef-dob').value          = '';
    document.getElementById('ef-join-date').value    = new Date().toISOString().split('T')[0];
    document.getElementById('ef-gender').value       = '';
    document.getElementById('ef-status').value       = 'active';
    document.getElementById('ef-emp-type').value     = 'permanent';
    document.getElementById('ef-salary-type').value  = 'daily';
    document.getElementById('ef-shift').value        = '';
    document.getElementById('emp-modal-error').style.display = 'none';
    updateSalaryFields();
    populateDeptDropdown();
    populateManagerSuggestions(null);
    document.getElementById('emp-modal').classList.add('active');
  }

  // ── Open Edit ─────────────────────────────────────────────────────────
  function openEditEmployee(id) {
    const emp = getEmployees().find(e => e.id === id);
    if (!emp) return;
    _editingEmpId = id;
    document.getElementById('emp-modal-title').textContent    = 'Edit Employee';
    document.getElementById('ef-id-display').textContent      = emp.id;
    // Photo
    if (emp.photo) {
      document.getElementById('ef-photo-data').value = emp.photo;
      document.getElementById('ef-photo-thumb').src  = emp.photo;
      document.getElementById('ef-photo-thumb').style.display = 'block';
      document.getElementById('ef-photo-placeholder').style.display = 'none';
      document.getElementById('ef-photo-remove').style.display = 'inline-block';
    } else { clearEmpPhoto(); }
    // Fields
    const set = (id, val) => { const el=document.getElementById(id); if(el) el.value=val||''; };
    set('ef-name',              emp.name);
    set('ef-parent-name',       emp.parentName);
    set('ef-dob',               emp.dob);
    set('ef-gender',            emp.gender);
    set('ef-phone',             emp.phone);
    set('ef-alt-phone',         emp.altPhone);
    set('ef-address',           emp.address);
    set('ef-village',           emp.village);
    set('ef-district',          emp.district);
    set('ef-state',             emp.state);
    set('ef-pincode',           emp.pincode);
    set('ef-emergency',         emp.emergencyContact);
    set('ef-join-date',         emp.joinDate);
    set('ef-emp-type',          emp.empType || 'permanent');
    set('ef-department',        emp.department);
    set('ef-designation',       emp.designation || emp.role);
    set('ef-reporting-manager', emp.reportingManager);
    set('ef-work-location',     emp.workLocation);
    set('ef-shift',             emp.shift);
    set('ef-pin',               emp.pin);
    set('ef-salary-type',       emp.salaryType || 'daily');
    set('ef-daily-wage',        emp.dailyWage);
    set('ef-monthly-salary',    emp.monthlySalary);
    document.getElementById('ef-status').value = emp.active === false ? 'inactive' : 'active';
    document.getElementById('emp-modal-error').style.display = 'none';
    updateSalaryFields();
    populateDeptDropdown();
    // restore saved department after populating options
    set('ef-department', emp.department);
    populateManagerSuggestions(id);
    document.getElementById('emp-modal').classList.add('active');
  }

  function closeEmpModal() {
    document.getElementById('emp-modal').classList.remove('active');
  }

  // ── Save ──────────────────────────────────────────────────────────────
  function saveEmployee() {
    const name = document.getElementById('ef-name').value.trim();
    const errEl = document.getElementById('emp-modal-error');
    errEl.style.display = 'none';
    if (!name) { errEl.textContent = 'Name is required.'; errEl.style.display = 'block'; return; }

    // Resolve ID first so PIN can default to its numeric part
    const resolvedId = _editingEmpId || generateEmployeeId();
    const pin = document.getElementById('ef-pin').value.trim() || resolvedId.replace(/\D/g, '');

    const g = id => document.getElementById(id)?.value?.trim() || '';
    const record = {
      name,
      photo:            document.getElementById('ef-photo-data').value || null,
      parentName:       g('ef-parent-name'),
      dob:              g('ef-dob'),
      gender:           g('ef-gender'),
      phone:            g('ef-phone'),
      altPhone:         g('ef-alt-phone'),
      address:          g('ef-address'),
      village:          g('ef-village'),
      district:         g('ef-district'),
      state:            g('ef-state'),
      pincode:          g('ef-pincode'),
      emergencyContact: g('ef-emergency'),
      joinDate:         g('ef-join-date'),
      active:           document.getElementById('ef-status').value === 'active',
      empType:          g('ef-emp-type') || 'permanent',
      department:       g('ef-department'),
      designation:      g('ef-designation'),
      role:             g('ef-designation'),
      reportingManager: g('ef-reporting-manager'),
      workLocation:     g('ef-work-location'),
      shift:            g('ef-shift'),
      pin,
      salaryType:       g('ef-salary-type') || 'daily',
      dailyWage:        parseFloat(document.getElementById('ef-daily-wage').value) || 0,
      monthlySalary:    parseFloat(document.getElementById('ef-monthly-salary').value) || 0
    };

    const employees = getEmployees();
    if (_editingEmpId) {
      const idx = employees.findIndex(e => e.id === _editingEmpId);
      if (idx === -1) return;
      employees[idx] = { ...employees[idx], ...record };
      showToast('Employee updated.', 'success');
    } else {
      employees.push({ id: resolvedId, ...record });
      showToast('Employee added.', 'success');
    }
    saveEmployees(employees);
    closeEmpModal();
    renderEmployeeList();
  }

  function deleteEmployee(id) {
    const emp = getEmployees().find(e => e.id === id);
    if (!emp) return;
    if (!confirm(`Delete "${emp.name}"? Their attendance records will be kept.`)) return;
    saveEmployees(getEmployees().filter(e => e.id !== id));
    showToast('Employee deleted.', 'info');
    renderEmployeeList();
  }

  // ── Salary Calculator ──────────────────────────────────────────────────
  function initSalarySelectors() {
    const now = new Date();
    document.getElementById('sal-month').value = now.getMonth() + 1;
    const yearSel = document.getElementById('sal-year');
    if (!yearSel.options.length) {
      for (let y = now.getFullYear(); y >= now.getFullYear()-3; y--) yearSel.add(new Option(y,y));
    }
  }

  function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

  function calcSalary() {
    const month = parseInt(document.getElementById('sal-month').value);
    const year  = parseInt(document.getElementById('sal-year').value);
    const employees = getEmployees().filter(e => e.active !== false);
    const tbody = document.getElementById('salary-body');
    if (!employees.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="salary-empty">No active employees found.</td></tr>';
      return;
    }
    const totalDays = daysInMonth(year, month);
    let grandTotal = 0;
    const rows = employees.map(emp => {
      const recs    = getMonthAttendance(emp.id, year, month);
      const present = recs.filter(r => r.punchIn).length;
      const hrs     = recs.reduce((s,r) => s+(r.hoursWorked||0), 0);
      const due     = emp.salaryType==='monthly'
        ? (present>0 ? Math.round(((emp.monthlySalary||0)/totalDays)*present) : 0)
        : (emp.dailyWage||0)*present;
      grandTotal += due;
      const rate = emp.salaryType==='monthly'
        ? `₹${(emp.monthlySalary||0).toLocaleString('en-IN')}/mo`
        : `₹${(emp.dailyWage||0).toLocaleString('en-IN')}/day`;
      return `<tr>
        <td style="font-weight:600">${emp.name}</td>
        <td style="color:var(--text-muted)">${emp.department||'—'}</td>
        <td>${emp.salaryType==='monthly'?'<span class="badge-monthly">Monthly</span>':'<span class="badge-daily">Daily</span>'}</td>
        <td>${rate}</td>
        <td><strong>${present}</strong> <span style="color:var(--text-muted);font-size:0.82rem">/ ${totalDays} days</span></td>
        <td style="color:var(--text-muted)">${hrs.toFixed(1)} hrs</td>
        <td class="salary-amt">₹${due.toLocaleString('en-IN')}</td>
      </tr>`;
    });
    tbody.innerHTML = rows.join('') +
      `<tr class="total-row">
        <td colspan="6" style="text-align:right;padding-right:1rem">Total Payroll for
          ${new Date(year,month-1).toLocaleDateString('en-IN',{month:'long',year:'numeric'})}:
        </td>
        <td class="salary-amt" style="font-size:1rem">₹${grandTotal.toLocaleString('en-IN')}</td>
      </tr>`;
  }

  // ── Close on overlay click ─────────────────────────────────────────────
  document.getElementById('emp-modal').addEventListener('click', function(e) {
    if (e.target === this) closeEmpModal();
  });
  document.getElementById('dept-modal').addEventListener('click', function(e) {
    if (e.target === this) closeDeptModal();
  });
  document.getElementById('emp-view-modal').addEventListener('click', function(e) {
    if (e.target === this) closeViewModal();
  });

  // ── View Employee Details ──────────────────────────────────────────────
  let _viewingEmpId = null;

  function detailRow(label, value) {
    if (!value) return '';
    return `<div style="display:flex;justify-content:space-between;gap:0.5rem;padding:0.38rem 0;border-bottom:1px solid var(--border);font-size:0.84rem">
      <span style="color:var(--text-muted);flex-shrink:0">${label}</span>
      <span style="font-weight:600;text-align:right">${value}</span>
    </div>`;
  }

  function openViewEmployee(id) {
    const emp = getEmployees().find(e => e.id === id);
    if (!emp) return;
    _viewingEmpId = id;

    // Photo
    const photoEl = document.getElementById('ev-photo');
    if (emp.photo) {
      photoEl.innerHTML = `<img src="${emp.photo}" style="width:100%;height:100%;object-fit:cover">`;
    } else {
      photoEl.textContent = '👷';
    }

    // Header
    document.getElementById('ev-name').textContent = emp.name;
    document.getElementById('ev-id').textContent   = emp.id;
    document.getElementById('ev-type-badge').innerHTML   = empTypeBadge(emp.empType);
    document.getElementById('ev-status-badge').innerHTML = emp.active !== false
      ? '<span class="badge-active">Active</span>'
      : '<span class="badge-inactive">Inactive</span>';
    document.getElementById('ev-designation').textContent =
      [emp.designation || emp.role, emp.department].filter(Boolean).join(' · ') || '—';
    document.getElementById('ev-dept-shift').textContent =
      [emp.workLocation, emp.shift ? emp.shift + ' Shift' : ''].filter(Boolean).join(' · ') || '';
    document.getElementById('ev-join-date').textContent =
      emp.joinDate ? 'Joined: ' + new Date(emp.joinDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '';

    // Personal
    const age = emp.dob
      ? Math.floor((Date.now() - new Date(emp.dob)) / (365.25 * 24 * 3600 * 1000)) + ' years'
      : '';
    document.getElementById('ev-personal').innerHTML = [
      detailRow('Father / Spouse', emp.parentName),
      detailRow('Date of Birth',   emp.dob ? new Date(emp.dob).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }) : ''),
      detailRow('Age',             age),
      detailRow('Gender',          emp.gender)
    ].join('') || '<div style="color:var(--text-muted);font-size:0.84rem;text-align:center;padding:0.5rem">No personal details.</div>';

    // Contact
    const addr = [emp.address, emp.village, emp.district, emp.state, emp.pincode].filter(Boolean).join(', ');
    document.getElementById('ev-contact').innerHTML = [
      detailRow('Mobile',    emp.phone ? `<a href="tel:${emp.phone}" style="color:var(--primary)">${emp.phone}</a>` : ''),
      detailRow('Alt Mobile',emp.altPhone ? `<a href="tel:${emp.altPhone}" style="color:var(--primary)">${emp.altPhone}</a>` : ''),
      detailRow('Address',   addr),
      detailRow('Emergency', emp.emergencyContact)
    ].join('') || '<div style="color:var(--text-muted);font-size:0.84rem;text-align:center;padding:0.5rem">No contact details.</div>';

    // Employment
    document.getElementById('ev-employment').innerHTML = [
      detailRow('Employee Type',     empTypeBadge(emp.empType)),
      detailRow('Department',        emp.department),
      detailRow('Designation',       emp.designation || emp.role),
      detailRow('Reporting Manager', emp.reportingManager),
      detailRow('Work Location',     emp.workLocation),
      detailRow('Shift',             emp.shift),
      detailRow('Employment Status', emp.active !== false ? '<span class="badge-active">Active</span>' : '<span class="badge-inactive">Inactive</span>'),
      detailRow('Joining Date',      emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }) : '')
    ].join('');

    // Salary
    const salType = emp.salaryType === 'monthly' ? 'Monthly' : 'Daily Wage';
    const salAmt  = emp.salaryType === 'monthly'
      ? `₹${(emp.monthlySalary||0).toLocaleString('en-IN')} / month`
      : `₹${(emp.dailyWage||0).toLocaleString('en-IN')} / day`;
    const pinMask = String(emp.pin||'').replace(/./g,'●');
    document.getElementById('ev-salary').innerHTML = [
      detailRow('Salary Type',   salType),
      detailRow('Rate',          salAmt),
      detailRow('Login PIN',     `<span style="font-family:monospace;letter-spacing:3px">${pinMask}</span>`)
    ].join('');

    document.getElementById('emp-view-modal').classList.add('active');
  }

  function closeViewModal() {
    document.getElementById('emp-view-modal').classList.remove('active');
    _viewingEmpId = null;
  }

  function openEditFromView() {
    if (!_viewingEmpId) return;
    closeViewModal();
    openEditEmployee(_viewingEmpId);
  }

  // ── Department Master ──────────────────────────────────────────────────
  let _editingDeptId = null;

  function renderDeptList() {
    const depts    = getDepartments();
    const employees = getEmployees();
    const tbody    = document.getElementById('dept-list-body');
    if (!depts.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="no-emp">No departments yet.</td></tr>';
      return;
    }
    tbody.innerHTML = depts.map(d => {
      const empCount = employees.filter(e => e.department === d.name).length;
      const statusBadge = d.active
        ? '<span class="badge-active">Active</span>'
        : '<span class="badge-inactive">Inactive</span>';
      return `<tr>
        <td style="font-family:monospace;font-size:0.78rem;color:var(--text-muted)">${d.id}</td>
        <td style="font-weight:600">${d.name}</td>
        <td style="color:var(--text-muted)">${empCount} employee${empCount !== 1 ? 's' : ''}</td>
        <td>${statusBadge}</td>
        <td><div class="action-btns">
          <button class="btn-icon" onclick="openEditDept('${d.id}')" title="Edit">✏️</button>
          <button class="btn-icon" onclick="toggleDeptStatus('${d.id}')" title="${d.active ? 'Deactivate' : 'Activate'}">
            ${d.active ? '🔴 Deactivate' : '🟢 Activate'}
          </button>
        </div></td>
      </tr>`;
    }).join('');
  }

  function openAddDept() {
    _editingDeptId = null;
    document.getElementById('dept-modal-title').textContent = 'Add Department';
    document.getElementById('dept-name-input').value   = '';
    document.getElementById('dept-status-input').value = 'active';
    document.getElementById('dept-modal-error').style.display = 'none';
    document.getElementById('dept-modal').classList.add('active');
    setTimeout(() => document.getElementById('dept-name-input').focus(), 100);
  }

  function openEditDept(id) {
    const dept = getDepartments().find(d => d.id === id);
    if (!dept) return;
    _editingDeptId = id;
    document.getElementById('dept-modal-title').textContent = 'Edit Department';
    document.getElementById('dept-name-input').value   = dept.name;
    document.getElementById('dept-status-input').value = dept.active ? 'active' : 'inactive';
    document.getElementById('dept-modal-error').style.display = 'none';
    document.getElementById('dept-modal').classList.add('active');
    setTimeout(() => document.getElementById('dept-name-input').focus(), 100);
  }

  function closeDeptModal() {
    document.getElementById('dept-modal').classList.remove('active');
  }

  function saveDept() {
    const name   = document.getElementById('dept-name-input').value.trim();
    const active = document.getElementById('dept-status-input').value === 'active';
    const errEl  = document.getElementById('dept-modal-error');
    errEl.style.display = 'none';
    if (!name) { errEl.textContent = 'Department name is required.'; errEl.style.display = 'block'; return; }

    const depts = getDepartments();
    const duplicate = depts.find(d => d.name.toLowerCase() === name.toLowerCase() && d.id !== _editingDeptId);
    if (duplicate) { errEl.textContent = 'A department with this name already exists.'; errEl.style.display = 'block'; return; }

    if (_editingDeptId) {
      const idx = depts.findIndex(d => d.id === _editingDeptId);
      if (idx !== -1) { depts[idx].name = name; depts[idx].active = active; }
      showToast('Department updated.', 'success');
    } else {
      depts.push({ id: generateDeptId(), name, active });
      showToast('Department added.', 'success');
    }
    saveDepartments(depts);
    closeDeptModal();
    renderDeptList();
    populateDeptDropdown();
  }

  function toggleDeptStatus(id) {
    const depts = getDepartments();
    const dept  = depts.find(d => d.id === id);
    if (!dept) return;
    const empCount = getEmployees().filter(e => e.department === dept.name).length;
    if (dept.active && empCount > 0) {
      if (!confirm(`"${dept.name}" has ${empCount} employee(s) assigned. Deactivate anyway?`)) return;
    }
    dept.active = !dept.active;
    saveDepartments(depts);
    showToast(`"${dept.name}" ${dept.active ? 'activated' : 'deactivated'}.`, 'info');
    renderDeptList();
    populateDeptDropdown();
  }

  // Populate the department dropdown in the Add/Edit Employee form
  function populateDeptDropdown() {
    const select = document.getElementById('ef-department');
    if (!select) return;
    const current = select.value;
    const activeDepts = getDepartments().filter(d => d.active);
    select.innerHTML = '<option value="">Select Department</option>' +
      activeDepts.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    if (current) select.value = current;
  }

  // ── Init ──────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof syncFromSheets === 'function') { try { await syncFromSheets(); } catch(_) {} }
    populateDeptDropdown();
    renderEmployeeList();
    initSalarySelectors();
  });
