import fs from 'fs-extra';

const content = await fs.readFile('fixtures/minimal_project/test_report_gen.html', 'utf-8');

const target = "Non-specific organism";
const index = content.indexOf(target);
if (index !== -1) {
  console.log("MATCH FOUND!");
  console.log("HTML code following the note:");
  console.log(content.substring(index, index + 2500));
} else {
  console.log("MATCH NOT FOUND!");
}
