  // ── Logo Upload ───────────────────────────────────────────────────────────
  function handleLogoUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) {
      showToast('Logo too large — max 1 MB', 'error'); input.value = ''; return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const MAX = 300;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png');
        document.getElementById('s-logo-data').value = dataUrl;
        document.getElementById('logo-img-thumb').src = dataUrl;
        document.getElementById('logo-img-thumb').style.display = 'block';
        document.getElementById('logo-emoji-ph').style.display = 'none';
        document.getElementById('logo-remove-btn').style.display = 'inline-block';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    document.getElementById('s-logo-data').value = '';
    document.getElementById('logo-file-input').value = '';
    document.getElementById('logo-img-thumb').src = '';
    document.getElementById('logo-img-thumb').style.display = 'none';
    document.getElementById('logo-emoji-ph').style.display = 'block';
    document.getElementById('logo-remove-btn').style.display = 'none';
  }

  function changeAdminPassword() {
    const current = document.getElementById('cp-current').value;
    const newPwd  = document.getElementById('cp-new').value.trim();
    const confirm = document.getElementById('cp-confirm').value;

    const creds = getAdminCredentials();
    if (current !== creds.password) {
      showToast('Current password is incorrect', 'error'); return;
    }
    if (newPwd.length < 6) {
      showToast('New password must be at least 6 characters', 'warning'); return;
    }
    if (newPwd !== confirm) {
      showToast('New passwords do not match', 'error'); return;
    }

    Store.set('bm_admin_creds', { username: creds.username, password: newPwd });
    document.getElementById('cp-current').value = '';
    document.getElementById('cp-new').value     = '';
    document.getElementById('cp-confirm').value = '';
    showToast('Password updated successfully!', 'success');
  }

  function loadSettingsIntoForm() {
    const s = getSettings();
    document.getElementById('s-phone1').value        = s.phone1;
    document.getElementById('s-phone2').value        = s.phone2;
    document.getElementById('s-email1').value        = s.email1;
    document.getElementById('s-email2').value        = s.email2;
    document.getElementById('s-address').value       = s.address;
    document.getElementById('s-city').value          = s.city;
    document.getElementById('s-hours-weekday').value = s.hoursWeekday;
    document.getElementById('s-hours-sunday').value  = s.hoursSunday;
    document.getElementById('s-store-name').value    = s.storeName;
    document.getElementById('s-tagline').value       = s.tagline;
    document.getElementById('s-whatsapp').value      = s.whatsapp;
    document.getElementById('s-map-embed').value     = s.mapEmbed;
    document.getElementById('s-delivery-charge').value      = s.deliveryCharge;
    document.getElementById('s-free-delivery-above').value  = s.freeDeliveryAbove;
    document.getElementById('s-labour-charge').value        = s.labourCharge || 0;
    document.getElementById('s-delivery-per-km').value      = s.deliveryPerKm || 0;
    document.getElementById('s-labour-per-item').value      = s.labourPerItem || 0;
    document.getElementById('s-company-lat').value          = s.companyLat || '';
    document.getElementById('s-company-lng').value          = s.companyLng || '';
    // Logo
    if (s.logo) {
      document.getElementById('s-logo-data').value = s.logo;
      document.getElementById('logo-img-thumb').src = s.logo;
      document.getElementById('logo-img-thumb').style.display = 'block';
      document.getElementById('logo-emoji-ph').style.display = 'none';
      document.getElementById('logo-remove-btn').style.display = 'inline-block';
    }
  }

  function saveSettingsForm() {
    const phone1 = document.getElementById('s-phone1').value.trim();
    const email1 = document.getElementById('s-email1').value.trim();
    const address = document.getElementById('s-address').value.trim();
    const city    = document.getElementById('s-city').value.trim();
    const storeName = document.getElementById('s-store-name').value.trim();

    if (!phone1 || !email1 || !address || !city || !storeName) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    const settings = {
      storeName,
      tagline:      document.getElementById('s-tagline').value.trim(),
      phone1,
      phone2:       document.getElementById('s-phone2').value.trim(),
      email1,
      email2:       document.getElementById('s-email2').value.trim(),
      address,
      city,
      hoursWeekday: document.getElementById('s-hours-weekday').value.trim(),
      hoursSunday:  document.getElementById('s-hours-sunday').value.trim(),
      whatsapp:     document.getElementById('s-whatsapp').value.trim().replace(/\D/g, ''),
      mapEmbed:     document.getElementById('s-map-embed').value.trim(),
      deliveryCharge:    parseFloat(document.getElementById('s-delivery-charge').value) || 299,
      freeDeliveryAbove: parseFloat(document.getElementById('s-free-delivery-above').value) || 5000,
      labourCharge:      parseFloat(document.getElementById('s-labour-charge').value) || 0,
      deliveryPerKm:     parseFloat(document.getElementById('s-delivery-per-km').value) || 0,
      labourPerItem:     parseFloat(document.getElementById('s-labour-per-item').value) || 0,
      companyLat:        parseFloat(document.getElementById('s-company-lat').value) || 0,
      companyLng:        parseFloat(document.getElementById('s-company-lng').value) || 0,
      logo: document.getElementById('s-logo-data').value || getSettings().logo || null
    };

    saveSettings(settings);
    showToast('Settings saved! Changes are now live on the store.', 'success');
    updatePreview(settings);
  }

  function resetToDefaults() {
    if (!confirmAction('Reset all settings to default values?')) return;
    Store.remove('bm_settings');
    loadSettingsIntoForm();
    showToast('Settings reset to defaults', 'info');
    updatePreview(getSettings());
  }

  function updatePreview(s) {
    document.getElementById('settings-preview').style.display = 'block';
    document.getElementById('prev-address').innerHTML =
      `${s.address}<br>${s.city}`;
    document.getElementById('prev-phones').innerHTML =
      `${s.phone1}${s.phone2 ? '<br>' + s.phone2 : ''}`;
    document.getElementById('prev-emails').innerHTML =
      `${s.email1}${s.email2 ? '<br>' + s.email2 : ''}`;
    document.getElementById('prev-hours').innerHTML =
      `${s.hoursWeekday}${s.hoursSunday ? '<br>' + s.hoursSunday : ''}`;
  }

  // Live preview on any input change
  document.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', () => {
      const s = {
        storeName:    document.getElementById('s-store-name').value,
        phone1:       document.getElementById('s-phone1').value,
        phone2:       document.getElementById('s-phone2').value,
        email1:       document.getElementById('s-email1').value,
        email2:       document.getElementById('s-email2').value,
        address:      document.getElementById('s-address').value,
        city:         document.getElementById('s-city').value,
        hoursWeekday: document.getElementById('s-hours-weekday').value,
        hoursSunday:  document.getElementById('s-hours-sunday').value,
      };
      updatePreview(s);
    });
  });

  // Responsive grid
  function adjustGrid() {
    document.getElementById('settings-grid').style.gridTemplateColumns =
      window.innerWidth < 900 ? '1fr' : '1fr 1fr';
  }
  window.addEventListener('resize', adjustGrid);

  window.pushAllToCloud = async function () {
    if (!SHEETS_URL) {
      alert('Google Sheets is not configured. Add SHEETS_URL in Netlify environment variables.');
      return;
    }
    const btn = document.getElementById('sync-all-btn');
    const status = document.getElementById('sync-all-status');
    btn.disabled = true;
    btn.textContent = '⏳ Uploading...';
    status.textContent = '';

    const keys = [
      'bm_settings', 'bm_admin_creds', 'bm_products', 'bm_employees',
      'bm_orders', 'bm_attendance', 'bm_expenses', 'bm_departments',
      'bm_shifts', 'bm_shift_history', 'bm_leaves', 'bm_holidays',
      'bm_weekly_off', 'bm_overtime', 'bm_advances', 'bm_payroll_runs'
    ];

    let pushed = 0, skipped = 0;
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const value = JSON.parse(raw);
          await fetch(SHEETS_URL, {
            method: 'POST',
            body: JSON.stringify({ key, value, secret: SHEETS_SECRET })
          });
          pushed++;
        } catch (_) { skipped++; }
      } else {
        skipped++;
      }
    }

    btn.disabled = false;
    btn.textContent = '☁️ Push All to Cloud Now';
    status.textContent = `✅ Done! ${pushed} items uploaded, ${skipped} empty.`;
    showToast('All data pushed to Google Sheets!', 'success');
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadSettingsIntoForm();
    updatePreview(getSettings());
    adjustGrid();
  });
