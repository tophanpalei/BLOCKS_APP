// ═══════════════════════════════════════════════════════════════════════════
// BuildMate — Google Apps Script Backend
//
// Storage model:
//   • Array-type keys  → own Sheet tab, one JSON record per ROW
//   • Object/scalar    → "_config" tab, key|value rows
//
// This avoids the 50,000-char per-cell limit by spreading arrays across rows.
// Each row can hold one full order / attendance record without hitting limits.
// ═══════════════════════════════════════════════════════════════════════════

// ⚠️  Set this to the same value as SHEETS_SECRET in js/config.js
const WRITE_SECRET = 'CHANGE_THIS_TO_A_STRONG_SECRET';

// Keys whose value is an array — each gets its own Sheet tab
const ARRAY_KEYS = new Set([
  'bm_orders',
  'bm_products',
  'bm_employees',
  'bm_attendance',
  'bm_expenses',
  'bm_departments',
  'bm_shifts',
  'bm_shift_history',
  'bm_leaves',
  'bm_holidays',
  'bm_overtime',
  'bm_advances',
  'bm_payroll_runs'
]);

// ── GET  ?key=bm_orders&secret=xxx ───────────────────────────────────────────
function doGet(e) {
  try {
    if (e.parameter.secret !== WRITE_SECRET) return jsonResp({ ok: false, error: 'Unauthorized' });

    const key = e.parameter.key;
    if (!key) return jsonResp({ ok: false, error: 'key required' });

    const ss   = SpreadsheetApp.getActiveSpreadsheet();
    const data = ARRAY_KEYS.has(key) ? readArraySheet(ss, key) : readConfig(ss, key);

    return jsonResp({ data });
  } catch (err) {
    return jsonResp({ ok: false, error: err.message });
  }
}

// ── POST  { key, value, secret } ─────────────────────────────────────────────
function doPost(e) {
  try {
    const { key, value, secret } = JSON.parse(e.postData.contents);
    if (secret !== WRITE_SECRET) return jsonResp({ ok: false, error: 'Unauthorized' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (value === null || value === undefined) {
      // Delete / clear
      if (ARRAY_KEYS.has(key)) {
        const sheet = ss.getSheetByName(key);
        if (sheet) sheet.clearContents();
      } else {
        deleteConfig(ss, key);
      }
    } else if (ARRAY_KEYS.has(key)) {
      writeArraySheet(ss, key, Array.isArray(value) ? value : []);
    } else {
      writeConfig(ss, key, value);
    }

    return jsonResp({ ok: true });
  } catch (err) {
    return jsonResp({ ok: false, error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Array sheets  (one JSON record per row, column A)
// Returns null  → sheet doesn't exist yet  (app keeps its localStorage copy)
// Returns []    → sheet exists but is empty (app clears its copy)
// ═══════════════════════════════════════════════════════════════════════════
function readArraySheet(ss, key) {
  const sheet = ss.getSheetByName(key);
  if (!sheet) return null;                     // sheet never created → null

  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return [];               // sheet exists, no data

  return sheet
    .getRange(1, 1, lastRow, 1)
    .getValues()
    .map(row => {
      try { return row[0] ? JSON.parse(row[0]) : null; }
      catch { return null; }
    })
    .filter(v => v !== null);
}

function writeArraySheet(ss, key, arr) {
  let sheet = ss.getSheetByName(key);
  if (!sheet) {
    sheet = ss.insertSheet(key);
  } else {
    sheet.clearContents();
  }

  if (arr.length === 0) return;

  const rows = arr.map(item => [JSON.stringify(item)]);
  sheet.getRange(1, 1, rows.length, 1).setValues(rows);

  // Auto-resize column A so records are readable when you open Sheets
  sheet.autoResizeColumn(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Config sheet  (_config tab)  — for bm_settings, bm_admin_creds, bm_weekly_off
// Columns: A = key,  B = JSON string of value
// ═══════════════════════════════════════════════════════════════════════════
function getConfigSheet(ss) {
  return ss.getSheetByName('_config') || ss.insertSheet('_config');
}

function readConfig(ss, key) {
  const sheet   = getConfigSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return null;

  const rows = sheet.getRange(1, 1, lastRow, 2).getValues();
  for (const row of rows) {
    if (row[0] === key) {
      try { return row[1] ? JSON.parse(row[1]) : null; }
      catch { return null; }
    }
  }
  return null;
}

function writeConfig(ss, key, value) {
  const sheet   = getConfigSheet(ss);
  const lastRow = sheet.getLastRow();
  const str     = JSON.stringify(value);

  if (lastRow > 0) {
    const keys = sheet.getRange(1, 1, lastRow, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(str);  // update existing row
        return;
      }
    }
  }
  sheet.appendRow([key, str]);                    // new row
}

function deleteConfig(ss, key) {
  const sheet   = getConfigSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return;

  const keys = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (let i = keys.length - 1; i >= 0; i--) {
    if (keys[i][0] === key) sheet.deleteRow(i + 1);
  }
}

// ── Helper ─────────────────────────────────────────────────────────────────────
function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
