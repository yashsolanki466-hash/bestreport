import fs from 'fs';

const filePath = 'templates/report_comprehensive.ejs';
const query = process.argv[2] || 'chart';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
let matches = 0;
lines.forEach((line, index) => {
  if (line.toLowerCase().includes(query.toLowerCase())) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    matches++;
  }
});
console.log(`Total matches: ${matches}`);
