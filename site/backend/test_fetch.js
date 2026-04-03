require('dotenv').config();

async function run() {
    const url = process.env.GOOGLE_APP_SCRIPT_URL;
    if (!url) {
        console.error('No GOOGLE_APP_SCRIPT_URL in .env');
        return;
    }

    console.log('Fetching historical payload from URL:', url);
    try {
        const res = await fetch(url);
        const text = await res.text();

        if (text.startsWith('<')) {
            console.log('⚠️ Warning: Received HTML payload (usually a login redirect):\\n', text.substring(0, 300));
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (err) {
            console.error('Failed to parse JSON. Raw body snippet:', text.substring(0, 500));
            return;
        }

        console.log('\\n✅ Parsed successfully.');
        console.log('Keys returned:', Object.keys(data));

        for (const r in data) {
            console.log(`\\nRing ${r}: ${data[r].length} sheet(s) captured`);
            if (data[r].length > 0) {
                for (let i = 0; i < Math.min(data[r].length, 3); i++) {
                    const ev = data[r][i];
                    console.log(`  -> Sheet Name: "${ev.eventId}", isFinished: ${ev.isFinished}, rows captured: ${ev.rows ? ev.rows.length : 0}`);
                }
            }
        }
        console.log('\\nTest complete.');
    } catch (e) {
        console.error('Network Error:', e);
    }
}
run();
