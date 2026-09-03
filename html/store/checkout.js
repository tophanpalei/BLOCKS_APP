  // ── MAP PICKER ────────────────────────────────────────────────────────────
  let _mapInstance = null, _mapMarker = null, _mapAddrData = null;

  function openMapPicker() {
    document.getElementById('map-modal').style.display = 'flex';
    // Delay init so browser renders the modal dimensions before Leaflet measures the container
    setTimeout(function () {
      const s = getSettings();
      const cLat = s.companyLat || 20.5937;
      const cLng = s.companyLng || 78.9629;

      if (!_mapInstance) {
        _mapInstance = L.map('map-picker').setView([cLat, cLng], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(_mapInstance);

        // Company marker (fixed)
        if (s.companyLat && s.companyLng) {
          L.marker([s.companyLat, s.companyLng], {
            icon: L.divIcon({ html: '🏭', className: '', iconSize: [28, 28], iconAnchor: [14, 14] })
          }).addTo(_mapInstance).bindPopup('Your Store');
        }

        _mapInstance.on('click', function (e) { _dropPin(e.latlng.lat, e.latlng.lng); });
      } else {
        _mapInstance.invalidateSize();
      }
    }, 80);
  }

  function _dropPin(lat, lng) {
    if (_mapMarker) {
      _mapMarker.setLatLng([lat, lng]);
    } else {
      _mapMarker = L.marker([lat, lng], { draggable: true }).addTo(_mapInstance);
      _mapMarker.on('dragend', function () {
        const p = _mapMarker.getLatLng();
        _reverseGeocodeMap(p.lat, p.lng);
      });
    }
    _reverseGeocodeMap(lat, lng);
  }

  async function _reverseGeocodeMap(lat, lng) {
    const preview = document.getElementById('map-addr-preview');
    const confirmBtn = document.getElementById('map-confirm-btn');
    if (preview) preview.textContent = '⏳ Getting address...';
    if (confirmBtn) confirmBtn.disabled = true;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`
      );
      const data = await res.json();
      const a = data.address || {};
      const label = [a.road, a.village || a.town || a.city, a.county || a.state_district, a.postcode]
        .filter(Boolean).join(', ');
      if (preview) preview.innerHTML = `<strong>📍 Delivery:</strong> ${label || data.display_name || 'Selected point'}`;
      _mapAddrData = { a, lat, lng };
    } catch {
      if (preview) preview.textContent = '⚠️ Address lookup failed — you can still confirm.';
      _mapAddrData = { a: {}, lat, lng };
    }
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.style.opacity = '1'; }
  }

  function confirmMapLocation() {
    if (!_mapAddrData) return;
    const { a, lat, lng } = _mapAddrData;

    // India-aware address mapping
    const road = [a.house_number, a.road, a.hamlet, a.quarter, a.suburb, a.neighbourhood]
      .filter(Boolean).join(', ');
    document.getElementById('co-address').value  = road || a.amenity || a.building || '';
    document.getElementById('co-village').value  =
      a.village || a.town || a.suburb || a.quarter || a.city_district || a.city || '';
    document.getElementById('co-district').value =
      a.state_district || a.district || a.county || a.city || '';
    document.getElementById('co-pin').value      =
      (a.postcode || '').replace(/\D/g, '').slice(0, 6);

    const s = getSettings();
    if (s.companyLat && s.companyLng) {
      _coDistanceKm = haversineKm(s.companyLat, s.companyLng, lat, lng);
      let distInfo = `📏 ${_coDistanceKm.toFixed(1)} km from store`;
      if (s.deliveryPerKm > 0) {
        _coDelivery = Math.round(_coDistanceKm * s.deliveryPerKm);
        distInfo += ` · Delivery ₹${_coDelivery}`;
      }
      if (s.labourPerItem > 0) {
        const totalQty = getCart().reduce((sum, i) => sum + i.qty, 0);
        _coLabour = Math.round(totalQty * s.labourPerItem);
        const labourRow = document.getElementById('co-labour-row');
        if (labourRow && _coLabour > 0) {
          labourRow.style.display = 'flex';
          document.getElementById('co-labour-amt').textContent = formatRupees(_coLabour);
          const cb = document.getElementById('co-labour-check');
          if (cb) cb.checked = true;
        }
        distInfo += ` · Labour ₹${_coLabour}`;
      }
      const info = document.getElementById('loc-info');
      if (info) { info.style.display = 'block'; info.textContent = distInfo; }
      recalcCheckoutTotal();
    }
    closeMapPicker();
    const _gm3 = document.getElementById('geocode-msg'); if (_gm3) _gm3.style.display = 'none';
    showToast(`Location confirmed! ~${_coDistanceKm.toFixed(1)} km from store.`, 'success');
  }

  function closeMapPicker() {
    document.getElementById('map-modal').style.display = 'none';
  }

  async function searchMapLocation() {
    const input = document.getElementById('map-search-input');
    const btn   = document.getElementById('map-search-btn');
    const query = input?.value.trim();
    if (!query || !_mapInstance) return;
    btn.textContent = '⏳'; btn.disabled = true; input.disabled = true;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=en`
      );
      const results = await res.json();
      if (!results || results.length === 0) {
        showToast('Location not found — try a different name.', 'warning');
      } else {
        const { lat, lon } = results[0];
        _mapInstance.flyTo([parseFloat(lat), parseFloat(lon)], 14);
        _dropPin(parseFloat(lat), parseFloat(lon));
      }
    } catch {
      showToast('Search failed — check your connection.', 'error');
    }
    btn.textContent = 'Search'; btn.disabled = false; input.disabled = false;
  }
  function selectPayment(radio) {
    document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
    radio.closest('.payment-option').classList.add('selected');
  }

  let _coSubtotal = 0, _coDelivery = 0, _coLabour = 0, _coDistanceKm = 0;

  function recalcCheckoutTotal() {
    const checked = document.getElementById('co-labour-check')?.checked;
    const labour = (checked && _coLabour > 0) ? _coLabour : 0;
    document.getElementById('co-subtotal').textContent = formatRupees(_coSubtotal);
    document.getElementById('co-delivery').innerHTML = _coDelivery === 0
      ? '<span style="color:var(--success)">Free</span>'
      : formatRupees(_coDelivery);
    document.getElementById('co-total').textContent = formatRupees(_coSubtotal + _coDelivery + labour);
  }

  function renderCheckoutSummary() {
    const cart = getCart();
    const products = getProducts();

    if (cart.length === 0) {
      document.getElementById('checkout-empty').style.display = 'block';
      document.getElementById('checkout-main').style.display = 'none';
      return;
    }

    // Set min delivery date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('co-delivery-date');
    if (dateInput) dateInput.min = tomorrow.toISOString().split('T')[0];

    const itemsList = document.getElementById('checkout-items-list');
    let subtotal = 0;
    let html = '';

    cart.forEach(item => {
      const product = products.find(p => p.id === item.id);
      if (!product) return;
      const total = product.price * item.qty;
      subtotal += total;
      html += `
        <div class="checkout-item">
          <div class="checkout-item-thumb">${product.emoji || '🧱'}</div>
          <div>
            <div class="checkout-item-name">${product.name}</div>
            <div class="checkout-item-qty">${item.qty} × ${formatRupees(product.price)}</div>
          </div>
          <div class="checkout-item-price">${formatRupees(total)}</div>
        </div>`;
    });

    itemsList.innerHTML = html;

    const s = getSettings();
    _coSubtotal = subtotal;
    _coDelivery = subtotal >= (s.freeDeliveryAbove || 5000) ? 0 : (s.deliveryCharge || 299);
    _coLabour   = s.labourCharge || 0;

    // Show labour row if configured
    const labourRow = document.getElementById('co-labour-row');
    if (labourRow) {
      if (_coLabour > 0) {
        labourRow.style.display = 'flex';
        document.getElementById('co-labour-amt').textContent = formatRupees(_coLabour);
      } else {
        labourRow.style.display = 'none';
      }
    }

    // Show distance-calculate button if distance pricing is configured
    const geocodeRow = document.getElementById('geocode-row');
    if (geocodeRow) {
      geocodeRow.style.display = (s.companyLat && s.companyLng && (s.deliveryPerKm || s.labourPerItem))
        ? 'block' : 'none';
    }

    recalcCheckoutTotal();
  }

  async function geocodeAddress() {
    const s = getSettings();
    if (!s.companyLat || !s.companyLng || (!s.deliveryPerKm && !s.labourPerItem)) return;

    const village  = document.getElementById('co-village')?.value.trim();
    const district = document.getElementById('co-district')?.value.trim();
    const pin      = document.getElementById('co-pin')?.value.trim();
    if (!village && !district && !pin) return;

    const btn = document.getElementById('geocode-btn');
    if (btn) { btn.textContent = '⏳ Finding location...'; btn.disabled = true; }

    try {
      const query = [village, district, pin, 'India'].filter(Boolean).join(', ');
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=en`
      );
      const results = await res.json();

      if (!results || results.length === 0) {
        if (btn) { btn.textContent = '📏 Calculate Delivery Distance & Charges from Address'; btn.disabled = false; }
        const msg = document.getElementById('geocode-msg');
        if (msg) {
          msg.style.display = 'block';
          msg.style.background = '#fdecea';
          msg.style.border = '1px solid #e74c3c';
          msg.style.color = '#c0392b';
          msg.innerHTML = '❌ Location not found from the address you entered. Please <button type="button" onclick="openMapPicker()" style="background:none;border:none;color:var(--primary);font-weight:700;cursor:pointer;font-size:inherit;text-decoration:underline;padding:0">pick your location on the 🗺️ Map</button> to set the delivery point.';
        }
        return;
      }

      const { lat, lon } = results[0];
      _coDistanceKm = haversineKm(s.companyLat, s.companyLng, parseFloat(lat), parseFloat(lon));

      let distInfo = `📏 ~${_coDistanceKm.toFixed(1)} km from store`;

      if (s.deliveryPerKm > 0) {
        _coDelivery = Math.round(_coDistanceKm * s.deliveryPerKm);
        distInfo += ` · Delivery ₹${_coDelivery}`;
      }
      if (s.labourPerItem > 0) {
        const totalQty = getCart().reduce((sum, i) => sum + i.qty, 0);
        _coLabour = Math.round(totalQty * s.labourPerItem);
        const labourRow = document.getElementById('co-labour-row');
        if (labourRow && _coLabour > 0) {
          labourRow.style.display = 'flex';
          document.getElementById('co-labour-amt').textContent = formatRupees(_coLabour);
          const cb = document.getElementById('co-labour-check');
          if (cb) cb.checked = true;
        }
        distInfo += ` · Labour ₹${_coLabour}`;
      }

      const info = document.getElementById('loc-info');
      if (info) { info.style.display = 'block'; info.textContent = distInfo; }

      recalcCheckoutTotal();
      const _gm = document.getElementById('geocode-msg'); if (_gm) _gm.style.display = 'none';
      if (btn) { btn.textContent = '✅ Distance Calculated'; btn.disabled = false; }
      showToast(`~${_coDistanceKm.toFixed(1)} km — charges updated!`, 'success');

    } catch (err) {
      if (btn) { btn.textContent = '📏 Calculate Delivery Distance & Charges from Address'; btn.disabled = false; }
      showToast('Could not calculate distance. Charges unchanged.', 'warning');
    }
  }

  function placeOrder() {
    const name = document.getElementById('co-name').value.trim();
    const phone = document.getElementById('co-phone').value.trim();
    const address = document.getElementById('co-address').value.trim();
    const village = document.getElementById('co-village').value.trim();
    const district = document.getElementById('co-district').value.trim();
    const pin = document.getElementById('co-pin').value.trim();
    const deliveryDate = document.getElementById('co-delivery-date').value;
    const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'Cash on Delivery';

    if (!name || !phone || !address || !village || !district || !pin) {
      showToast('Please fill all required fields', 'error');
      return;
    }
    if (!/^[0-9]{10}$/.test(phone)) {
      showToast('Please enter a valid 10-digit phone number', 'error');
      return;
    }
    if (!/^[0-9]{6}$/.test(pin)) {
      showToast('Please enter a valid 6-digit PIN code', 'error');
      return;
    }

    const cart = getCart();
    if (cart.length === 0) {
      showToast('Your cart is empty', 'error');
      return;
    }

    // Require distance calculation when distance pricing is configured
    const _s = getSettings();
    if (_s.companyLat && _s.companyLng && (_s.deliveryPerKm || _s.labourPerItem) && _coDistanceKm === 0) {
      const msg = document.getElementById('geocode-msg');
      if (msg) {
        msg.style.display = 'block';
        msg.style.background = '#fff3cd';
        msg.style.border = '1px solid #ffc107';
        msg.style.color = '#856404';
        msg.innerHTML = '⚠️ Please click <strong>📏 Calculate Delivery Distance &amp; Charges</strong> above, or use <strong>📍 GPS</strong> / <strong>🗺️ Map</strong> to set your delivery location before placing the order.';
        msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const labourCheck = document.getElementById('co-labour-check');
    const labour = (labourCheck && labourCheck.checked && _coLabour > 0) ? _coLabour : 0;

    const customerInfo = {
      name, phone, address, village, district, pin,
      deliveryDate: deliveryDate || getEstimatedDelivery(5),
      paymentMethod,
      labour,
      distanceKm: _coDistanceKm || 0
    };

    showSpinner('Processing your order...');

    setTimeout(() => {
      const order = createOrder(customerInfo, cart);
      clearCart();
      hideSpinner();

      // Store latest order ID for success page
      Store.set('bm_last_order', order);
      window.location.href = 'order-success.html?id=' + encodeURIComponent(order.id);
    }, 1500);
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function useMyLocation() {
    const btn = document.getElementById('loc-btn');
    const info = document.getElementById('loc-info');
    btn.textContent = '⏳ Getting location...';
    btn.disabled = true;

    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000 })
      );
      const { latitude: lat, longitude: lng } = pos.coords;

      // Reverse geocode via Nominatim (free, no key needed)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      const a = data.address || {};

      // Fill address fields
      const road = [a.house_number, a.road, a.hamlet, a.quarter, a.suburb, a.neighbourhood].filter(Boolean).join(', ');
      document.getElementById('co-address').value  = road || a.amenity || a.building || '';
      document.getElementById('co-village').value  = a.village || a.town || a.suburb || a.quarter || a.city_district || a.city || '';
      document.getElementById('co-district').value = a.state_district || a.district || a.county || a.city || '';
      document.getElementById('co-pin').value      = (a.postcode || '').replace(/\D/g, '').slice(0, 6);

      // Distance & auto-pricing
      const s = getSettings();
      let distInfo = '';

      if (s.companyLat && s.companyLng) {
        _coDistanceKm = haversineKm(s.companyLat, s.companyLng, lat, lng);
        distInfo = `📏 ${_coDistanceKm.toFixed(1)} km from store`;

        if (s.deliveryPerKm > 0) {
          _coDelivery = Math.round(_coDistanceKm * s.deliveryPerKm);
          distInfo += ` · Delivery ₹${_coDelivery}`;
        }
        if (s.labourPerItem > 0) {
          const totalQty = getCart().reduce((sum, i) => sum + i.qty, 0);
          _coLabour = Math.round(totalQty * s.labourPerItem);
          const labourRow = document.getElementById('co-labour-row');
          if (labourRow && _coLabour > 0) {
            labourRow.style.display = 'flex';
            document.getElementById('co-labour-amt').textContent = formatRupees(_coLabour);
            // ensure checkbox is checked
            const cb = document.getElementById('co-labour-check');
            if (cb) cb.checked = true;
          }
          distInfo += ` · Labour ₹${_coLabour}`;
        }

        recalcCheckoutTotal();
      }

      if (info) {
        info.style.display = 'block';
        info.textContent = distInfo || '📍 Location detected — please verify your address';
      }

      btn.textContent = '✅ Location Detected';
      const _gm2 = document.getElementById('geocode-msg'); if (_gm2) _gm2.style.display = 'none';
      showToast('Address filled! Verify details and adjust if needed.', 'success');

    } catch (err) {
      btn.textContent = '📍 Auto-fill Address from My Location';
      btn.disabled = false;
      const msg = err.code === 1
        ? 'Location permission denied. Please allow access and try again.'
        : 'Could not get location. Please enter address manually.';
      showToast(msg, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', renderCheckoutSummary);
