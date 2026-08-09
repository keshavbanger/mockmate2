const http = require('http');

const data = JSON.stringify({
  session_id: 'c61f3cb7-4684-4779-8836-f7af860140db'
});


const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/generate-report',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`BODY: ${body.substring(0, 1000)}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
