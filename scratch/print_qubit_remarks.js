import fs from 'fs-extra';

const content = await fs.readFile('fixtures/minimal_project/test_report_gen.html', 'utf-8');

// Find 'Table 3.2: RNA Quantification (Qubit)'
const tableIndex = content.indexOf('Table 3.2: RNA Quantification (Qubit)');
if (tableIndex !== -1) {
  console.log(content.substring(tableIndex, tableIndex + 2000));
} else {
  console.log("Could not find Qubit table.");
}
