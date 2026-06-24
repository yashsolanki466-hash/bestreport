import fs from 'fs-extra';

const content = await fs.readFile('fixtures/minimal_project/test_report_gen.html', 'utf-8');

const target = "Non-specific organism";
const index = content.indexOf(target);
if (index !== -1) {
  console.log("MATCH FOUND!");
  console.log("Surrounding HTML:");
  console.log(content.substring(index - 500, index + 500));
} else {
  console.log("MATCH NOT FOUND!");
}
