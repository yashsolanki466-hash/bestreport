import fs from 'fs-extra';
import ejs from 'ejs';

const content = await fs.readFile('templates/report_comprehensive.ejs', 'utf-8');

try {
  const templ = new ejs.Template(content, { client: true, compileDebug: true });
  templ.compile();
} catch (e) {
  console.error("EJS Template compile error:");
  console.error(e);
}
