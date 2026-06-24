import fs from 'fs-extra';

const content = await fs.readFile('claudereport.html', 'utf-8');
const lines = content.split('\n');

console.log(lines.slice(1140, 1205).join('\n'));
