require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

let state = {
  rings: { 1: [], 2: [], 3: [] }
};

let clients = [];

function parseEventCode(code) {
  if (typeof code !== 'string' || (!code && code.length < 4)) return null;
  const levelChar = code[0];
  const genderChar = code[1];
  const ageChar = code[2];
  const eventNum = code.substring(3);

  const levels = { B: 'Beginner', I: 'Intermediate', A: 'Advanced', N: 'N/A' };
  const genders = { F: 'Female', M: 'Male', A: 'N/A' };
  const ages = { Y: 'Young Child', C: 'Child', T: 'Teen', A: 'Adult', S: 'Senior', N: 'N/A' };

  return {
    level: levels[levelChar] || 'N/A',
    gender: genders[genderChar] || 'N/A',
    age: ages[ageChar] || 'N/A',
    eventNum: eventNum
  };
}

const eventNames = {
  '101': 'Changquan',
  '102': 'Nanquan',
  '111': 'Changquan (nandu)',
  '112': 'Nanquan (nandu)',
  '121': 'Straightsword',
  '122': 'Broadsword',
  '123': 'Nandao',
  '141': 'Spear',
  '142': 'Staff',
  '143': 'Southern Staff',
  '161': 'Open Barehand',
  '181': 'Other Weapon',
  '201': 'Traditional Open Barehand',
  '221': 'Traditional Short Weapon',
  '241': 'Traditional Long Weapon',
  '281': 'Traditional Soft Weapon',
  '301': '42 Fist',
  '302': '42 Sword',
  '311': 'Taiji Barehand (nandu)',
  '321': '24 Taiji',
  '322': 'Open Yang',
  '323': 'Open Chen',
  '341': 'Taiji Weapon',
  '361': 'Internal Open Fist',
  '381': 'Internal Open Weapon',
  '901': 'Group Set'
};

function getFullEventName(parsed) {
  const evName = eventNames[parsed.eventNum] || `Event ${parsed.eventNum}`;
  const parts = [];
  if (parsed.level !== 'N/A') parts.push(parsed.level);
  if (parsed.gender !== 'N/A') parts.push(parsed.gender);
  // if (parsed.age !== 'N/A') parts.push(parsed.age);
  parts.push(evName);
  return parts.join(' ');
}

function broadcastState() {
  const data = `data: ${JSON.stringify({ type: 'STATE_UPDATE', data: state })}\n\n`;
  clients.forEach(client => client.res.write(data));
}

function processScoreRow(event, parsed, rowData, headers) {
  if (!rowData || !Array.isArray(rowData) || !headers || !Array.isArray(headers)) return;

  const scoreIdx = headers.findIndex(h => h && String(h).toLowerCase().includes('final score'));
  const nameIdx = headers.findIndex(h => h && String(h).toLowerCase().includes('name'));

  if (nameIdx === -1 || scoreIdx === -1) return;

  const name = String(rowData[nameIdx] || '').trim();
  if (!name || name.toLowerCase() === 'name') return;

  const rawScore = rowData[scoreIdx];
  let score = '-';
  if (rawScore !== undefined && rawScore !== null && rawScore !== '') {
    score = typeof rawScore === 'number' ? rawScore.toFixed(2) : String(rawScore);
  }

  const isChecked = rowData[0] === true || String(rowData[0]).toLowerCase() === 'true';

  let comp = event.competitors.find(c => c.name === name);
  if (!comp) {
    comp = { name, score, checked: isChecked };
    event.competitors.push(comp);
  } else {
    comp.score = score;
    comp.checked = isChecked;
  }
}

