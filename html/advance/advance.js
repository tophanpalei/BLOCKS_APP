  let _editAdvId = null;
  let _viewAdvId = null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmt(n) { return '₹' + Number(n||0).toLocaleString('en-IN'); }
  function typeBadge(t) {
    if (t === 'Advance')   return `<span class="badge-advance">Advance</span>`;
    if (t === 'Loan')      return `<span class="badge-loan">Loan</span>`;
    return `<span class="badge-deduction">Deduction</span>`;
  }
  function closeModal(id) { document.getElementById(id).classList.remove('active'); }

  function paidOf(adv) { return (adv.payments||[]).reduce((s,p) => s+(p.amount||0), 0); }
  function remainingOf(adv) { return Math.max(0, (adv.totalAmount||0) - paidOf(adv)); }

  // ── Summary ───────────────────────────────────────────────────────────────
  function renderSummary() {
    const all    = getAdvances();
    const active = all.filter(a => a.status === 'active');
    const outstanding = active.reduce((s,a) => s + remainingOf(a), 0);
    const recovered   = all.reduce((s,a) => s + paidOf(a), 0);

    const now = new Date();
    const mStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const thisMonth = all.flatMap(a => (a.payments||[]).filter(p => p.month === mStr))
                        .reduce((s,p) => s+(p.amount||0), 0);

    document.getElementById('s-active').textContent      = active.length;
    document.getElementById('s-outstanding').textContent = fmt(outstanding);
    document.getElementById('s-recovered').textContent   = fmt(recovered);
    document.getElementById('s-month').textContent       = fmt(thisMonth);
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  function render() {
    const empF    = document.getElementById('f-emp').value;
    const typeF   = document.getElementById('f-type').value;
    const statusF = document.getElementById('f-status').value;

    let data = getAdvances();
    if (empF)    data = data.filter(a => a.employeeId === empF);
    if (typeF)   data = data.filter(a => a.type === typeF);
    if (statusF) data = data.filter(a => a.status === statusF);

    data.sort((a,b) => (b.startDate||'').localeCompare(a.startDate||''));
    document.getElementById('adv-count').textContent = data.length + ' record(s)';

    const tbody = document.getElementById('adv-body');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="no-row">No records found. Click <strong>+ New Entry</strong> to add.</td></tr>';
      renderSummary();
      return;
    }

    tbody.innerHTML = data.map(a => {
      const paid      = paidOf(a);
      const remaining = remainingOf(a);
      const pct       = a.totalAmount > 0 ? Math.min(100, Math.round(paid/a.totalAmount*100)) : 0;
      return `<tr>
        <td style="font-size:.78rem;color:var(--text-muted)">${a.id}</td>
        <td style="font-weight:600">${a.employeeName||a.employeeId}</td>
        <td>${typeBadge(a.type)}</td>
        <td style="font-weight:700">${fmt(a.totalAmount)}</td>
        <td style="color:#2e7d32;font-weight:600">${fmt(paid)}</td>
        <td>
          <div style="font-weight:700;color:${remaining>0?'#c0392b':'#2e7d32'}">${fmt(remaining)}</div>
          <div class="progress-bar" style="margin-top:3px"><div class="progress-fill" style="width:${pct}%"></div></div>
        </td>
        <td>${a.monthlyDeduction > 0 ? fmt(a.monthlyDeduction)+'/mo' : '<span style="color:var(--text-muted);font-size:.8rem">One-time</span>'}</td>
        <td>${a.status==='active' ? '<span class="badge-active">Active</span>' : '<span class="badge-cleared">Cleared</span>'}</td>
        <td>
          <button onclick="openView('${a.id}')" style="padding:.28rem .65rem;font-size:.8rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;background:var(--bg)">📋 View</button>
          <button onclick="openEdit('${a.id}')" style="padding:.28rem .65rem;font-size:.8rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;background:var(--bg);margin-left:.3rem">✏️ Edit</button>
          <button onclick="deleteAdv('${a.id}')" style="padding:.28rem .65rem;font-size:.8rem;border:1.5px solid #e74c3c;border-radius:var(--radius-sm);cursor:pointer;background:#fdecea;color:#e74c3c;margin-left:.3rem">🗑️</button>
        </td>
      </tr>`;
    }).join('');
    renderSummary();
  }

  // ── Add / Edit ────────────────────────────────────────────────────────────
  function populateEmpDropdown(selId, currentVal) {
    const sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">-- Select Employee --</option>' +
      getEmployees().map(e => `<option value="${e.id}">${e.name} (${e.id})</option>`).join('');
    if (currentVal) sel.value = currentVal;
  }

  function openAddModal() {
    _editAdvId = null;
    document.getElementById('adv-modal-title').textContent = 'New Advance / Deduction';
    populateEmpDropdown('adv-emp', '');
    document.getElementById('adv-type').value   = 'Advance';
    document.getElementById('adv-total').value  = '';
    document.getElementById('adv-monthly').value = '';
    document.getElementById('adv-date').value   = new Date().toISOString().slice(0,10);
    document.getElementById('adv-status').value = 'active';
    document.getElementById('adv-note').value   = '';
    document.getElementById('adv-error').style.display = 'none';
    document.getElementById('adv-modal').classList.add('active');
  }

  function openEdit(id) {
    const a = getAdvances().find(x => x.id === id);
    if (!a) return;
    _editAdvId = id;
    document.getElementById('adv-modal-title').textContent = 'Edit ' + a.type;
    populateEmpDropdown('adv-emp', a.employeeId);
    document.getElementById('adv-type').value    = a.type;
    document.getElementById('adv-total').value   = a.totalAmount;
    document.getElementById('adv-monthly').value = a.monthlyDeduction || 0;
    document.getElementById('adv-date').value    = a.startDate || '';
    document.getElementById('adv-status').value  = a.status || 'active';
    document.getElementById('adv-note').value    = a.note || '';
    document.getElementById('adv-error').style.display = 'none';
    document.getElementById('adv-modal').classList.add('active');
  }

  function saveAdvanceEntry() {
    const empId   = document.getElementById('adv-emp').value;
    const type    = document.getElementById('adv-type').value;
    const total   = parseFloat(document.getElementById('adv-total').value);
    const monthly = parseFloat(document.getElementById('adv-monthly').value) || 0;
    const date    = document.getElementById('adv-date').value;
    const status  = document.getElementById('adv-status').value;
    const note    = document.getElementById('adv-note').value.trim();
    const err     = document.getElementById('adv-error');
    err.style.display = 'none';

    if (!empId) { err.textContent='Select an employee.'; err.style.display='block'; return; }
    if (!total || total <= 0) { err.textContent='Enter a valid amount.'; err.style.display='block'; return; }
    if (!date) { err.textContent='Select a start date.'; err.style.display='block'; return; }

    const emp = getEmployees().find(e => e.id === empId);
    const all = getAdvances();

    if (_editAdvId) {
      const idx = all.findIndex(a => a.id === _editAdvId);
      if (idx !== -1) {
        all[idx] = { ...all[idx], employeeId: empId, employeeName: emp ? emp.name : empId,
          type, totalAmount: total, monthlyDeduction: monthly, startDate: date, status, note };
      }
      showToast('Record updated.', 'success');
    } else {
      all.push({ id: generateAdvanceId(), employeeId: empId, employeeName: emp ? emp.name : empId,
        type, totalAmount: total, monthlyDeduction: monthly, startDate: date, status, note, payments: [] });
      showToast('Record added.', 'success');
    }
    saveAdvances(all);
    closeModal('adv-modal');
    render();
  }

  function deleteAdv(id) {
    const a = getAdvances().find(x => x.id === id);
    if (!a) return;
    if (!confirm(`Delete ${a.type} of ${fmt(a.totalAmount)} for ${a.employeeName||a.employeeId}?`)) return;
    saveAdvances(getAdvances().filter(x => x.id !== id));
    showToast('Record deleted.', 'info');
    render();
  }

  // ── View Details ──────────────────────────────────────────────────────────
  function openView(id) {
    const a = getAdvances().find(x => x.id === id);
    if (!a) return;
    _viewAdvId = id;
    const paid      = paidOf(a);
    const remaining = remainingOf(a);
    const pct       = a.totalAmount > 0 ? Math.min(100, Math.round(paid/a.totalAmount*100)) : 0;

    document.getElementById('view-title').textContent = a.type + ' — ' + (a.employeeName||a.employeeId);
    document.getElementById('apply-btn').style.display = a.status === 'active' ? 'inline-flex' : 'none';

    const payments = (a.payments||[]).slice().sort((x,y) => (y.month||'').localeCompare(x.month||''));

    document.getElementById('view-body').innerHTML = `
      <div class="remaining-info">
        <div class="rem-stat"><div class="rv" style="color:#1a73e8">${fmt(a.totalAmount)}</div><div class="rl">Total ${a.type}</div></div>
        <div class="rem-stat"><div class="rv" style="color:#2e7d32">${fmt(paid)}</div><div class="rl">Recovered</div></div>
        <div class="rem-stat"><div class="rv" style="color:${remaining>0?'#c0392b':'#2e7d32'}">${fmt(remaining)}</div><div class="rl">Remaining</div></div>
      </div>
      <div class="progress-bar" style="margin-bottom:.8rem;height:8px">
        <div class="progress-fill" style="width:${pct}%;background:${pct===100?'#2e7d32':'#1a73e8'}"></div>
      </div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:.6rem">
        ${typeBadge(a.type)}
        <span style="margin-left:.5rem">Monthly deduction: <strong>${a.monthlyDeduction>0 ? fmt(a.monthlyDeduction)+'/mo' : 'One-time'}</strong></span>
        <span style="margin-left:.5rem">Started: <strong>${a.startDate||'—'}</strong></span>
        ${a.note ? `<span style="margin-left:.5rem">Note: <em>${a.note}</em></span>` : ''}
      </div>
      <div class="pay-history">
        <div style="font-size:.8rem;font-weight:700;color:var(--text-muted);margin-bottom:.4rem">PAYMENT HISTORY</div>
        ${payments.length ? `
        <table>
          <thead><tr><th>Month</th><th>Amount</th><th>Note</th><th></th></tr></thead>
          <tbody>
            ${payments.map(p => `<tr>
              <td>${p.month}</td>
              <td style="font-weight:700;color:#2e7d32">${fmt(p.amount)}</td>
              <td style="color:var(--text-muted)">${p.note||'—'}</td>
              <td><button onclick="deletePayment('${a.id}','${p.id}')" style="padding:.18rem .5rem;font-size:.75rem;border:1px solid #e74c3c;border-radius:4px;cursor:pointer;background:#fdecea;color:#e74c3c">✕</button></td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<div style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0">No payments applied yet.</div>'}
      </div>`;

    document.getElementById('view-modal').classList.add('active');
  }

  function deletePayment(advId, payId) {
    if (!confirm('Remove this payment entry?')) return;
    const all = getAdvances();
    const idx = all.findIndex(a => a.id === advId);
    if (idx === -1) return;
    all[idx].payments = (all[idx].payments||[]).filter(p => p.id !== payId);
    saveAdvances(all);
    showToast('Payment removed.', 'info');
    openView(advId);
    render();
  }

  // ── Apply Monthly Deduction ───────────────────────────────────────────────
  function openApplyDeduction() {
    const a = getAdvances().find(x => x.id === _viewAdvId);
    if (!a) return;
    const now = new Date();
    document.getElementById('apply-month').value  = String(now.getMonth()+1).padStart(2,'0');
    document.getElementById('apply-year').value   = now.getFullYear();
    document.getElementById('apply-amount').value = a.monthlyDeduction || '';
    document.getElementById('apply-note').value   = '';
    document.getElementById('apply-error').style.display = 'none';
    document.getElementById('apply-modal').classList.add('active');
  }

  function confirmApply() {
    const month  = document.getElementById('apply-month').value;
    const year   = document.getElementById('apply-year').value;
    const amount = parseFloat(document.getElementById('apply-amount').value);
    const note   = document.getElementById('apply-note').value.trim();
    const err    = document.getElementById('apply-error');
    err.style.display = 'none';

    if (!amount || amount <= 0) { err.textContent='Enter a valid amount.'; err.style.display='block'; return; }

    const all = getAdvances();
    const idx = all.findIndex(a => a.id === _viewAdvId);
    if (idx === -1) return;
    const a = all[idx];

    const monthStr = year + '-' + month;
    // Prevent duplicate for same month
    if ((a.payments||[]).some(p => p.month === monthStr)) {
      err.textContent = 'A payment is already applied for ' + monthStr + '.';
      err.style.display = 'block';
      return;
    }

    const paid      = paidOf(a);
    const remaining = remainingOf(a);
    if (amount > remaining) {
      err.textContent = `Amount (${fmt(amount)}) exceeds remaining balance (${fmt(remaining)}).`;
      err.style.display = 'block';
      return;
    }

    const payId = 'ADVP' + String(Date.now()).slice(-6);
    if (!a.payments) a.payments = [];
    a.payments.push({ id: payId, month: monthStr, amount, note });

    // Auto-clear if fully recovered
    if (paidOf(a) >= a.totalAmount) {
      a.status = 'cleared';
      showToast('Advance fully recovered — marked Cleared.', 'success');
    } else {
      showToast('Deduction applied for ' + monthStr + '.', 'success');
    }

    saveAdvances(all);
    closeModal('apply-modal');
    openView(_viewAdvId);
    render();
  }

  // Overlay close
  ['adv-modal','view-modal','apply-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) { if (e.target===this) this.classList.remove('active'); });
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof syncFromSheets === 'function') { try { await syncFromSheets(); } catch(_) {} }

    // Populate employee filter
    const fEmp = document.getElementById('f-emp');
    getEmployees().forEach(e => fEmp.add(new Option(e.name + ' (' + e.id + ')', e.id)));

    render();
  });
