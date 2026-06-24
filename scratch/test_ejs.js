import ejs from 'ejs';
import fs from 'fs';
import path from 'path';

const templatePath = path.resolve('templates/report_comprehensive.ejs');
const templateStr = fs.readFileSync(templatePath, 'utf-8');

try {
  // Compile the template
  ejs.compile(templateStr, { filename: templatePath });
  console.log('Template compiled successfully!');
} catch (err) {
  console.error('EJS Compilation Error details:');
  console.error(err);
}
