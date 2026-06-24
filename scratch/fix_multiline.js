import fs from 'fs-extra';

const filePath = 'templates/report_comprehensive.ejs';
let content = await fs.readFile(filePath, 'utf-8');

// Replace any occurrence of the multi-line string with the single-line version
const target = "Bioinformatics analysis includes read filtering,\r\n                                        mapping, assembly, differential expression, and functional annotation.";
const targetLF = "Bioinformatics analysis includes read filtering,\n                                        mapping, assembly, differential expression, and functional annotation.";
const replacement = "Bioinformatics analysis includes read filtering, mapping, assembly, differential expression, and functional annotation.";

if (content.includes(target)) {
  content = content.replace(target, replacement);
  console.log("Successfully replaced CRLF target.");
} else if (content.includes(targetLF)) {
  content = content.replace(targetLF, replacement);
  console.log("Successfully replaced LF target.");
} else {
  // Let's do a regex replace to be absolutely sure
  const regex = /Bioinformatics analysis includes read filtering,[\r\n\s]+mapping, assembly, differential expression, and functional annotation\./;
  if (regex.test(content)) {
    content = content.replace(regex, "Bioinformatics analysis includes read filtering, mapping, assembly, differential expression, and functional annotation.");
    console.log("Successfully replaced via regex.");
  } else {
    console.log("Target string not found in file!");
  }
}

await fs.writeFile(filePath, content, 'utf-8');
