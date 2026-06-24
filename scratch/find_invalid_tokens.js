import fs from 'fs-extra';

const content = await fs.readFile('templates/report_comprehensive.ejs', 'utf-8');

// Extract all EJS tags: <% ... %>
const regex = /<%([\s\S]*?)%>/g;
let match;
let count = 0;
while ((match = regex.exec(content)) !== null) {
  count++;
  const tagContent = match[1];
  // Check if it has space after open tag: e.g. <% - or <% = or <% ~
  if (tagContent.startsWith(' ') && (tagContent[1] === '-' || tagContent[1] === '=')) {
    console.log(`Tag #${count} has spaces: <%${tagContent}%>`);
  }
  // Let's print tag if it has some weird character
  if (tagContent.includes('\r') || tagContent.includes('\n')) {
    // multi-line, it's fine
  } else {
    // check if it has any unexpected symbols
  }
}
console.log(`Inspected ${count} tags.`);
