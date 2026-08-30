// =====================================================================
// BuildMate — Google Apps Script (Paste this at script.google.com)
//
// SETUP STEPS:
//   1. Open https://script.google.com  (sign in as tophan073@gmail.com)
//   2. Open your "BuildMate DB" project (or create a new one)
//   3. Replace ALL existing code with this file's content
//   4. Click Deploy → Manage deployments
//   5. Click the pencil (edit) icon on your existing deployment
//   6. Set "Version" to "New version"
//   7. Click Deploy → copy the URL (same URL, updated code)
// =====================================================================

function doGet(e) {
  const key = e.parameter.key;
  if (!key) return out({ error: 'Missing key' });

  const sheet = getDataSheet();
  const rows  = sheet.getDataRange().getValues();

  for (const row of rows) {
    if (row[0] === key) {
      try { return out({ data: JSON.parse(row[1]) }); }
      catch (_) { return out({ data: row[1] }); }
    }
  }
  return out({ data: null });
}

function doPost(e) {
  try {
    const payload        = JSON.parse(e.postData.contents);
    const { key, value } = payload;
    if (!key) return out({ error: 'Missing key' });

    const sheet = getDataSheet();
    const rows  = sheet.getDataRange().getValues();

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === key) {
        if (value === null || value === undefined) {
          sheet.deleteRow(i + 1);
        } else {
          sheet.getRange(i + 1, 2).setValue(JSON.stringify(value));
          sheet.getRange(i + 1, 3).setValue(new Date().toISOString());
        }
        return out({ success: true });
      }
    }

    // New key — append row
    if (value !== null && value !== undefined) {
      sheet.appendRow([key, JSON.stringify(value), new Date().toISOString()]);
    }
    return out({ success: true });

  } catch (err) {
    return out({ success: false, error: err.message });
  }
}

function getDataSheet() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('SPREADSHEET_ID');
  let ss;

  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch (_) { ssId = null; }
  }

  if (!ss) {
    // First run — create a new spreadsheet and remember its ID
    ss = SpreadsheetApp.create('BuildMate Database');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }

  let sheet = ss.getSheetByName('buildmate_data');
  if (!sheet) {
    sheet = ss.insertSheet('buildmate_data');
    sheet.getRange(1, 1, 1, 3).setValues([['key', 'value', 'updated_at']]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 3)
      .setFontWeight('bold')
      .setBackground('#e65c00')
      .setFontColor('white');
    sheet.setColumnWidth(1, 220);
    sheet.setColumnWidth(2, 600);
    sheet.setColumnWidth(3, 200);
  }
  return sheet;
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
