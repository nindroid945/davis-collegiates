require('dotenv').config();

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
    '901': 'Group Set'
};

function getFullEventName(parsed) {
    const evName = eventNames[parsed.eventNum] || `Event ${parsed.eventNum}`;
    const parts = [];
    if (parsed.level !== 'N/A') parts.push(parsed.level);
    if (parsed.gender !== 'N/A') parts.push(parsed.gender);
    if (parsed.age !== 'N/A') parts.push(parsed.age);
    parts.push(evName);
    return parts.join(' ');
}

function processScoreRow(event, parsed, rowData) {
    if (!rowData || !Array.isArray(rowData) || rowData.length < 4) return;
    const isGroupSet = parsed.eventNum === '901';
    const scoreColIndex = isGroupSet ? 3 : 7;

    const compFirstName = String(rowData[1] || '').trim();
    const compLastName = String(rowData[2] || '').trim();
    const name = `${compFirstName} ${compLastName}`.trim();

    const rawScore = rowData[scoreColIndex];
    if (rawScore === undefined || rawScore === null || rawScore === '') return;

    const score = typeof rawScore === 'number' ? rawScore.toFixed(2) : String(rawScore);

    if (name) {
        let comp = event.competitors.find(c => c.name === name);
        if (!comp) {
            comp = { name, score };
            event.competitors.push(comp);
        } else {
            comp.score = score;
        }
    }
}

async function run() {
    const url = process.env.GOOGLE_APP_SCRIPT_URL;
    if (!url) return console.log("NO URL");
    const response = await fetch(url);
    const textData = await response.text();
    const allRingsData = JSON.parse(textData);
    let state = { rings: { 1: [], 2: [], 3: [] } };

    for (const [ringIdStr, ringEvents] of Object.entries(allRingsData)) {
        const ringId = parseInt(ringIdStr, 10);

        for (const evPayload of ringEvents) {
            const { eventId, isFinished, rows } = evPayload;
            const parsed = parseEventCode(eventId);
            if (!parsed) continue;

            let event = state.rings[ringId].find(e => e.eventId === eventId);
            if (!event) {
                event = {
                    eventId: eventId,
                    name: getFullEventName(parsed),
                    status: isFinished ? 'Finished' : 'Upcoming',
                    competitors: []
                };
                state.rings[ringId].push(event);
            }

            if (rows && Array.isArray(rows)) {
                rows.forEach(row => processScoreRow(event, parsed, row));

                if (event.competitors.length > 0 && event.status === 'Upcoming') {
                    event.status = 'In Progress';
                }
            }

            if (isFinished) event.status = 'Finished';
        }
    }

    console.log("R1 0th event:");
    console.log(JSON.stringify(state.rings['1'].slice(0, 1), null, 2));

    console.log("R2 0th event:");
    console.log(JSON.stringify(state.rings['2'].slice(0, 1), null, 2));
}

run();
