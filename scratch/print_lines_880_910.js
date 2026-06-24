import fs from 'fs';

const filePath = 'claudereport.html';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("=== Printing lines 880 to 910 ===");
for (let i = 879; i < 910; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
