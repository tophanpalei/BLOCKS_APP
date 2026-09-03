  function filterOrdersByRange(orders) {
    const from = document.getElementById('dash-date-from')?.value || '';
    const to   = document.getElementById('dash-date-to')?.value   || '';
    if (!from && !to) return orders;
    return orders.filter(o => {
      const d = new Date(o.date);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (from && ds < from) return false;
      if (to   && ds > to)   return false;
      return true;
    });
  }

  function refreshDashboard() {
    const from = document.getElementById('dash-date-from')?.value || '';
    const to   = document.getElementById('dash-date-to')?.value   || '';
    const all  = getOrders();
    const orders = filterOrdersByRange(all);

    const label = document.getElementById('dash-filter-label');
    if (label) {
      if (from && to)  label.textContent = `Showing ${from} → ${to}`;
      else if (from)   label.textContent = `From ${from}`;
      else if (to)     label.textContent = `Up to ${to}`;
      else             label.textContent = '';
    }

    const sub = (from || to) ? (from && to ? `${from} – ${to}` : from || to) : 'All time';

    document.getElementById('stat-total-orders').textContent  = orders.length;
    document.getElementById('stat-revenue').textContent       = formatRupees(orders.filter(o => o.status !== 'Cancelled').reduce((s,o) => s+o.total, 0));
    document.getElementById('stat-pending-orders').textContent= orders.filter(o => o.status === 'Pending').length;
    document.getElementById('stat-delivered').textContent     = orders.filter(o => o.status === 'Delivered').length;
    document.getElementById('stat-cancelled').textContent     = orders.filter(o => o.status === 'Cancelled').length;

    // Unique customers in range
    const phones = new Set(orders.map(o => o.customer.phone));
    document.getElementById('stat-customers').textContent = phones.size;

    // Today's orders (always relative to today, unaffected by range)
    const todayStr = new Date().toDateString();
    document.getElementById('stat-today').textContent = all.filter(o => new Date(o.date).toDateString() === todayStr).length;

    // Update sub-labels
    document.querySelectorAll('.stat-card').forEach(card => {
      const sub_el = card.querySelector('.stat-card-sub');
      const id = card.querySelector('.stat-card-val')?.id;
      if (sub_el && id && id !== 'stat-today' && id !== 'stat-total-products') {
        sub_el.textContent = sub;
      }
    });
  }

  function clearDashFilter() {
    document.getElementById('dash-date-from').value = '';
    document.getElementById('dash-date-to').value   = '';
    refreshDashboard();
  }

  function renderLowStockAlert() {
    const el = document.getElementById('low-stock-alert');
    if (!el) return;
    const LOW = 5;
    const products = getProducts();
    const low = products.filter(p => p.stock <= LOW);
    if (low.length === 0) { el.style.display = 'none'; return; }
    el.style.display = '';
    const outOf = low.filter(p => p.stock === 0);
    const lowStock = low.filter(p => p.stock > 0);
    el.innerHTML = `
      <div style="background:#fff3cd;border:1.5px solid #f39c12;border-radius:var(--radius);padding:1rem 1.2rem">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.8rem">
          <span style="font-size:1.1rem">⚠️</span>
          <strong style="color:#856404;font-size:0.9rem">Low Stock Alert — ${low.length} product${low.length!==1?'s':''} need attention</strong>
          <a href="products-admin.html" style="margin-left:auto;font-size:0.78rem;color:#856404;font-weight:700;text-decoration:underline">Manage →</a>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem">
          ${outOf.map(p => `<span style="background:#f8d7da;color:#721c24;padding:0.25rem 0.7rem;border-radius:20px;font-size:0.78rem;font-weight:700">❌ ${p.name} (Out of Stock)</span>`).join('')}
          ${lowStock.map(p => `<span style="background:#fff3cd;color:#856404;padding:0.25rem 0.7rem;border-radius:20px;font-size:0.78rem;border:1px solid #f39c12">⚠️ ${p.name} (${p.stock} left)</span>`).join('')}
        </div>
      </div>`;
  }

  document.addEventListener('DOMContentLoaded', () => { refreshDashboard(); renderLowStockAlert(); });
