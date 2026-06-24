import fs from 'fs-extra';
import ejs from 'ejs';

const content = await fs.readFile('templates/report_comprehensive.ejs', 'utf-8');
const lines = content.split('\n');

function checkRange(start, end) {
  const subContent = lines.slice(start, end).join('\n');
  
  // We need to balance open and close tags
  let openTags = 0;
  let currentPos = 0;
  while ((currentPos = subContent.indexOf('<%', currentPos)) !== -1) {
    openTags++;
    currentPos += 2;
  }
  let closeTags = 0;
  currentPos = 0;
  while ((currentPos = subContent.indexOf('%>', currentPos)) !== -1) {
    closeTags++;
    currentPos += 2;
  }
  
  let validContent = subContent;
  // If there's an unmatched open tag at the end, append '%>'
  if (openTags > closeTags) {
    validContent += '%>'.repeat(openTags - closeTags);
  }
  // If there's an unmatched close tag at the start, prepend '<%'
  if (closeTags > openTags) {
    validContent = '<%'.repeat(closeTags - openTags) + validContent;
  }

  try {
    ejs.compile(validContent);
    return true;
  } catch (e) {
    return e;
  }
}

// Let's do a binary search between 1 and 2675
let low = 1;
let high = lines.length;
let lastFail = null;
let lastFailLine = null;

// Let's print individual EJS blocks
const blocks = [];
let inBlock = false;
let currentBlock = [];
let blockStartLine = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('<%') && !inBlock) {
    inBlock = true;
    blockStartLine = i + 1;
  }
  if (inBlock) {
    currentBlock.push(line);
  }
  if (line.includes('%>') && inBlock) {
    blocks.push({
      start: blockStartLine,
      end: i + 1,
      content: currentBlock.join('\n')
    });
    currentBlock = [];
    inBlock = false;
  }
}

console.log(`Found ${blocks.length} EJS blocks.`);

for (const block of blocks) {
  try {
    ejs.compile(block.content);
  } catch (e) {
    console.log(`Block failed: lines ${block.start}-${block.end}`);
    console.log(block.content);
    console.error(e.message);
    console.log('---');
  }
}
