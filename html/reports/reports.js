  const PIE_COLORS = ['#e65c00','#f39c12','#27ae60','#2980b9','#8e44ad','#e74c3c','#16a085','#d35400'];

  let _charts = {};

  function showEmpty(canvasId, empty) {
    const canvas = document.getElementById(canvasId);
    const msg = document.getElementById(canvasId + '-empty');
    if (canvas) canvas.style.display = empty ? 'none' : '';
    if (msg)   msg.style.display   = empty ? '' : 'none';
  }

  function destroyChart(id) {
    if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
  }

  function renderPie(canvasId, dataObj, labelFormatter) {
    destroyChart(canvasId);
    const labels = Object.keys(dataObj);
    const values = Object.values(dataObj);
    if (labels.length === 0) { showEmpty(canvasId, true); return; }
    showEmpty(canvasId, false);
    _charts[canvasId] = new Chart(document.getElementById(canvasId), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: PIE_COLORS.slice(0, labels.length),
          borderWidth: 3,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card-bg') || '#fff'
        }]
      },
      options: {
        responsive: true,
        cutout: '55%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 14, font: { size: 12, family: 'inherit' }, color: '#666' } },
          tooltip: { callbacks: { label: ctx => ' ' + ctx.label + ': ' + labelFormatter(ctx.parsed) } }
        }
      }
    });
  }

  function renderPieCharts() {
    const selectedProduct = document.getElementById('product-filter')?.value || '';
    const dateFrom        = document.getElementById('revenue-date-from')?.value || '';
    const dateTo          = document.getElementById('revenue-date-to')?.value || '';
    const allOrders = getOrders();

    const orders = allOrders.filter(o => {
      if (o.status === 'Cancelled') return false;
      if (selectedProduct && !o.items.some(i => i.name === selectedProduct)) return false;
      if (dateFrom || dateTo) {
        const d = new Date(o.date);
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (dateFrom && ds < dateFrom) return false;
        if (dateTo   && ds > dateTo)   return false;
      }
      return true;
    });

    function getRevenue(order) {
      if (!selectedProduct) return order.total;
      return order.items.filter(i => i.name === selectedProduct).reduce((s, i) => s + i.total, 0);
    }

    // 1. Doughnut — Revenue by Payment Method
    const byPayment = {};
    orders.forEach(o => {
      const m = o.customer?.paymentMethod || o.paymentMethod || 'Unknown';
      byPayment[m] = (byPayment[m] || 0) + getRevenue(o);
    });
    renderPie('payment-pie', byPayment, v => '₹' + v.toLocaleString('en-IN'));

    // Update line chart title
    const titleEl = document.getElementById('line-chart-title');
    if (titleEl) {
      if (dateFrom && dateTo) titleEl.textContent = `Revenue Trend (${dateFrom} → ${dateTo})`;
      else if (dateFrom)      titleEl.textContent = `Revenue Trend (From ${dateFrom})`;
      else if (dateTo)        titleEl.textContent = `Revenue Trend (Up to ${dateTo})`;
      else                    titleEl.textContent = 'Revenue Trend';
    }

    // 2. Line — day range from filtered orders (same data as other charts)
    const days = [], dayRevenue = [];
    if (orders.length > 0) {
      const timestamps = orders.map(o => new Date(o.date).setHours(0,0,0,0));
      const start = new Date(Math.min(...timestamps));
      const end   = new Date(Math.max(...timestamps));
      const cur   = new Date(start);
      while (cur <= end) {
        days.push(new Date(cur).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
        dayRevenue.push(
          orders.filter(o => new Date(o.date).toDateString() === cur.toDateString())
                .reduce((s, o) => s + getRevenue(o), 0)
        );
        cur.setDate(cur.getDate() + 1);
      }
    }
    destroyChart('revenue-line');
    const hasLineData = dayRevenue.some(v => v > 0);
    showEmpty('revenue-line', !hasLineData);
    if (hasLineData) {
      _charts['revenue-line'] = new Chart(document.getElementById('revenue-line'), {
        type: 'line',
        data: {
          labels: days,
          datasets: [{ label: 'Revenue (₹)', data: dayRevenue, borderColor: '#e65c00',
            backgroundColor: 'rgba(230,92,0,0.1)', borderWidth: 2.5, pointRadius: 4,
            pointBackgroundColor: '#e65c00', fill: true, tension: 0.35 }]
        },
        options: {
          responsive: true, plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { font: { size: 11 }, maxRotation: 45 } },
            y: { ticks: { font: { size: 11 }, callback: v => '₹' + v.toLocaleString('en-IN') } }
          }
        }
      });
    }

    // 3. Bar — Products revenue
    const byProduct = {};
    allOrders.filter(o => o.status !== 'Cancelled').forEach(o => {
      o.items.forEach(i => {
        if (selectedProduct && i.name !== selectedProduct) return;
        byProduct[i.name] = (byProduct[i.name] || 0) + i.total;
      });
    });
    const sorted = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 6);
    destroyChart('products-bar');
    showEmpty('products-bar', sorted.length === 0);
    if (sorted.length > 0) {
      _charts['products-bar'] = new Chart(document.getElementById('products-bar'), {
        type: 'bar',
        data: {
          labels: sorted.map(([n]) => n),
          datasets: [{ label: 'Revenue (₹)', data: sorted.map(([, v]) => v),
            backgroundColor: PIE_COLORS.slice(0, sorted.length), borderRadius: 6, borderSkipped: false }]
        },
        options: {
          responsive: true, plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { font: { size: 11 } } },
            y: { ticks: { font: { size: 11 }, callback: v => '₹' + v.toLocaleString('en-IN') } }
          }
        }
      });
    }
  }

  function clearRevenueFilters() {
    ['product-filter','revenue-date-from','revenue-date-to'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    renderPieCharts();
  }

  function refreshReportStats() {
    const from = document.getElementById('report-date-from')?.value || '';
    const to   = document.getElementById('report-date-to')?.value   || '';
    const all  = getOrders();

    const orders = all.filter(o => {
      const d = new Date(o.date);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (from && ds < from) return false;
      if (to   && ds > to)   return false;
      return true;
    });

    const label = document.getElementById('report-date-label');
    if (label) {
      if (from && to) label.textContent = `${from} → ${to}`;
      else if (from)  label.textContent = `From ${from}`;
      else if (to)    label.textContent = `Up to ${to}`;
      else            label.textContent = '';
    }

    const active = orders.filter(o => o.status !== 'Cancelled');
    const totalRevenue = active.reduce((s, o) => s + o.total, 0);
    const todayStr     = new Date().toDateString();
    const todayOrders  = all.filter(o => new Date(o.date).toDateString() === todayStr);
    const todayRevenue = todayOrders.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + o.total, 0);

    document.getElementById('report-total-orders').textContent  = orders.length;
    document.getElementById('report-total-revenue').textContent = formatRupees(totalRevenue);
    document.getElementById('report-today-orders').textContent  = todayOrders.length;
    document.getElementById('report-today-revenue').textContent = formatRupees(todayRevenue);
    document.getElementById('report-products').textContent      = getProducts().length;
    document.getElementById('report-customers').textContent     = new Set(orders.map(o => o.customer.phone)).size;

    // Also sync the revenue-date filters with the pie/line/bar charts
    const df = document.getElementById('revenue-date-from');
    const dt = document.getElementById('revenue-date-to');
    if (df) df.value = from;
    if (dt) dt.value = to;
    renderPieCharts();
  }

  function clearReportDateFilter() {
    document.getElementById('report-date-from').value = '';
    document.getElementById('report-date-to').value   = '';
    refreshReportStats();
  }

  function populateProductFilter() {
    const sel = document.getElementById('product-filter');
    if (!sel) return;
    getProducts().forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.name; opt.textContent = p.name;
      sel.appendChild(opt);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      refreshReportStats();
      populateProductFilter();
      renderPieCharts();
    }, 300);
  });
