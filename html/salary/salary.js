  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let _results = [];

  // ── Init ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    // Set current month/year as default
    const now = new Date();
    document.getElementById('f-month').value  = String(now.getMonth() + 1);
    document.getElementById('f-year').value   = String(now.getFullYear());
    document.getElementById('ot-month').value = String(now.getMonth() + 1);
    document.getElementById('ot-year').value  = String(now.getFullYear());

    // Populate OT employee filter
    const otEmpSel = document.getElementById('ot-f-emp');
    getEmployees().filter(e => e.active !== false).forEach(e => otEmpSel.add(new Option(e.name, e.id)));

    if (typeof syncFromSheets === 'function') { try { await syncFromSheets(); } catch(_) {} }

    calculate();
    renderOT();
  });

  // ── Tab switch ────────────────────────────────────────────────────────────
  function switchTab(tab) {
    document.getElementById('section-payroll').style.display = tab === 'payroll' ? '' : 'none';
    document.getElementById('section-ot').style.display      = tab === 'ot'      ? '' : 'none';
    const pBtn = document.getElementById('tab-payroll');
    const oBtn = document.getElementById('tab-ot');
    pBtn.style.color        = tab === 'payroll' ? 'var(--primary)' : 'var(--text-muted)';
    pBtn.style.borderBottom = tab === 'payroll' ? '2px solid var(--primary)' : '2px solid transparent';
    oBtn.style.color        = tab === 'ot'      ? 'var(--primary)' : 'var(--text-muted)';
    oBtn.style.borderBottom = tab === 'ot'      ? '2px solid var(--primary)' : '2px solid transparent';
    if (tab === 'ot') renderOT();
  }

  // ── Calculate ─────────────────────────────────────────────────────────────
  function calculate() {
    const month = parseInt(document.getElementById('f-month').value);
    const year  = parseInt(document.getElementById('f-year').value);
    const fDept = document.getElementById('f-dept').value;
    const fType = document.getElementById('f-type').value;

    let emps = getEmployees().filter(e => e.active !== false);
    if (fDept) emps = emps.filter(e => e.department === fDept);
    if (fType) emps = emps.filter(e => (e.salaryType||'monthly') === fType);

    _results = emps.map(e => calculateSalary(e.id, year, month)).filter(Boolean);
    renderTable();
    renderSummary();
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  function renderTable() {
    const tbody = document.getElementById('sal-body');
    if (!_results.length) {
      tbody.innerHTML = '<tr><td colspan="12" class="no-row">No employees found for the selected filters.</td></tr>';
      return;
    }
    tbody.innerHTML = _results.map(r => {
      const typeBadge = r.salaryType === 'daily'
        ? `<span class="emp-type-daily">Daily</span>`
        : `<span class="emp-type-monthly">Monthly</span>`;
      const rate = r.salaryType === 'daily'
        ? '₹' + r.dailyWage.toLocaleString('en-IN') + '/day'
        : '₹' + r.monthlySalary.toLocaleString('en-IN') + '/mo';
      const leaves = r.paidLeave + r.sickLeave + r.unpaidLeave;
      const wohol  = r.weeklyOff + r.holiday;
      const otHtml  = r.otAmount > 0
        ? `<span style="color:#27ae60;font-size:.75rem;font-weight:700"> +₹${r.otAmount.toLocaleString('en-IN')} OT</span>` : '';
      const dedHtml = (r.advanceDeductAmount||0) > 0
        ? `<span style="color:#e74c3c;font-size:.75rem;font-weight:700"> –₹${r.advanceDeductAmount.toLocaleString('en-IN')} Adv</span>` : '';
      return `<tr>
        <td>
          <div style="font-weight:700">${r.name}</div>
          <div style="font-size:.72rem;color:var(--text-muted)">${r.department}</div>
        </td>
        <td>${typeBadge}</td>
        <td class="num" style="color:#27ae60;font-weight:700">${r.present}</td>
        <td class="num">${r.halfDay}</td>
        <td class="num">${leaves}</td>
        <td class="num" style="color:${r.absent>0?'#e74c3c':'var(--text)'};font-weight:${r.absent>0?700:400}">${r.absent}</td>
        <td class="num" style="color:var(--text-muted)">${wohol}</td>
        <td class="num" style="font-weight:700">${r.paidDays}</td>
        <td class="amt" style="font-size:.82rem;color:var(--text-muted)">${rate}</td>
        <td class="amt" style="color:var(--text-muted)">₹${r.grossSalary.toLocaleString('en-IN')}${otHtml}${dedHtml}</td>
        <td class="amt" style="font-weight:800;font-size:.95rem;color:var(--primary)">₹${r.netSalary.toLocaleString('en-IN')}</td>
        <td>
          <button onclick="openPayslip('${r.empId}')" style="padding:.28rem .65rem;font-size:.78rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:pointer">🧾 Slip</button>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  function renderSummary() {
    const total      = _results.reduce((s,r) => s + r.netSalary, 0);
    const otTotal    = _results.reduce((s,r) => s + r.otAmount, 0);
    const monthly    = _results.filter(r => r.salaryType !== 'daily');
    const daily      = _results.filter(r => r.salaryType === 'daily');
    const monthlyAmt = monthly.reduce((s,r) => s + r.grossSalary, 0);
    const dailyAmt   = daily.reduce((s,r)   => s + r.grossSalary, 0);
    document.getElementById('summary-strip').innerHTML = [
      ['₹' + total.toLocaleString('en-IN'),      'Total Gross Pay',       '#1a73e8'],
      ['₹' + otTotal.toLocaleString('en-IN'),     'Overtime',              '#27ae60'],
      [monthly.length + ' emp',                   'Monthly Salary',        '#7b1fa2'],
      ['₹' + monthlyAmt.toLocaleString('en-IN'),  'Monthly Amount',        '#7b1fa2'],
      [daily.length + ' emp',                     'Daily Wage Workers',    '#e65c00'],
      ['₹' + dailyAmt.toLocaleString('en-IN'),    'Daily Wage Amount',     '#e65c00'],
    ].map(([v,l,c])=>`<div class="summary-chip"><div class="sc-val" style="color:${c}">${v}</div><div class="sc-lbl">${l}</div></div>`).join('');
  }

  // ── Payslip ────────────────────────────────────────────────────────────────
  function openPayslip(empId) {
    const r = _results.find(x => x.empId === empId);
    if (!r) return;
    const month = parseInt(document.getElementById('f-month').value);
    const year  = parseInt(document.getElementById('f-year').value);
    const period = MONTH_NAMES[month-1] + ' ' + year;

    const rateLine = r.salaryType === 'daily'
      ? `<div class="ps-row"><span class="ps-label">Daily Wage Rate</span><span class="ps-val">₹${r.dailyWage.toLocaleString('en-IN')} / day</span></div>`
      : `<div class="ps-row"><span class="ps-label">Monthly Salary</span><span class="ps-val">₹${r.monthlySalary.toLocaleString('en-IN')}</span></div>
         <div class="ps-row"><span class="ps-label">Per Day Rate</span><span class="ps-val">₹${r.perDayRate.toLocaleString('en-IN')}</span></div>`;

    const calcLine = r.salaryType === 'daily'
      ? `<div class="ps-row"><span class="ps-label">Calculation</span><span class="ps-val">${r.paidDays} days × ₹${r.dailyWage.toLocaleString('en-IN')}</span></div>`
      : `<div class="ps-row"><span class="ps-label">Working Days</span><span class="ps-val">${r.totalWorkingDays}</span></div>
         <div class="ps-row"><span class="ps-label">Absent Deduction</span><span class="ps-val" style="color:#e74c3c">– ₹${Math.round((r.absent+r.unpaidLeave)*r.perDayRate).toLocaleString('en-IN')}</span></div>`;

    document.getElementById('payslip-content').innerHTML = `
      <div class="payslip-header">
        <h2>🧱 BuildMate — Payslip</h2>
        <div class="sub">${period}</div>
      </div>
      <div class="payslip-body">
        <div class="ps-section">
          <h4>Employee Details</h4>
          <div class="ps-row"><span class="ps-label">Name</span><span class="ps-val">${r.name}</span></div>
          <div class="ps-row"><span class="ps-label">Department</span><span class="ps-val">${r.department||'—'}</span></div>
          <div class="ps-row"><span class="ps-label">Salary Type</span><span class="ps-val">${r.salaryType==='daily'?'Daily Wage':'Monthly Salary'}</span></div>
          ${rateLine}
        </div>

        <div class="ps-section">
          <h4>Attendance Summary</h4>
          <div class="att-grid">
            <div class="att-cell green"><div class="ac-val">${r.present}</div><div class="ac-lbl">Present</div></div>
            <div class="att-cell grey"><div class="ac-val">${r.halfDay}</div><div class="ac-lbl">Half Day</div></div>
            <div class="att-cell red"><div class="ac-val">${r.absent}</div><div class="ac-lbl">Absent</div></div>
            <div class="att-cell blue"><div class="ac-val">${r.paidLeave+r.sickLeave}</div><div class="ac-lbl">Paid Leave</div></div>
            <div class="att-cell grey"><div class="ac-val">${r.unpaidLeave}</div><div class="ac-lbl">Unpaid Lv</div></div>
            <div class="att-cell grey"><div class="ac-val">${r.holiday}</div><div class="ac-lbl">Holiday</div></div>
            <div class="att-cell grey"><div class="ac-val">${r.weeklyOff}</div><div class="ac-lbl">Weekly Off</div></div>
            <div class="att-cell blue"><div class="ac-val" style="color:var(--primary)">${r.paidDays}</div><div class="ac-lbl">Paid Days</div></div>
          </div>
        </div>

        <div class="ps-section">
          <h4>Salary Calculation</h4>
          ${calcLine}
        </div>

        ${r.otAmount > 0 ? `<div class="ps-section">
          <h4>Overtime</h4>
          ${r.otRecords.map(o=>`<div class="ps-row"><span class="ps-label">${o.date} — ${o.hours}h × ₹${o.rate}</span><span class="ps-val" style="color:#27ae60">+₹${o.amount.toLocaleString('en-IN')}</span></div>`).join('')}
        </div>` : ''}

        ${(r.advanceDeductAmount||0) > 0 ? `<div class="ps-section">
          <h4>Advance / Deductions</h4>
          ${(r.advanceDetails||[]).map(d=>`<div class="ps-row"><span class="ps-label">${d.type} — ${d.month}</span><span class="ps-val" style="color:#e74c3c">–₹${d.amount.toLocaleString('en-IN')}</span></div>`).join('')}
        </div>` : ''}

        <div style="padding:.5rem 0">
          <div class="ps-row"><span class="ps-label">Gross Salary</span><span class="ps-val">₹${r.grossSalary.toLocaleString('en-IN')}</span></div>
          ${r.otAmount>0?`<div class="ps-row"><span class="ps-label">Overtime</span><span class="ps-val" style="color:#27ae60">+ ₹${r.otAmount.toLocaleString('en-IN')}</span></div>`:''}
          ${(r.advanceDeductAmount||0)>0?`<div class="ps-row"><span class="ps-label">Advance / Deduction</span><span class="ps-val" style="color:#e74c3c">– ₹${r.advanceDeductAmount.toLocaleString('en-IN')}</span></div>`:''}
        </div>

        <div class="ps-total">
          <span>Net Payable</span>
          <span>₹${r.netSalary.toLocaleString('en-IN')}</span>
        </div>
      </div>`;
    document.getElementById('payslip-modal').classList.add('active');
  }

  function printPayslip() {
    const content = document.getElementById('payslip-content').innerHTML;
    const w = window.open('', '_blank', 'width=500,height=700');
    w.document.write(`<!DOCTYPE html><html><head><title>Payslip</title>
      <style>
        body{font-family:sans-serif;margin:0;padding:0}
        .payslip-header{background:#1a73e8;color:#fff;padding:1.2rem 1.5rem}
        .payslip-header h2{margin:0 0 .2rem;font-size:1.1rem}
        .sub{font-size:.82rem;opacity:.85}
        .payslip-body{padding:1.2rem 1.5rem}
        .ps-section{margin-bottom:1.1rem}
        .ps-section h4{font-size:.78rem;font-weight:700;color:#666;text-transform:uppercase;margin:0 0 .5rem;border-bottom:1px solid #eee;padding-bottom:.3rem}
        .ps-row{display:flex;justify-content:space-between;padding:.28rem 0;font-size:.87rem}
        .ps-label{color:#888}.ps-val{font-weight:600}
        .att-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem}
        .att-cell{text-align:center;padding:.4rem .3rem;border-radius:4px;border:1px solid #eee}
        .ac-val{font-size:1.1rem;font-weight:800}.ac-lbl{font-size:.66rem;color:#888;text-transform:uppercase}
        .att-cell.green{background:#e8f8ee;border-color:#27ae60}
        .att-cell.red{background:#fdecea;border-color:#e74c3c}
        .att-cell.blue{background:#e8f0fe;border-color:#1a73e8}
        .att-cell.grey{background:#f5f5f5}
        .ps-total{display:flex;justify-content:space-between;padding:.6rem .8rem;background:#1a73e8;color:#fff;border-radius:4px;font-size:1rem;font-weight:800;margin-top:.8rem}
      <\/style><\/head><body>${content}<\/body><\/html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  }

  // Overlay close
  document.getElementById('payslip-modal').addEventListener('click', function(e) { if(e.target===this) this.classList.remove('active'); });
  document.getElementById('ot-modal').addEventListener('click',      function(e) { if(e.target===this) this.classList.remove('active'); });

  // ── Overtime CRUD ─────────────────────────────────────────────────────────
  let _editOTId = null;

  function renderOT() {
    const month  = parseInt(document.getElementById('ot-month').value);
    const year   = parseInt(document.getElementById('ot-year').value);
    const fEmp   = document.getElementById('ot-f-emp').value;
    const prefix = year + '-' + String(month).padStart(2,'0');

    let entries = getOvertime().filter(o => (o.date||'').startsWith(prefix));
    if (fEmp) entries = entries.filter(o => o.employeeId === fEmp);
    entries.sort((a,b) => a.date.localeCompare(b.date));

    const totalHrs = entries.reduce((s,o) => s + (o.hours||0), 0);
    const totalAmt = entries.reduce((s,o) => s + (o.amount||0), 0);
    document.getElementById('ot-summary-strip').innerHTML = [
      [entries.length,                           'Entries',        'var(--text)'],
      [totalHrs + ' hrs',                        'Total OT Hours', '#e65c00'],
      ['₹' + totalAmt.toLocaleString('en-IN'),   'Total OT Pay',   '#27ae60'],
    ].map(([v,l,c])=>`<div class="summary-chip"><div class="sc-val" style="color:${c}">${v}</div><div class="sc-lbl">${l}</div></div>`).join('');

    const tbody = document.getElementById('ot-body');
    if (!entries.length) { tbody.innerHTML='<tr><td colspan="7" class="no-row">No overtime entries for this month.</td></tr>'; return; }

    tbody.innerHTML = entries.map(o => {
      const d = new Date(o.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
      return `<tr>
        <td style="font-size:.84rem">${d}</td>
        <td><div style="font-weight:700">${o.employeeName}</div></td>
        <td class="num" style="font-weight:700">${o.hours}</td>
        <td class="amt" style="color:var(--text-muted)">₹${(o.rate||0).toLocaleString('en-IN')}/hr</td>
        <td class="amt" style="font-weight:800;color:#27ae60">₹${(o.amount||0).toLocaleString('en-IN')}</td>
        <td style="font-size:.8rem;color:var(--text-muted)">${o.note||'—'}</td>
        <td>
          <button onclick="openEditOT('${o.id}')" style="padding:.25rem .55rem;font-size:.78rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:pointer;margin-right:.3rem">✏️</button>
          <button onclick="deleteOT('${o.id}')" style="padding:.25rem .55rem;font-size:.78rem;border:1.5px solid #e74c3c;border-radius:var(--radius-sm);background:#fdecea;color:#e74c3c;cursor:pointer">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  }

  function openAddOT() {
    _editOTId = null;
    document.getElementById('ot-modal-title').textContent = 'Add OT Entry';
    document.getElementById('ot-emp').innerHTML = '<option value="">Select Employee</option>' +
      getEmployees().filter(e=>e.active!==false).map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
    document.getElementById('ot-date').value        = new Date().toISOString().split('T')[0];
    document.getElementById('ot-hours').value       = '';
    document.getElementById('ot-rate').value        = '';
    document.getElementById('ot-amount-display').value = '₹ —';
    document.getElementById('ot-note').value        = '';
    document.getElementById('ot-error').style.display = 'none';
    document.getElementById('ot-modal').classList.add('active');
  }

  function openEditOT(id) {
    const o = getOvertime().find(x => x.id === id);
    if (!o) return;
    _editOTId = id;
    document.getElementById('ot-modal-title').textContent = 'Edit OT Entry';
    document.getElementById('ot-emp').innerHTML = '<option value="">Select Employee</option>' +
      getEmployees().filter(e=>e.active!==false).map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
    document.getElementById('ot-emp').value          = o.employeeId;
    document.getElementById('ot-date').value         = o.date;
    document.getElementById('ot-hours').value        = o.hours;
    document.getElementById('ot-rate').value         = o.rate;
    document.getElementById('ot-amount-display').value = '₹' + (o.amount||0).toLocaleString('en-IN');
    document.getElementById('ot-note').value         = o.note||'';
    document.getElementById('ot-error').style.display = 'none';
    document.getElementById('ot-modal').classList.add('active');
  }

  function closeOTModal() { document.getElementById('ot-modal').classList.remove('active'); }

  function calcOTAmount() {
    const h = parseFloat(document.getElementById('ot-hours').value) || 0;
    const r = parseFloat(document.getElementById('ot-rate').value)  || 0;
    document.getElementById('ot-amount-display').value = h && r ? '₹' + (h * r).toLocaleString('en-IN') : '₹ —';
  }

  function saveOTEntry() {
    const empId = document.getElementById('ot-emp').value;
    const date  = document.getElementById('ot-date').value;
    const hours = parseFloat(document.getElementById('ot-hours').value);
    const rate  = parseFloat(document.getElementById('ot-rate').value);
    const err   = document.getElementById('ot-error');
    err.style.display = 'none';
    if (!empId) { err.textContent='Select an employee.'; err.style.display='block'; return; }
    if (!date)  { err.textContent='Date is required.';   err.style.display='block'; return; }
    if (!hours || hours <= 0) { err.textContent='Enter valid OT hours.'; err.style.display='block'; return; }
    if (!rate  || rate  <= 0) { err.textContent='Enter valid OT rate.';  err.style.display='block'; return; }

    const emp = getEmployees().find(e => e.id === empId);
    const record = {
      employeeId:   empId,
      employeeName: emp ? emp.name : empId,
      date, hours, rate,
      amount: Math.round(hours * rate),
      note:   document.getElementById('ot-note').value.trim()
    };
    const all = getOvertime();
    if (_editOTId) {
      const idx = all.findIndex(o => o.id === _editOTId);
      if (idx !== -1) all[idx] = { ...all[idx], ...record };
      showToast('OT entry updated.', 'success');
    } else {
      all.unshift({ id: generateOTId(), ...record });
      showToast(`OT saved: ${hours}h × ₹${rate} = ₹${Math.round(hours*rate).toLocaleString('en-IN')}`, 'success');
    }
    saveOvertime(all);
    closeOTModal();
    renderOT();
  }

  function deleteOT(id) {
    const o = getOvertime().find(x => x.id === id);
    if (!o || !confirm(`Delete OT entry for ${o.employeeName} on ${o.date}?`)) return;
    saveOvertime(getOvertime().filter(x => x.id !== id));
    showToast('OT entry deleted.', 'info');
    renderOT();
  }
