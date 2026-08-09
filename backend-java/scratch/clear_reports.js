const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'data', 'sessions.json');
const raw = fs.readFileSync(filePath, 'utf8');
const sessions = JSON.parse(raw);

let cleared = 0;
for (const [key, val] of Object.entries(sessions)) {
  if (val && val.data && val.data.report) {
    delete val.data.report;
    console.log(`Cleared cached report for session: ${key}`);
    cleared++;
  }
}

fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2));
console.log(`Done. Cleared ${cleared} cached report(s).`);
