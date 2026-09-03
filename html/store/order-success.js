    let _currentOrder = null;

    // Locate the order from local storage only (no network).
    function findOrderLocal(urlId) {
      const last = Store.get('bm_last_order');
      // bm_last_order is the order that was just placed on THIS device — trust it
      // when it matches (or when there's no id in the URL at all).
      if (last && (!urlId || last.id === urlId)) return last;
      if (urlId) {
        const found = (getOrders() || []).find(o => o.id === urlId);
        if (found) return found;
      }
      return last || null;
    }

    async function initSuccessPage() {
      try {
        const urlId = new URLSearchParams(window.location.search).get('id');

        // 1. Try local data FIRST — instant, and guaranteed on the device that just
        //    checked out (bm_last_order). Never blocks on the network here.
        let order = findOrderLocal(urlId);
        console.log('[order-success] urlId =', urlId, '| found locally =', order ? order.id : 'NONE',
          '| bm_last_order =', Store.get('bm_last_order') ? 'present' : 'missing');

        // 2. Only if not found locally (e.g. opened on another device / fresh browser)
        //    pull from Google Sheets, then look again.
        if (!order && typeof syncFromSheets === 'function') {
          try { await syncFromSheets(); } catch (_) {}
          order = findOrderLocal(urlId);
        }

        if (!order) {
          document.getElementById('order-details').innerHTML =
            '<p style="text-align:center;padding:1.5rem;color:var(--text-muted)">Session expired — please <a href="index.html" style="color:var(--primary)">place a new order</a>.</p>';
          return;
        }

        renderOrder(order);
      } catch (err) {
        console.error('order-success error:', err);
        const det = document.getElementById('order-details');
        if (det) det.innerHTML =
          '<p style="text-align:center;padding:1.5rem;color:var(--danger,#e74c3c)">⚠️ Could not load order: ' +
          err.message + '</p>';
      }
    }

    function renderOrder(order) {
        _currentOrder = order;

        const c = order.customer || {};
        document.getElementById('success-order-id').textContent = order.id || '—';
        document.getElementById('success-name').textContent = c.name || '—';
        document.getElementById('success-phone').textContent = c.phone || '—';
        document.getElementById('success-address').textContent =
          [c.address, c.village, c.district, c.pin].filter(Boolean).join(', ') || '—';
        document.getElementById('success-payment').textContent = c.paymentMethod || '—';

        // Labour charge row
        if (order.labour > 0) {
          const labourRow = document.getElementById('success-labour-row');
          if (labourRow) labourRow.style.display = 'flex';
          document.getElementById('success-labour').textContent = formatRupees(order.labour);
        }

        document.getElementById('success-total').textContent = formatRupees(order.total || 0);

        // deliveryDate may be a YYYY-MM-DD value (date input) or an already-formatted
        // string like "8 September 2026". Only re-format the former.
        let deliveryText = getEstimatedDelivery(5);
        if (c.deliveryDate) {
          if (/^\d{4}-\d{2}-\d{2}/.test(c.deliveryDate)) {
            deliveryText = new Date(c.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
          } else {
            deliveryText = c.deliveryDate;
          }
        }
        document.getElementById('success-delivery').textContent = deliveryText;

        // Items list
        const itemsEl = document.getElementById('success-items');
        if (itemsEl && order.items && order.items.length > 0) {
          itemsEl.innerHTML =
            '<div style="background:var(--bg);border-radius:var(--radius-sm);padding:1rem;border:1px solid var(--border)">' +
            '<div style="font-weight:700;margin-bottom:0.8rem;font-size:0.9rem;color:var(--text-muted)">ITEMS ORDERED</div>' +
            order.items.map(item =>
              '<div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid var(--border);font-size:0.9rem">' +
              '<span>' + item.name + ' × ' + item.qty + '</span>' +
              '<strong style="color:var(--primary)">' + formatRupees(item.total || 0) + '</strong></div>'
            ).join('') + '</div>';
        }

        // Track My Order button — scroll to order details on this page
        const trackBtn = document.getElementById('track-btn');
        if (trackBtn) {
          trackBtn.href = '#order-details';
          trackBtn.onclick = function (e) {
            e.preventDefault();
            document.getElementById('order-details').scrollIntoView({ behavior: 'smooth', block: 'start' });
          };
        }

        // Wire action buttons here (after the order is loaded) so they always work,
        // regardless of when the DOMContentLoaded event fired.
        const waBtn = document.getElementById('wa-btn');
        if (waBtn) waBtn.onclick = sendOrderWhatsApp;

        // Contact bar
        const s = getSettings();
        const contactBar = document.getElementById('success-contact-bar');
        if (contactBar) {
          contactBar.innerHTML = '📞 Questions? Call us at <strong style="color:var(--primary)">' + s.phone1 +
            '</strong> or <a href="https://wa.me/' + s.whatsapp + '" style="color:var(--primary)">WhatsApp us</a>';
        }
    }

    // Run after DOM is fully ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSuccessPage);
    } else {
      initSuccessPage();
    }

    function sendOrderWhatsApp() {
      const order = _currentOrder;
      if (!order) { alert('Order details not available. Please refresh the page.'); return; }
      const s = getSettings();
      const c = order.customer || {};
      const itemLines = (order.items || []).map(i =>
        '  • ' + i.name + ' × ' + i.qty + ' — ₹' + (i.total || 0).toLocaleString('en-IN')
      ).join('\n');
      const deliveryLine = order.delivery === 0 ? 'Free 🎉' : '₹' + (order.delivery || 299).toLocaleString('en-IN');
      const labourLine = order.labour > 0 ? '\nLabour (Loading/Unloading): ₹' + order.labour.toLocaleString('en-IN') : '';
      const address = [c.address, c.village, c.district, c.pin].filter(Boolean).join(', ');
      const msg = '🧱 *' + s.storeName + ' — Order Received!* 📦\n\n' +
        'Hello *' + c.name + '*! Thank you for your order. Here are your details:\n\n' +
        '📋 *Order ID:* ' + order.id + '\n' +
        '📅 *Date:* ' + new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) + '\n\n' +
        '🛒 *Items Ordered*\n' + itemLines + '\n\n' +
        '💰 *Order Summary*\n' +
        'Subtotal: ₹' + (order.subtotal || order.total || 0).toLocaleString('en-IN') + '\n' +
        'Delivery: ' + deliveryLine + labourLine + '\n' +
        '*Total: ₹' + (order.total || 0).toLocaleString('en-IN') + '*\n' +
        'Payment: ' + (c.paymentMethod || 'N/A') + '\n\n' +
        '📍 *Delivery Address*\n' + address + '\n\n' +
        '⏰ Estimated delivery: *3–5 working days*\nWe will call you before delivery.\n\n' +
        'For queries: *' + s.phone1 + '*\n\n' +
        '_Thank you for choosing ' + s.storeName + '! 🙏_';

      const phone = (c.phone || '').replace(/\D/g, '');
      const waPhone = phone.startsWith('91') ? phone : '91' + phone.replace(/^0+/, '');
      window.open('https://wa.me/' + waPhone + '?text=' + encodeURIComponent(msg), '_blank');
    }

    function printOrderReceipt() {
      const order = _currentOrder;
      if (!order) { alert('Order details not available. Please refresh the page.'); return; }
      const s = getSettings();
      const c = order.customer || {};
      const w = window.open('', '_blank', 'width=600,height=800');
      if (!w) { alert('Please allow pop-ups to print the receipt.'); return; }
      w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ' + order.id + '</title>' +
        '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:2rem;font-size:0.9rem;color:#333}' +
        'h2{color:#e65c00;margin-bottom:0.3rem}table{width:100%;border-collapse:collapse;margin:1rem 0}' +
        'td,th{padding:0.5rem;border:1px solid #ddd;text-align:left}th{background:#f5f5f5}' +
        '.total{font-weight:700;font-size:1rem}.footer{margin-top:1.5rem;text-align:center;font-size:0.8rem;color:#888}' +
        '@media print{body{padding:1rem}}</style></head><body>' +
        '<div style="text-align:center;margin-bottom:1.5rem">' +
        '<div style="font-size:1.5rem;font-weight:800;color:#e65c00">🧱 ' + s.storeName + '</div>' +
        '<div style="color:#666">' + s.address + ', ' + s.city + '</div>' +
        '<div style="color:#666">' + s.phone1 + '</div>' +
        '<h2 style="margin-top:1rem">Order Receipt</h2>' +
        '<div style="font-weight:700;color:#e65c00">' + order.id + '</div>' +
        '<div style="color:#888">' + new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) + '</div>' +
        '</div>' +
        '<div style="background:#f8f8f8;padding:1rem;border-radius:6px;margin-bottom:1rem">' +
        '<strong>' + c.name + '</strong><br>' + c.phone + '<br>' +
        c.address + ', ' + c.village + '<br>' + c.district + ' — ' + c.pin + '<br>' +
        'Payment: ' + c.paymentMethod + '</div>' +
        '<table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>' +
        (order.items || []).map(i =>
          '<tr><td>' + i.name + '</td><td>' + i.qty + '</td><td>₹' +
          (i.price || 0).toLocaleString('en-IN') + '</td><td>₹' + (i.total || 0).toLocaleString('en-IN') + '</td></tr>'
        ).join('') +
        '</tbody></table>' +
        '<div style="text-align:right;padding:0.5rem">' +
        '<div>Subtotal: ₹' + (order.subtotal || order.total || 0).toLocaleString('en-IN') + '</div>' +
        '<div>Delivery: ' + (order.delivery === 0 ? 'Free' : '₹' + (order.delivery || 299).toLocaleString('en-IN')) + '</div>' +
        (order.labour > 0 ? '<div>Labour (Loading/Unloading): ₹' + order.labour.toLocaleString('en-IN') + '</div>' : '') +
        '<div class="total" style="color:#e65c00;font-size:1.1rem;margin-top:0.3rem">Total: ₹' + (order.total || 0).toLocaleString('en-IN') + '</div></div>' +
        '<div class="footer">Thank you for choosing ' + s.storeName + '! | ' + s.phone1 + '</div>' +
        '<script>window.onload=function(){window.print()}<\/script>' +
        '<\/body><\/html>');
      w.document.close();
    }
