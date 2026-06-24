import fs from 'fs';

const filePath = 'claudereport.html';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('id="TOC"')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
