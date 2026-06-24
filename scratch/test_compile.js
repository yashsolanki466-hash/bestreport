import ejs from 'ejs';
import fs from 'fs-extra';
import path from 'path';

try {
  const content = await fs.readFile('templates/report_comprehensive.ejs', 'utf-8');
  ejs.compile(content);
  console.log("SUCCESS");
} catch (e) {
  console.error("ERROR compiling report_comprehensive.ejs:");
  console.error(e);
}
