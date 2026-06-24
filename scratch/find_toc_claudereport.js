import fs from 'fs';

const filePath = 'claudereport.html';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
let matches = 0;
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('toc-') || line.toLowerCase().includes('submenu')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    matches++;
  }
});
console.log(`Total matches: ${matches}`);
