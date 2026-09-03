  let _editExpId = null;

  // ── Helpers ────────────────────────────────────────────────────────────
  function fmtDate(isoDate) {
    return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function calcExpTotal() {
    const qty   = parseFloat(document.getElementById('ef-qty').value)   || 0;
    const price = parseFloat(document.getElementById('ef-price').value) || 0;
    document.getElementById('ef-total-display').textContent = '₹' + (qty * price).toLocaleString('en-IN');
  }

  // ── Summary Cards ──────────────────────────────────────────────────────
  function refreshSummary() {
    const all  = getExpenses();
    const now  = new Date();
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const prefix = yyyy + '-' + mm;

    const thisMonth  = all.filter(e => (e.date || '').startsWith(prefix));
    const monthTotal = thisMonth.reduce((s, e) => s + (e.total || 0), 0);

    const pending     = all.filter(e => e.status === 'Pending');
    const pendingAmt  = pending.reduce((s, e) => s + (e.total || 0), 0);
    const allTime     = all.reduce((s, e) => s + (e.total || 0), 0);

    document.getElementById('s-month-total').textContent    = '₹' + monthTotal.toLocaleString('en-IN');
    document.getElementById('s-month-label').textContent    = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    document.getElementById('s-pending-amt').textContent    = '₹' + pendingAmt.toLocaleString('en-IN');
    document.getElementById('s-pending-count').textContent  = pending.length + ' entr' + (pending.length === 1 ? 'y' : 'ies');
    document.getElementById('s-total-entries').textContent  = all.length;
    document.getElementById('s-alltime-total').textContent  = '₹' + allTime.toLocaleString('en-IN');
  }

  // ── Render Table ───────────────────────────────────────────────────────
  function getFilteredExpenses() {
    const month  = document.getElementById('f-month').value;
    const year   = document.getElementById('f-year').value;
    const search = document.getElementById('f-search').value.trim().toLowerCase();
    const status = document.getElementById('f-status').value;

    return getExpenses().filter(e => {
      if (month  && (e.date || '').slice(5, 7) !== month) return false;
      if (year   && (e.date || '').slice(0, 4) !== year)  return false;
      if (status && e.status !== status) return false;
      if (search && !((e.vendor || '') + (e.material || '') + (e.notes || '')).toLowerCase().includes(search)) return false;
      return true;
    });
  }

  function renderExpenses() {
    const expenses = getFilteredExpenses();
    const tbody    = document.getElementById('exp-table-body');

    if (!expenses.length) {
      tbody.innerHTML = '<tr><td colspan="13" class="no-exp">No expenses match the current filters.</td></tr>';
      return;
    }

    const filteredTotal = expenses.reduce((s, e) => s + (e.total || 0), 0);

    const statusBadge = s => {
      if (s === 'Paid')    return '<span class="badge-paid">Paid</span>';
      if (s === 'Credit')  return '<span class="badge-credit">Credit</span>';
      return '<span class="badge-pending">Pending</span>';
    };

    tbody.innerHTML = expenses.map(e =>
      `<tr>
        <td style="font-family:monospace;font-size:0.78rem;color:var(--text-muted)">${e.id}</td>
        <td style="white-space:nowrap">${fmtDate(e.date)}</td>
        <td style="font-weight:600">${e.vendor || '—'}</td>
        <td style="color:var(--text-muted)">${e.vendorPhone || '—'}</td>
        <td>${e.material || '—'}</td>
        <td style="text-align:right">${e.qty != null ? Number(e.qty).toLocaleString('en-IN') : '—'}</td>
        <td style="color:var(--text-muted)">${e.unit || '—'}</td>
        <td style="text-align:right">₹${(e.pricePerUnit || 0).toLocaleString('en-IN')}</td>
        <td class="amount-cell">₹${(e.total || 0).toLocaleString('en-IN')}</td>
        <td>${e.paymentMethod || '—'}</td>
        <td>${statusBadge(e.status)}</td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted);font-size:0.82rem" title="${e.notes || ''}">${e.notes || '—'}</td>
        <td><div class="action-btns">
          <button class="btn-icon" onclick="openEditExpense('${e.id}')" title="Edit">✏️</button>
          <button class="btn-icon danger" onclick="deleteExpense('${e.id}')" title="Delete">🗑️</button>
        </div></td>
      </tr>`
    ).join('') +
    `<tr class="total-row">
      <td colspan="8" style="text-align:right;padding-right:0.8rem;color:var(--text-muted)">Filtered Total:</td>
      <td class="amount-cell" style="font-size:0.95rem">₹${filteredTotal.toLocaleString('en-IN')}</td>
      <td colspan="4"></td>
    </tr>`;
  }

  // ── Modal ──────────────────────────────────────────────────────────────
  function populateVendorSuggestions() {
    const vendors = [...new Set(getExpenses().map(e => e.vendor).filter(Boolean))];
    document.getElementById('vendor-suggestions').innerHTML = vendors.map(v => `<option value="${v}">`).join('');
  }

  function openAddExpense() {
    _editExpId = null;
    document.getElementById('exp-modal-title').textContent = 'Add Expense';
    document.getElementById('ef-date').value         = todayStr();
    document.getElementById('ef-status').value       = 'Paid';
    document.getElementById('ef-vendor').value       = '';
    document.getElementById('ef-vendor-phone').value = '';
    document.getElementById('ef-material').value     = '';
    document.getElementById('ef-payment').value      = 'Cash';
    document.getElementById('ef-qty').value          = '';
    document.getElementById('ef-unit').value         = '';
    document.getElementById('ef-price').value        = '';
    document.getElementById('ef-notes').value        = '';
    document.getElementById('ef-total-display').textContent = '₹0';
    document.getElementById('exp-modal-error').style.display = 'none';
    populateVendorSuggestions();
    document.getElementById('exp-modal').classList.add('active');
  }

  function openEditExpense(id) {
    const exp = getExpenses().find(e => e.id === id);
    if (!exp) return;
    _editExpId = id;
    document.getElementById('exp-modal-title').textContent   = 'Edit Expense';
    document.getElementById('ef-date').value         = exp.date || todayStr();
    document.getElementById('ef-status').value       = exp.status || 'Paid';
    document.getElementById('ef-vendor').value       = exp.vendor || '';
    document.getElementById('ef-vendor-phone').value = exp.vendorPhone || '';
    document.getElementById('ef-material').value     = exp.material || '';
    document.getElementById('ef-payment').value      = exp.paymentMethod || 'Cash';
    document.getElementById('ef-qty').value          = exp.qty != null ? exp.qty : '';
    document.getElementById('ef-unit').value         = exp.unit || '';
    document.getElementById('ef-price').value        = exp.pricePerUnit || '';
    document.getElementById('ef-notes').value        = exp.notes || '';
    document.getElementById('ef-total-display').textContent = '₹' + (exp.total || 0).toLocaleString('en-IN');
    document.getElementById('exp-modal-error').style.display = 'none';
    populateVendorSuggestions();
    document.getElementById('exp-modal').classList.add('active');
  }

  function closeExpModal() {
    document.getElementById('exp-modal').classList.remove('active');
  }

  function saveExpense() {
    const date     = document.getElementById('ef-date').value;
    const vendor   = document.getElementById('ef-vendor').value.trim();
    const material = document.getElementById('ef-material').value.trim();
    const qty      = parseFloat(document.getElementById('ef-qty').value);
    const price    = parseFloat(document.getElementById('ef-price').value);
    const errEl    = document.getElementById('exp-modal-error');
    errEl.style.display = 'none';

    if (!date)     { errEl.textContent = 'Date is required.'; errEl.style.display = 'block'; return; }
    if (!vendor)   { errEl.textContent = 'Vendor name is required.'; errEl.style.display = 'block'; return; }
    if (!material) { errEl.textContent = 'Material / item is required.'; errEl.style.display = 'block'; return; }
    if (isNaN(qty) || qty <= 0) { errEl.textContent = 'Enter a valid quantity.'; errEl.style.display = 'block'; return; }
    if (isNaN(price) || price < 0) { errEl.textContent = 'Enter a valid price.'; errEl.style.display = 'block'; return; }

    const record = {
      date,
      vendor,
      vendorPhone:   document.getElementById('ef-vendor-phone').value.trim(),
      material,
      qty,
      unit:          document.getElementById('ef-unit').value.trim(),
      pricePerUnit:  price,
      total:         Math.round(qty * price * 100) / 100,
      paymentMethod: document.getElementById('ef-payment').value,
      status:        document.getElementById('ef-status').value,
      notes:         document.getElementById('ef-notes').value.trim()
    };

    const expenses = getExpenses();
    if (_editExpId) {
      const idx = expenses.findIndex(e => e.id === _editExpId);
      if (idx !== -1) expenses[idx] = { ...expenses[idx], ...record };
      showToast('Expense updated.', 'success');
    } else {
      expenses.unshift({ id: generateExpenseId(), ...record });
      showToast('Expense added.', 'success');
    }

    saveExpenses(expenses);
    closeExpModal();
    renderExpenses();
    refreshSummary();
  }

  function deleteExpense(id) {
    const exp = getExpenses().find(e => e.id === id);
    if (!exp) return;
    if (!confirm(`Delete expense: ${exp.material} from ${exp.vendor} (₹${(exp.total || 0).toLocaleString('en-IN')})?`)) return;
    saveExpenses(getExpenses().filter(e => e.id !== id));
    showToast('Expense deleted.', 'info');
    renderExpenses();
    refreshSummary();
  }

  // ── Year selector ──────────────────────────────────────────────────────
  function initYearFilter() {
    const sel = document.getElementById('f-year');
    const now = new Date().getFullYear();
    for (let y = now; y >= now - 4; y--) sel.add(new Option(y, y));
    sel.value = now;
  }

  // ── Default month filter to current month ─────────────────────────────
  function initMonthFilter() {
    const mm = String(new Date().getMonth() + 1).padStart(2, '0');
    document.getElementById('f-month').value = mm;
  }

  document.getElementById('exp-modal').addEventListener('click', function(e) {
    if (e.target === this) closeExpModal();
  });

  document.getElementById('f-month').addEventListener('change', renderExpenses);
  document.getElementById('f-year').addEventListener('change', renderExpenses);

  // ── Init (after Sheets sync so data is fresh) ──────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof syncFromSheets === 'function') { try { await syncFromSheets(); } catch (_) {} }
    initYearFilter();
    initMonthFilter();
    refreshSummary();
    renderExpenses();
  });
