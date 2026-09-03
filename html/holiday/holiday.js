  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const DAY_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let _editHolId = null;

  // ── Weekly Off ────────────────────────────────────────────────────────────
  function renderDayChips() {
    const off = getWeeklyOffDays();
    document.getElementById('day-chips').innerHTML = DAYS.map((d, i) =>
      `<button class="day-chip ${off.includes(i) ? 'on' : ''}" onclick="toggleDay(${i})">${d}</button>`
    ).join('');
  }

  function toggleDay(i) {
    let off = getWeeklyOffDays();
    if (off.includes(i)) off = off.filter(d => d !== i);
    else off.push(i);
    saveWeeklyOffDays(off);
    renderDayChips();
    showToast('Weekly off updated.', 'success');
  }

  // ── Holiday Table ─────────────────────────────────────────────────────────
  function render() {
    const year = parseInt(document.getElementById('f-year').value);
    const all  = getHolidays();
    const filtered = all.filter(h => new Date(h.date+'T00:00:00').getFullYear() === year)
                       .sort((a,b) => a.date.localeCompare(b.date));

    document.getElementById('hol-count').textContent = filtered.length + ' holiday(s) in ' + year;

    const tbody = document.getElementById('hol-body');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="no-row">No holidays added for ' + year + '. Click <strong>+ Add Holiday</strong> to start.</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(h => {
      const d   = new Date(h.date+'T00:00:00');
      const dow = DAYS[d.getDay()];
      const fmtDate = d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
      return `<tr>
        <td style="font-weight:700">${fmtDate}</td>
        <td><span class="dow-badge">${dow}</span></td>
        <td><span class="badge-holiday">🎉</span> ${h.name}</td>
        <td>
          <button class="btn-icon" onclick="openEditHoliday('${h.id}')" style="padding:.28rem .7rem;font-size:.8rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;background:var(--bg)">✏️ Edit</button>
          <button class="btn-icon" onclick="deleteHoliday('${h.id}')" style="padding:.28rem .7rem;font-size:.8rem;border:1.5px solid #e74c3c;border-radius:var(--radius-sm);cursor:pointer;background:#fdecea;color:#e74c3c;margin-left:.3rem">🗑️ Delete</button>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Add / Edit ─────────────────────────────────────────────────────────────
  function openAddHoliday() {
    _editHolId = null;
    document.getElementById('hol-modal-title').textContent = 'Add Holiday';
    document.getElementById('hol-date').value = '';
    document.getElementById('hol-name').value = '';
    document.getElementById('hol-error').style.display = 'none';
    document.getElementById('hol-modal').classList.add('active');
    setTimeout(() => document.getElementById('hol-date').focus(), 100);
  }

  function openEditHoliday(id) {
    const h = getHolidays().find(x => x.id === id);
    if (!h) return;
    _editHolId = id;
    document.getElementById('hol-modal-title').textContent = 'Edit Holiday';
    document.getElementById('hol-date').value = h.date;
    document.getElementById('hol-name').value = h.name;
    document.getElementById('hol-error').style.display = 'none';
    document.getElementById('hol-modal').classList.add('active');
  }

  function closeHolModal() { document.getElementById('hol-modal').classList.remove('active'); }

  function saveHoliday() {
    const date = document.getElementById('hol-date').value;
    const name = document.getElementById('hol-name').value.trim();
    const err  = document.getElementById('hol-error');
    err.style.display = 'none';
    if (!date) { err.textContent='Please select a date.'; err.style.display='block'; return; }
    if (!name) { err.textContent='Holiday name is required.'; err.style.display='block'; return; }

    const holidays = getHolidays();
    if (_editHolId) {
      const idx = holidays.findIndex(h => h.id === _editHolId);
      if (idx !== -1) holidays[idx] = { ...holidays[idx], date, name };
      showToast('Holiday updated.', 'success');
    } else {
      // Check duplicate date
      if (holidays.some(h => h.date === date)) {
        err.textContent = 'A holiday already exists on this date.';
        err.style.display = 'block';
        return;
      }
      holidays.push({ id: generateHolidayId(), date, name });
      showToast('Holiday added.', 'success');
    }
    saveHolidays(holidays);
    closeHolModal();
    // Switch year view to match added holiday
    document.getElementById('f-year').value = date.slice(0, 4);
    render();
  }

  function deleteHoliday(id) {
    const h = getHolidays().find(x => x.id === id);
    if (!h) return;
    if (!confirm(`Delete "${h.name}" on ${h.date}?`)) return;
    saveHolidays(getHolidays().filter(x => x.id !== id));
    showToast('Holiday deleted.', 'info');
    render();
  }

  // Overlay close
  document.getElementById('hol-modal').addEventListener('click', function(e) { if (e.target===this) this.classList.remove('active'); });

  // ── Init ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof syncFromSheets === 'function') { try { await syncFromSheets(); } catch(_) {} }

    // Year filter: current year ± 1
    const now = new Date().getFullYear();
    const sel = document.getElementById('f-year');
    for (let y = now - 1; y <= now + 2; y++) sel.add(new Option(y, y));
    sel.value = now;

    renderDayChips();
    render();
  });
