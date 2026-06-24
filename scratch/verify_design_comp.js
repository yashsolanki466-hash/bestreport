import fs from 'fs-extra';

const content = await fs.readFile('fixtures/minimal_project/test_report_gen.html', 'utf-8');

// Check terminal window in body
const termIndex = content.indexOf('<div class="terminal-window"');
if (termIndex !== -1) {
  console.log("SUCCESS: Found terminal-window in body!");
  console.log(content.substring(termIndex, termIndex + 400));
} else {
  console.log("FAILURE: Could not find terminal-window in body!");
}

console.log("-----------------------------------------");

// Check status-badge in body
const badgeIndex = content.indexOf('<span class="status-badge');
if (badgeIndex !== -1) {
  console.log("SUCCESS: Found status-badge in body!");
  console.log(content.substring(badgeIndex, badgeIndex + 400));
} else {
  console.log("FAILURE: Could not find status-badge in body!");
}
