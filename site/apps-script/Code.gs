
function doGet(e) {
  let allRingsData = {};

  for (let ringStr in RING_SPREADSHEET_IDS) {
    const baseKey = parseInt(ringStr);
    const isZeroIndexed = Array.isArray(RING_SPREADSHEET_IDS) || RING_SPREADSHEET_IDS[0] !== undefined;
    const ringNum = isZeroIndexed ? baseKey + 1 : baseKey;
    
    if (!allRingsData[ringNum]) {
      allRingsData[ringNum] = [];
    }
    
    const sheetId = RING_SPREADSHEET_IDS[ringStr];
    if (!sheetId || sheetId.includes("YOUR_RING")) continue;
    
    try {
      const ss = SpreadsheetApp.openById(sheetId);
      const sheets = ss.getSheets();
      if (sheets.length === 0) continue;
      
      for (let s = 1; s < sheets.length; s++) {
        const evSheet = sheets[s];
        const eventCode = evSheet.getName();
        const evData = evSheet.getDataRange().getValues();
        
        const a1FontLine = evSheet.getRange(1, 1).getFontLine();
        
        let eventPayload = {
          eventId: eventCode,
          isFinished: (a1FontLine === 'line-through'),
          rows: evData
        };
        
        allRingsData[ringNum].push(eventPayload);
      }
    } catch (err) {
      Logger.log(`Error reading ring ${ringNum}: ${err.toString()}`);
    }
  }

  return ContentService.createTextOutput(JSON.stringify(allRingsData))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));

  for (let ringStr in RING_SPREADSHEET_IDS) {
    const sheetId = RING_SPREADSHEET_IDS[ringStr];
    if (!sheetId || sheetId.includes("YOUR_RING")) continue;
    
    ScriptApp.newTrigger('onEditInstallable')
      .forSpreadsheet(sheetId)
      .onEdit()
      .create();
  }
  Logger.log("Successfully installed webhook triggers for all Ring Spreadsheets!");
}

function onEditInstallable(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const rowIndex = e.range.getRow();
  
  // Replace with the actual URL of your Node.js backend when deployed
  const webhookUrl = "https://mai-littery-ronin.ngrok-free.dev/api/webhook"; 
  
  const ss = e.source;
  const ssName = ss.getName(); 
  
  const ringMatch = ssName.match(/Ring\s*(\d+)/i);
  const ringNum = ringMatch ? parseInt(ringMatch[1]) : 1;
  
  const sheets = ss.getSheets();
  const isStatusSheet = sheets.length > 0 && sheet.getSheetId() === sheets[0].getSheetId();
  if (isStatusSheet) return; // We no longer handle status updates from Sheet 0

  const lastCol = sheet.getLastColumn() || 25;
  const rowValues = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  const headers = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
  
  const a1FontLine = sheet.getRange(1, 1).getFontLine();

  let payload = {
    ring: ringNum,
    updateType: "SCORE_UPDATE",
    sheetName: sheetName,
    rowIndex: rowIndex,
    isFinished: (a1FontLine === 'line-through'),
    headers: headers,
    rowData: rowValues
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  };

  try {
    UrlFetchApp.fetch(webhookUrl, options);
  } catch (error) {
    Logger.log("Error posting to webhook: " + error.toString());
  }
}
