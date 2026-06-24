import fs from 'fs-extra';

const content = await fs.readFile('claudereport.html', 'utf-8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('id="section-12"')) {
    console.log(`Found section-12 starting at line ${i + 1}`);
    console.log(lines.slice(i, i + 35).join('\n'));
    break;
  }
}
