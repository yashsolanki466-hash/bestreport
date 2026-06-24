import fs from 'fs';

const filePath = 'fixtures/minimal_project/test_report_gen.html';
if (!fs.existsSync(filePath)) {
  console.log("File does not exist!");
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');

// Find all occurrences of "Chart"
let idx = -1;
let count = 0;
while ((idx = content.indexOf('Chart', idx + 1)) !== -1) {
  count++;
  console.log(`\nOccurrence ${count} at index ${idx}:`);
  console.log(content.substring(idx - 100, idx + 200));
}
