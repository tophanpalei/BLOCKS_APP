  // ── State ─────────────────────────────────────────────────────────────────
  let _currentRunId = null;

  const MONTH_NAMES = ['','January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

  function fmt(n) { return '₹' + Number(n||0).toLocaleString('en-IN'); }

  function statusBadge(s) {
    if (s === 'approved') return '<span class="badge-approved">Approved</span>';
    if (s === 'paid')     return '<span class="badge-paid">✓ Paid</span>';
    return '<span class="badge-draft">Draft</span>';
  }

  // ── Runs List View ────────────────────────────────────────────────────────
  function renderList() {
    const month = parseInt(document.getElementById('run-month').value);
    const year  = parseInt(document.getElementById('run-year').value);
    const runId = generatePayrollId(year, month);
    const exists = getPayrollRuns().some(r => r.id === runId);

    const warn = document.getElementById('run-warning');
    if (exists) {
      warn.style.display = 'block';
      warn.textContent   = `⚠ A payroll run already exists for ${MONTH_NAMES[month]} ${year}. Click View to open it.`;
    } else {
      warn.style.display = 'none';
    }

    const all = getPayrollRuns().slice().sort((a,b) => b.id.localeCompare(a.id));
    const tbody = document.getElementById('runs-body');
    if (!all.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="no-row">No payroll runs yet. Select a month and click <strong>▶ Run Payroll</strong>.</td></tr>';
      return;
    }
    tbody.innerHTML = all.map(r => {
      const mName = MONTH_NAMES[r.month] + ' ' + r.year;
      const created = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—';
      return `<tr>
        <td style="font-weight:700">${mName}</td>
        <td>${(r.entries||[]).length}</td>
        <td style="text-align:right;font-weight:600">${fmt(r.totalGross)}</td>
        <td style="text-align:right;color:#e74c3c">${fmt(r.totalDeductions)}</td>
        <td style="text-align:right;font-weight:800;color:#2e7d32">${fmt(r.totalNet)}</td>
        <td>${statusBadge(r.status)}</td>
        <td style="font-size:.8rem;color:var(--text-muted)">${created}</td>
        <td>
          <button onclick="openDetail('${r.id}')" style="padding:.28rem .7rem;font-size:.8rem;border:1.5px solid var(--primary);border-radius:var(--radius-sm);cursor:pointer;background:var(--bg);color:var(--primary);font-weight:700">📋 View</button>
          ${r.status==='draft'?`<button onclick="deleteRun('${r.id}')" style="padding:.28rem .65rem;font-size:.8rem;border:1.5px solid #e74c3c;border-radius:var(--radius-sm);cursor:pointer;background:#fdecea;color:#e74c3c;margin-left:.3rem">🗑️</button>`:''}
        </td>
      </tr>`;
    }).join('');
  }

  document.getElementById('run-month').addEventListener('change', renderList);
  document.getElementById('run-year').addEventListener('change', renderList);

  // ── Run Payroll ───────────────────────────────────────────────────────────
  function runPayroll() {
    const month = parseInt(document.getElementById('run-month').value);
    const year  = parseInt(document.getElementById('run-year').value);
    const runId = generatePayrollId(year, month);

    const existing = getPayrollRuns().find(r => r.id === runId);
    if (existing) { openDetail(runId); return; }

    const employees = getEmployees();
    if (!employees.length) { showToast('No employees found.', 'error'); return; }

    const entries = employees.map(emp => {
      const s = calculateSalary(emp.id, year, month);
      if (!s) return null;
      const otherAllowance = 0;
      const otherDeduction = 0;
      const grossSalary    = s.grossSalary + s.otAmount + otherAllowance;
      const totalDed       = s.advanceDeductAmount + otherDeduction;
      const netSalary      = Math.max(0, grossSalary - totalDed);
      return {
        empId: s.empId, name: s.name, department: s.department, salaryType: s.salaryType,
        present: s.present, halfDay: s.halfDay, absent: s.absent,
        paidLeave: s.paidLeave, sickLeave: s.sickLeave, unpaidLeave: s.unpaidLeave,
        weeklyOff: s.weeklyOff, holiday: s.holiday,
        paidDays: s.paidDays, totalWorkingDays: s.totalWorkingDays,
        perDayRate: s.perDayRate, monthlySalary: s.monthlySalary, dailyWage: s.dailyWage,
        basicSalary: s.grossSalary, otAmount: s.otAmount,
        otherAllowance, grossSalary,
        advanceDeduction: s.advanceDeductAmount, otherDeduction, netSalary,
        otRecords: s.otRecords, advanceDetails: s.advanceDetails
      };
    }).filter(Boolean);

    const totalGross      = entries.reduce((s,e) => s + e.grossSalary,      0);
    const totalDeductions = entries.reduce((s,e) => s + e.advanceDeduction + e.otherDeduction, 0);
    const totalNet        = entries.reduce((s,e) => s + e.netSalary,         0);

    const run = {
      id: runId, year, month, status: 'draft',
      createdAt: new Date().toISOString(),
      approvedAt: null, paidAt: null,
      totalGross, totalDeductions, totalNet, entries
    };

    const all = getPayrollRuns();
    all.unshift(run);
    savePayrollRuns(all);
    showToast(`${MONTH_NAMES[month]} ${year} payroll created — ${entries.length} employees.`, 'success');
    openDetail(runId);
  }

  // ── Detail View ───────────────────────────────────────────────────────────
  function openDetail(runId) {
    _currentRunId = runId;
    document.getElementById('view-list').style.display   = 'none';
    document.getElementById('view-detail').style.display = 'block';
    renderDetail();
  }

  function backToList() {
    document.getElementById('view-detail').style.display = 'none';
    document.getElementById('view-list').style.display   = 'block';
    _currentRunId = null;
    renderList();
  }

  function recalcTotals(run) {
    run.totalGross      = run.entries.reduce((s,e) => s + e.grossSalary, 0);
    run.totalDeductions = run.entries.reduce((s,e) => s + e.advanceDeduction + e.otherDeduction, 0);
    run.totalNet        = run.entries.reduce((s,e) => s + e.netSalary, 0);
  }

  function renderDetail() {
    const run = getPayrollRuns().find(r => r.id === _currentRunId);
    if (!run) { backToList(); return; }

    const locked = run.status !== 'draft';
    document.getElementById('detail-title').textContent     = MONTH_NAMES[run.month] + ' ' + run.year + ' Payroll';
    document.getElementById('detail-status-badge').innerHTML = statusBadge(run.status);
    document.getElementById('d-emp').textContent   = (run.entries||[]).length;
    document.getElementById('d-gross').textContent = fmt(run.totalGross);
    document.getElementById('d-ded').textContent   = fmt(run.totalDeductions);
    document.getElementById('d-net').textContent   = fmt(run.totalNet);

    // Action bar
    document.getElementById('action-bar-info').innerHTML =
      `<span style="font-weight:700">${(run.entries||[]).length} employees</span> &nbsp;·&nbsp; Gross: <strong>${fmt(run.totalGross)}</strong> &nbsp;·&nbsp; Net: <strong style="color:#2e7d32">${fmt(run.totalNet)}</strong>`;
    document.getElementById('paid-stamp').style.display   = run.status === 'paid'     ? 'inline-block' : 'none';
    document.getElementById('btn-approve').style.display  = run.status === 'draft'    ? 'inline-block' : 'none';
    document.getElementById('btn-markpaid').style.display = run.status === 'approved' ? 'inline-block' : 'none';

    // Table body
    const tbody = document.getElementById('detail-body');
    tbody.innerHTML = (run.entries||[]).map((e, idx) => {
      const advHtml  = e.advanceDeduction > 0
        ? `<span style="color:#e74c3c;font-weight:700">${fmt(e.advanceDeduction)}</span>` : '—';
      const allowInput  = `<input class="inline-input" type="number" min="0" value="${e.otherAllowance||0}"
        ${locked ? 'disabled' : `onchange="updateEntry(${idx},'otherAllowance',this.value)"`}>`;
      const deductInput = `<input class="inline-input" type="number" min="0" value="${e.otherDeduction||0}"
        ${locked ? 'disabled' : `onchange="updateEntry(${idx},'otherDeduction',this.value)"`}>`;
      return `<tr id="pr-row-${idx}">
        <td>
          <div style="font-weight:700">${e.name}</div>
          <div style="font-size:.72rem;color:var(--text-muted)">${e.department||'—'}</div>
        </td>
        <td class="amt">${fmt(e.basicSalary)}</td>
        <td class="amt" style="color:#27ae60">${e.otAmount > 0 ? fmt(e.otAmount) : '—'}</td>
        <td class="amt">${allowInput}</td>
        <td class="amt gross-col" id="gross-${idx}">${fmt(e.grossSalary)}</td>
        <td class="amt ded-col">${advHtml}</td>
        <td class="amt ded-col">${deductInput}</td>
        <td class="amt net-col" id="net-${idx}">${fmt(e.netSalary)}</td>
        <td class="ctr">
          <button onclick="printSlip(${idx})" style="padding:.28rem .65rem;font-size:.78rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:pointer">🧾 Slip</button>
        </td>
      </tr>`;
    }).join('');

    // Footer totals row
    document.getElementById('detail-foot').innerHTML = `<tr style="background:var(--bg)">
      <td style="font-weight:800;font-size:.83rem">TOTAL</td>
      <td class="amt" style="font-weight:700">${fmt(run.entries.reduce((s,e)=>s+e.basicSalary,0))}</td>
      <td class="amt" style="font-weight:700;color:#27ae60">${fmt(run.entries.reduce((s,e)=>s+e.otAmount,0))}</td>
      <td class="amt" style="font-weight:700">${fmt(run.entries.reduce((s,e)=>s+(e.otherAllowance||0),0))}</td>
      <td class="amt gross-col">${fmt(run.totalGross)}</td>
      <td class="amt ded-col">${fmt(run.entries.reduce((s,e)=>s+e.advanceDeduction,0))}</td>
      <td class="amt ded-col">${fmt(run.entries.reduce((s,e)=>s+(e.otherDeduction||0),0))}</td>
      <td class="amt net-col">${fmt(run.totalNet)}</td>
      <td></td>
    </tr>`;
  }

  // ── Inline edit ───────────────────────────────────────────────────────────
  function updateEntry(idx, field, rawVal) {
    const val = Math.max(0, parseFloat(rawVal)||0);
    const all = getPayrollRuns();
    const run = all.find(r => r.id === _currentRunId);
    if (!run || run.status !== 'draft') return;
    const e = run.entries[idx];
    e[field] = val;
    e.grossSalary = e.basicSalary + e.otAmount + (e.otherAllowance||0);
    e.netSalary   = Math.max(0, e.grossSalary - e.advanceDeduction - (e.otherDeduction||0));
    recalcTotals(run);
    savePayrollRuns(all);
    // Update cells without full re-render
    document.getElementById('gross-' + idx).textContent = fmt(e.grossSalary);
    document.getElementById('net-'   + idx).textContent = fmt(e.netSalary);
    document.getElementById('d-gross').textContent = fmt(run.totalGross);
    document.getElementById('d-ded').textContent   = fmt(run.totalDeductions);
    document.getElementById('d-net').textContent   = fmt(run.totalNet);
    document.getElementById('action-bar-info').innerHTML =
      `<span style="font-weight:700">${run.entries.length} employees</span> &nbsp;·&nbsp; Gross: <strong>${fmt(run.totalGross)}</strong> &nbsp;·&nbsp; Net: <strong style="color:#2e7d32">${fmt(run.totalNet)}</strong>`;
    // Update footer totals
    document.getElementById('detail-foot').querySelector('tr').cells[3].textContent = fmt(run.entries.reduce((s,e)=>s+(e.otherAllowance||0),0));
    document.getElementById('detail-foot').querySelector('tr').cells[5].textContent = fmt(run.entries.reduce((s,e)=>s+(e.otherDeduction||0),0));
    document.getElementById('detail-foot').querySelector('tr').cells[6].innerHTML   = `<td class="amt net-col">${fmt(run.totalNet)}<\/td>`;
    document.getElementById('detail-foot').querySelector('tr').cells[7].textContent = fmt(run.totalNet);
  }

  // ── Approve / Pay ─────────────────────────────────────────────────────────
  function approvePayroll() {
    if (!confirm('Approve this payroll? Figures will be locked and cannot be edited.')) return;
    const all = getPayrollRuns();
    const run = all.find(r => r.id === _currentRunId);
    if (!run) return;
    run.status     = 'approved';
    run.approvedAt = new Date().toISOString();
    savePayrollRuns(all);
    showToast('Payroll approved.', 'success');
    renderDetail();
  }

  function markPaid() {
    if (!confirm('Mark this payroll as Paid?')) return;
    const all = getPayrollRuns();
    const run = all.find(r => r.id === _currentRunId);
    if (!run) return;
    run.status = 'paid';
    run.paidAt = new Date().toISOString();
    savePayrollRuns(all);
    showToast('Payroll marked as Paid.', 'success');
    renderDetail();
  }

  function deleteRun(runId) {
    const run = getPayrollRuns().find(r => r.id === runId);
    if (!run || run.status !== 'draft') return;
    if (!confirm('Delete this draft payroll run?')) return;
    savePayrollRuns(getPayrollRuns().filter(r => r.id !== runId));
    showToast('Payroll run deleted.', 'info');
    renderList();
  }

  // ── Payslip ───────────────────────────────────────────────────────────────
  function printSlip(idx) {
    const run = getPayrollRuns().find(r => r.id === _currentRunId);
    if (!run) return;
    const e = run.entries[idx];
    openPayslipWindow(e, run);
  }

  function printAllSlips() {
    const run = getPayrollRuns().find(r => r.id === _currentRunId);
    if (!run) return;
    if (!confirm(`Print payslips for all ${run.entries.length} employees?`)) return;
    run.entries.forEach((e, i) => {
      setTimeout(() => openPayslipWindow(e, run), i * 400);
    });
  }

  function openPayslipWindow(e, run) {
    const period = MONTH_NAMES[run.month] + ' ' + run.year;
    const salaryLabel = e.salaryType === 'daily'
      ? `Daily Wage: ₹${(e.dailyWage||0).toLocaleString('en-IN')}/day`
      : `Monthly Salary: ₹${(e.monthlySalary||0).toLocaleString('en-IN')}/month`;

    const otRows = (e.otRecords||[]).map(o =>
      `<div class="row"><span class="lbl">${o.date} &mdash; ${o.hours}h &times; &#8377;${o.rate}</span><span class="val add">+&#8377;${o.amount.toLocaleString('en-IN')}<\/span><\/div>`
    ).join('');
    const advRows = (e.advanceDetails||[]).map(d =>
      `<div class="row"><span class="lbl">${d.type} &mdash; ${d.month}<\/span><span class="val ded">&minus;&#8377;${d.amount.toLocaleString('en-IN')}<\/span><\/div>`
    ).join('');

    const w = window.open('', '_blank', 'width=480,height=780');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payslip &mdash; ${e.name}<\/title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:13px;color:#222;background:#fff}
      .header{background:#1a73e8;color:#fff;padding:16px 20px}
      .header h2{font-size:15px;margin-bottom:3px}
      .header .sub{font-size:11px;opacity:.85}
      .body{padding:16px 20px}
      .section{margin-bottom:14px}
      .section h4{font-size:10px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:8px;letter-spacing:.5px}
      .row{display:flex;justify-content:space-between;padding:3px 0;font-size:12.5px}
      .lbl{color:#555}.val{font-weight:600}
      .add{color:#27ae60}.ded{color:#e74c3c}
      .divider{border:none;border-top:1px dashed #ccc;margin:8px 0}
      .gross-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;font-weight:700;border-top:1px solid #ddd;margin-top:4px}
      .total-bar{display:flex;justify-content:space-between;background:#1a73e8;color:#fff;padding:10px 14px;border-radius:4px;font-size:15px;font-weight:800;margin-top:10px}
      .att-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:6px}
      .ac{text-align:center;padding:5px 3px;border-radius:4px;border:1px solid #e0e0e0}
      .ac .av{font-size:15px;font-weight:800}.ac .al{font-size:9px;color:#888;text-transform:uppercase}
      .ac.g{background:#e8f8ee;border-color:#81c784}.ac.r{background:#fdecea;border-color:#e57373}
      .ac.b{background:#e3f2fd;border-color:#64b5f6}.ac.gr{background:#f5f5f5}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    <\/style><\/head><body>
    <div class="header"><h2>&#127463;&#127479; BuildMate &mdash; Payslip<\/h2><div class="sub">${period} &nbsp;&bull;&nbsp; Generated ${new Date().toLocaleDateString('en-IN')}<\/div><\/div>
    <div class="body">
      <div class="section">
        <h4>Employee Details<\/h4>
        <div class="row"><span class="lbl">Name<\/span><span class="val">${e.name}<\/span><\/div>
        <div class="row"><span class="lbl">Department<\/span><span class="val">${e.department||'&mdash;'}<\/span><\/div>
        <div class="row"><span class="lbl">Salary Type<\/span><span class="val">${e.salaryType==='daily'?'Daily Wage':'Monthly Salary'}<\/span><\/div>
        <div class="row"><span class="lbl">${salaryLabel.split(':')[0]}<\/span><span class="val">${salaryLabel.split(':')[1]}<\/span><\/div>
      <\/div>

      <div class="section">
        <h4>Attendance Summary<\/h4>
        <div class="att-grid">
          <div class="ac g"><div class="av">${e.present}<\/div><div class="al">Present<\/div><\/div>
          <div class="ac gr"><div class="av">${e.halfDay}<\/div><div class="al">Half Day<\/div><\/div>
          <div class="ac r"><div class="av">${e.absent}<\/div><div class="al">Absent<\/div><\/div>
          <div class="ac b"><div class="av">${e.paidLeave+e.sickLeave}<\/div><div class="al">Leave<\/div><\/div>
          <div class="ac gr"><div class="av">${e.weeklyOff}<\/div><div class="al">Weekly Off<\/div><\/div>
          <div class="ac gr"><div class="av">${e.holiday}<\/div><div class="al">Holiday<\/div><\/div>
          <div class="ac b"><div class="av">${e.paidDays}<\/div><div class="al">Paid Days<\/div><\/div>
        <\/div>
      <\/div>

      <div class="section">
        <h4>Earnings<\/h4>
        <div class="row"><span class="lbl">Basic Salary<\/span><span class="val">&#8377;${e.basicSalary.toLocaleString('en-IN')}<\/span><\/div>
        ${e.otAmount > 0 ? `<div class="row"><span class="lbl">Overtime<\/span><span class="val add">+&#8377;${e.otAmount.toLocaleString('en-IN')}<\/span><\/div>${otRows}` : ''}
        ${(e.otherAllowance||0) > 0 ? `<div class="row"><span class="lbl">Other Allowance<\/span><span class="val add">+&#8377;${(e.otherAllowance).toLocaleString('en-IN')}<\/span><\/div>` : ''}
        <div class="gross-row"><span>Gross Salary<\/span><span>&#8377;${e.grossSalary.toLocaleString('en-IN')}<\/span><\/div>
      <\/div>

      ${(e.advanceDeduction + (e.otherDeduction||0)) > 0 ? `<div class="section">
        <h4>Deductions<\/h4>
        ${e.advanceDeduction > 0 ? `<div class="row"><span class="lbl">Advance Deduction<\/span><span class="val ded">&minus;&#8377;${e.advanceDeduction.toLocaleString('en-IN')}<\/span><\/div>${advRows}` : ''}
        ${(e.otherDeduction||0) > 0 ? `<div class="row"><span class="lbl">Other Deduction<\/span><span class="val ded">&minus;&#8377;${(e.otherDeduction).toLocaleString('en-IN')}<\/span><\/div>` : ''}
        <hr class="divider">
        <div class="gross-row ded"><span>Total Deductions<\/span><span>&minus;&#8377;${(e.advanceDeduction+(e.otherDeduction||0)).toLocaleString('en-IN')}<\/span><\/div>
      <\/div>` : ''}

      <div class="total-bar"><span>Net Payable<\/span><span>&#8377;${e.netSalary.toLocaleString('en-IN')}<\/span><\/div>
    <\/div>
    <script>window.onload=function(){window.print();}<\/script>
    <\/body><\/html>`);
    w.document.close();
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof syncFromSheets === 'function') { try { await syncFromSheets(); } catch(_) {} }
    // Default month to current
    const now = new Date();
    document.getElementById('run-month').value = now.getMonth() + 1;
    document.getElementById('run-year').value  = now.getFullYear();
    renderList();
  });
