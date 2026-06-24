import ejs from 'ejs';
import fs from 'fs-extra';

for (const name of ['report_template.ejs', 'report_original.ejs', 'report_comprehensive.ejs']) {
  try {
    const content = await fs.readFile(`templates/${name}`, 'utf-8');
    ejs.compile(content);
    console.log(`${name}: SUCCESS`);
  } catch (e) {
    console.error(`${name}: FAILED`);
    console.error(e.message);
  }
}
