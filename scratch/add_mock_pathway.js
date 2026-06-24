import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs-extra';

const targetDir = 'fixtures/minimal_project/07_Significant_DGE_pathways';
await fs.ensureDir(targetDir);

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet([
  { 'Pathway ID': 'ko00010', 'Pathway Name': 'Glycolysis / Gluconeogenesis', 'Gene Count': 24, 'p-value': 0.001 },
  { 'Pathway ID': 'ko00020', 'Pathway Name': 'Citrate cycle (TCA cycle)', 'Gene Count': 18, 'p-value': 0.005 },
  { 'Pathway ID': 'ko00030', 'Pathway Name': 'Pentose phosphate pathway', 'Gene Count': 12, 'p-value': 0.012 }
]);
XLSX.utils.book_append_sheet(wb, ws, 'KEGG Pathways');

const filePath = path.join(targetDir, 'kegg_results.xlsx');
XLSX.writeFile(wb, filePath);
console.log(`Mock Excel file created at: ${filePath}`);

// Also copy a mock image for the KEGG pathway image
const imgDir = path.join(targetDir, 'pathway_images');
await fs.ensureDir(imgDir);
// Let's create a blank text or 1x1 pixel image file
const dummyImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
await fs.writeFile(path.join(imgDir, 'ko00020.png'), Buffer.from(dummyImageBase64, 'base64'));
console.log(`Mock pathway image created.`);
