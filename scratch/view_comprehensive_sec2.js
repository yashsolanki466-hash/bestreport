import fs from 'fs-extra';

const content = await fs.readFile('templates/report_comprehensive.ejs', 'utf-8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('id="section-2"')) {
    console.log(`Found section-2 in report_comprehensive.ejs at line ${i + 1}`);
    console.log(lines.slice(i, i + 60).join('\n'));
    break;
  }
}