app.post('/api/webhook', (req, res) => {
  console.log("--- WEBHOOK RECEIVED ---");
  console.log(req.body);
  const { updateType, sheetName, isFinished, rowData, ring } = req.body;
  if (!sheetName) return res.status(400).send('No sheetName received');

  const eventCode = typeof sheetName === 'string' ? sheetName.trim() : sheetName.toString();
  const parsed = parseEventCode(eventCode);

  if (!parsed) return res.status(400).send('Invalid Event Code format');

  const ringId = parseInt(ring, 10) || 1;

  if (!state.rings[ringId]) state.rings[ringId] = [];

  for (const r in state.rings) {
    if (parseInt(r, 10) !== ringId) {
      state.rings[r] = state.rings[r].filter(e => e.eventId !== eventCode);
    }
  }

  let ringEvents = state.rings[ringId];
  let event = ringEvents.find(e => e.eventId === eventCode);

  if (!event) {
    event = {
      eventId: eventCode,
      name: getFullEventName(parsed),
      status: isFinished ? 'Finished' : '',
      competitors: []
    };
    ringEvents.push(event);
  }

  if (updateType === 'SCORE_UPDATE') {
    const headers = req.body.headers || [];
    processScoreRow(event, parsed, rowData, headers);

    const allChecked = event.competitors.length > 0 && event.competitors.every(c => c.checked);
    event.status = (isFinished || allChecked) ? 'Finished' : '';
  }

  broadcastState();
  res.sendStatus(200);
});

app.get('/api/ping', (req, res) => {
  res.status(200).send('pong');
});

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const client = { id: Date.now(), res };
  clients.push(client);

  req.on('close', () => {
    clients = clients.filter(c => c.id !== client.id);
  });

  res.write(`data: ${JSON.stringify({ type: 'INITIAL_STATE', data: state })}\n\n`);
});

const GOOGLE_APP_SCRIPT_URL = process.env.GOOGLE_APP_SCRIPT_URL || '';

async function bootstrapState() {
  if (!GOOGLE_APP_SCRIPT_URL) {
    console.log("No GOOGLE_APP_SCRIPT_URL provided. Skipping historical data bootstrap.");
    return;
  }
  try {
    console.log("Bootstrapping historical data from Google Sheets...");

    // Using native fetch API (available in Node v18+)
    const response = await fetch(GOOGLE_APP_SCRIPT_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const textData = await response.text();
    if (textData.trim().startsWith('<')) {
      throw new Error("\\n\\n❌ Google returned an HTML Sign-In page instead of JSON.\\n\\n👉 FIX THIS in your Google Sheet:\\n1. Open Extensions > Apps Script.\\n2. Click 'Deploy' > 'New Deployment'.\\n3. Set 'Execute as' to 'Me'.\\n4. Set 'Who has access' to 'Anyone' (NOT 'Only myself'). \\n5. Click Deploy, copy the new Web App URL, paste it into your backend/.env file, and restart the server.\\n");
    }

    const allRingsData = JSON.parse(textData);

    // Reset state before bootstrapping
    state.rings = { 1: [], 2: [], 3: [] };

    for (const [ringIdStr, ringEvents] of Object.entries(allRingsData)) {
      const ringId = parseInt(ringIdStr, 10);
      if (!state.rings[ringId]) state.rings[ringId] = [];

      for (const evPayload of ringEvents) {
        const { eventId, isFinished, rows } = evPayload;
        const parsed = parseEventCode(eventId);
        if (!parsed) continue; // Skip invalid events

        let event = state.rings[ringId].find(e => e.eventId === eventId);
        if (!event) {
          event = {
            eventId: eventId,
            name: getFullEventName(parsed),
            status: isFinished ? 'Finished' : '',
            competitors: []
          };
          state.rings[ringId].push(event);
        }

        if (rows && Array.isArray(rows) && rows.length > 1) {
          const headers = rows[1]; // Header is always row index 1
          for (let i = 2; i < rows.length; i++) {
            processScoreRow(event, parsed, rows[i], headers);
          }
        }

        const allChecked = event.competitors.length > 0 && event.competitors.every(c => c.checked);
        event.status = (isFinished || allChecked) ? 'Finished' : '';
      }
    }
    console.log("Boostrap complete. State initialized.");
    broadcastState();
  } catch (error) {
    console.error("Failed to bootstrap data:", error);
  }
}

const PORT = 3001;
app.listen(PORT, async () => {
  await bootstrapState();
  console.log(`Node backend running on port ${PORT}`);
});
