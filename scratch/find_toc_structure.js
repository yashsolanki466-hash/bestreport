import fs from 'fs';

const filePath = 'claudereport.html';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
for (let i = 888; i < 940; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
