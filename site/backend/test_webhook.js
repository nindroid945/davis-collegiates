const http = require('http');

async function sendWebhook(payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: '/api/webhook',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            resolve(res.statusCode);
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function runTests() {
    try {
        console.log('Sending STATUS_UPDATE for AMT101 to Ring 1');
        await sendWebhook({
            ring: 1,
            updateType: 'STATUS_UPDATE',
            sheetName: 'AMT101',
            isFinished: false
        });

        console.log('Sending SCORE_UPDATE for AMT101 (Col 8 score)');
        await sendWebhook({
            ring: 1,
            updateType: 'SCORE_UPDATE',
            sheetName: 'AMT101',
            rowData: ["", "Evan", "Liang", "", "", "", "", "9.45"]
        });

        console.log('Sending SCORE_UPDATE for NAN901 (Group Set, Col 4 score) to Ring 2');
        await sendWebhook({
            ring: 2,
            updateType: 'SCORE_UPDATE',
            sheetName: 'NAN901',
            rowData: ["", "Team", "A", "9.20", "", "", "", ""]
        });

        console.log('Sending SCORE_UPDATE for NFN111 to Ring 3');
        await sendWebhook({
            ring: 3,
            updateType: 'SCORE_UPDATE',
            sheetName: 'NFN111',
            rowData: ["", "Jane", "Doe", "", "", "", "", "8.90"]
        });

        console.log('Sending SCORE_UPDATE to MOVE NFN111 from Ring 3 to Ring 1');
        await sendWebhook({
            ring: 1,
            updateType: 'SCORE_UPDATE',
            sheetName: 'NFN111',
            rowData: ["", "Alice", "Smith", "", "", "", "", "8.95"]
        });

        console.log('Finished testing webhooks');
        process.exit(0);
    } catch (err) {
        console.error('Test failed', err);
        process.exit(1);
    }
}

setTimeout(runTests, 1000);
