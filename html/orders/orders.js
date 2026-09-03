  let currentStatusFilter = 'all';

  function applyFilters() {
    const orderId  = document.getElementById('filter-order-id')?.value.trim() || '';
    const customer = document.getElementById('filter-customer')?.value.trim() || '';
    const date     = document.getElementById('filter-date')?.value || '';
    const status   = document.getElementById('filter-status')?.value || '';
    const payment  = document.getElementById('filter-payment')?.value || '';
    renderAdminOrders({ orderId, customer, date, status, payment });
  }

  function filterByStatus(status, btn) {
    currentStatusFilter = status;
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const statusEl = document.getElementById('filter-status');
    if (statusEl) statusEl.value = status === 'all' ? '' : status;
    applyFilters();
  }

  function clearFilters() {
    ['filter-order-id','filter-customer','filter-date'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    ['filter-status','filter-payment'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    currentStatusFilter = 'all';
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.admin-tab').classList.add('active');
    renderAdminOrders({});
  }

  // Show sidebar toggle on mobile
  if (window.innerWidth < 768) {
    document.getElementById('sidebar-toggle').style.display = 'block';
  }

  function deleteSelectedOrders() {
    const ids = [...document.querySelectorAll('.order-checkbox:checked')].map(c => c.value);
    if (!ids.length) { showToast('No orders selected', 'warning'); return; }
    const orders = getOrders();
    const nonCancelled = ids.filter(id => {
      const o = orders.find(o => o.id === id);
      return o && o.status !== 'Cancelled';
    });
    if (nonCancelled.length > 0) {
      showToast(`Only cancelled orders can be deleted. ${nonCancelled.length} selected order(s) are not cancelled.`, 'error');
      return;
    }
    if (!confirmAction(`Permanently delete ${ids.length} selected cancelled order(s)? This cannot be undone.`)) return;
    saveOrders(orders.filter(o => !ids.includes(o.id)));
    showToast(`${ids.length} cancelled order(s) deleted`, 'success');
    if (typeof applyFilters === 'function') applyFilters(); else renderAdminOrders();
  }

  function toggleAllOrders(cb) {
    document.querySelectorAll('.order-checkbox').forEach(c => { c.checked = cb.checked; });
    updateBulkBar();
  }

  function updateBulkBar() {
    const checked = [...document.querySelectorAll('.order-checkbox:checked')];
    const bar = document.getElementById('bulk-action-bar');
    const countEl = document.getElementById('bulk-count');
    if (!bar) return;
    bar.style.display = checked.length > 0 ? 'flex' : 'none';
    if (countEl) countEl.textContent = `${checked.length} order${checked.length !== 1 ? 's' : ''} selected`;
  }

  function doBulkUpdate() {
    const ids = [...document.querySelectorAll('.order-checkbox:checked')].map(c => c.value);
    const status = document.getElementById('bulk-status-select').value;
    if (!status) { showToast('Please select a status to apply', 'warning'); return; }
    bulkUpdateStatusAdmin(ids, status);
  }

  function clearBulkSelection() {
    document.querySelectorAll('.order-checkbox').forEach(c => { c.checked = false; });
    const allCb = document.querySelector('thead input[type="checkbox"]');
    if (allCb) allCb.checked = false;
    const bar = document.getElementById('bulk-action-bar');
    if (bar) bar.style.display = 'none';
  }

  // ── Bulk WhatsApp Notify ───────────────────────────────────────────────
  function showBulkNotifyModal(orders, newStatus) {
    const s = getSettings();

    const listHtml = orders.map(o => {
      const c       = o.customer || {};
      const phone   = (c.phone || '').replace(/\D/g, '');
      const waPhone = phone.startsWith('91') ? phone : '91' + phone.replace(/^0+/, '');
      const msg     = buildOrderWhatsAppMsg(o, newStatus, s);
      const waUrl   = 'https://wa.me/' + waPhone + '?text=' + encodeURIComponent(msg);
      return '<div style="display:flex;justify-content:space-between;align-items:center;' +
        'padding:0.75rem 0;border-bottom:1px solid var(--border);gap:0.75rem">' +
        '<div>' +
          '<div style="font-weight:700;font-size:0.9rem">' + c.name + '</div>' +
          '<div style="font-size:0.78rem;color:var(--text-muted)">' + o.id + ' · ' + (c.phone || '—') + '</div>' +
        '</div>' +
        '<a href="' + waUrl + '" target="_blank" rel="noopener" ' +
          'style="flex-shrink:0;padding:0.45rem 1rem;background:#25D366;color:#fff;border-radius:8px;' +
          'text-decoration:none;font-size:0.82rem;font-weight:700;white-space:nowrap">' +
          '📲 Send WhatsApp' +
        '</a>' +
      '</div>';
    }).join('');

    document.getElementById('bulk-notify-list').innerHTML = listHtml;
    document.getElementById('bulk-notify-overlay').classList.add('active');
  }

  function closeBulkNotify() {
    document.getElementById('bulk-notify-overlay').classList.remove('active');
  }

  document.getElementById('bulk-notify-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeBulkNotify();
  });
