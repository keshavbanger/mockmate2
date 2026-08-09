const https = require('https');

const apiKey = '84f29335c52e42b4b48098e18fca8f9c';

function getTavus(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'tavusapi.com',
      path: path,
      method: 'GET',
      headers: {
        'x-api-key': apiKey
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message} | Raw: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function run() {
  try {
    const response = await getTavus('/v2/conversations');
    const conversations = response.data || [];
    console.log(`Total conversations found: ${conversations.length}`);
    conversations.forEach((c, index) => {
      console.log(`\n[${index}] ID: ${c.conversation_id} | Name: ${c.conversation_name} | Status: ${c.status} | Created: ${c.created_at}`);
    });
  } catch (e) {
    console.error('Error running check:', e);
  }
}

run();
