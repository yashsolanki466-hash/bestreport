import { launch } from 'puppeteer';
import ejs from 'ejs';
import fs from 'fs-extra';
import path from 'path';
import { Document, Paragraph, Packer, AlignmentType, HeadingLevel, TextRun } from 'docx';
import ora from 'ora';
import { parseProjectData } from './dataParser.js';
import { embedAssetsInData } from './embedAssets.js';
import { toTemplateContext } from './reportModel.js';
import { DEFAULT_TEMPLATE, getTemplateDir } from './paths.js';
export class ReportGenerator {
    options;
    browser = null;
    constructor(options) {
        this.options = {
            templateDir: options.templateDir ?? getTemplateDir(),
            headless: options.headless
        };
    }
    async init() {
        if (!this.browser) {
            this.browser = await launch({
                headless: this.options.headless,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
            });
        }
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
    async generate(options) {
        const startTime = Date.now();
        const files = [];
        const templateName = options.template || DEFAULT_TEMPLATE;
        const templateDir = this.options.templateDir;
        const needsPdf = options.formats.includes('pdf');
        const spinner = ora('Analyzing project structure...').start();
        try {
            spinner.text = 'Parsing project structure and data files...';
            let projectData = await parseProjectData(options.inputDir, options.metadata, options.template);
            if (needsPdf && options.embedImages !== false) {
                spinner.text = 'Embedding assets for PDF generation (this may take a while)...';
                projectData = await embedAssetsInData(projectData);
            }
            const templateContext = toTemplateContext(projectData);
            spinner.text = `Loading template: ${templateName}...`;
            const templatePath = path.join(templateDir, `${templateName}.ejs`);
            if (!(await fs.pathExists(templatePath))) {
                throw new Error(`Template not found: ${templatePath}`);
            }
            const templateContent = await fs.readFile(templatePath, 'utf-8');
            spinner.text = 'Rendering HTML content...';
            const html = ejs.render(templateContent, templateContext);
            const htmlPath = path.join(options.inputDir, `${options.outputName}.html`);
            if (options.formats.includes('html')) {
                spinner.text = `Writing HTML report to: ${htmlPath}`;
                await fs.writeFile(htmlPath, html, 'utf-8');
                const stats = await fs.stat(htmlPath);
                files.push({ path: htmlPath, size: stats.size });
            }
            if (needsPdf) {
                spinner.text = 'Converting to PDF (launching browser)...';
                await this.init();
                const pdfPath = path.join(options.inputDir, `${options.outputName}.pdf`);
                await this.generatePDF(html, pdfPath, options.inputDir);
                const stats = await fs.stat(pdfPath);
                files.push({ path: pdfPath, size: stats.size });
            }
            if (options.formats.includes('docx')) {
                spinner.text = 'Generating Word document...';
                const docxPath = path.join(options.inputDir, `${options.outputName}.docx`);
                await this.generateDOCX(projectData, docxPath);
                const stats = await fs.stat(docxPath);
                files.push({ path: docxPath, size: stats.size });
            }
            spinner.succeed('Report generation complete!');
            return { files, duration: Date.now() - startTime };
        }
        catch (error) {
            spinner.fail('Report generation failed');
            throw error;
        }
    }
    async generatePDF(html, outputPath, basePath) {
        if (!this.browser)
            throw new Error('Browser not initialized');
        const page = await this.browser.newPage();
        const tempHtmlPath = path.join(basePath, `.ngs-report-temp-${Date.now()}.html`);
        try {
            await fs.writeFile(tempHtmlPath, html, 'utf-8');
            const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, '/')}`;
            await page.goto(fileUrl, {
                waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
                timeout: 120000
            });
            await page.waitForFunction('document.fonts.ready', { timeout: 30000 }).catch(() => { });
            await page.evaluate(`(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            document.querySelectorAll('canvas').forEach((canvas) => {
              try {
                const dataUrl = canvas.toDataURL('image/png');
                const img = document.createElement('img');
                img.src = dataUrl;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                if (canvas.parentNode) canvas.parentNode.replaceChild(img, canvas);
              } catch (e) {}
            });
            resolve();
          }, 2500);
        });
      })()`);
            await new Promise((r) => setTimeout(r, 1500));
            await page.pdf({
                path: outputPath,
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: true,
                margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
                displayHeaderFooter: true,
                headerTemplate: '<div></div>',
                footerTemplate: '<div style="font-size:9px;text-align:center;width:100%;color:#666;font-family:Georgia,serif;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
            });
        }
        finally {
            await page.close();
            await fs.remove(tempHtmlPath).catch(() => { });
        }
    }
    async generateDOCX(data, outputPath) {
        const children = [
            new Paragraph({
                text: `NGS Analysis Report — ${data.project_id}`,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            }),
            new Paragraph({ children: [new TextRun({ text: `Project ID: ${data.project_id}`, bold: true })] }),
            new Paragraph({ children: [new TextRun(`PI: ${data.project_pi || 'N/A'}`)] }),
            new Paragraph({ children: [new TextRun(`Client: ${data.client_name}`)] }),
            new Paragraph({ children: [new TextRun(`Date: ${data.report_date}`)] }),
            new Paragraph({ children: [new TextRun(`Samples: ${data.sample_count}`)], spacing: { after: 300 } })
        ];
        if (data.warnings.length) {
            children.push(new Paragraph({ text: 'Warnings', heading: HeadingLevel.HEADING_2 }));
            for (const w of data.warnings.slice(0, 20)) {
                children.push(new Paragraph({ text: `• ${w}` }));
            }
        }
        const doc = new Document({
            sections: [{
                    properties: {
                        page: {
                            margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 }
                        }
                    },
                    children
                }]
        });
        await fs.writeFile(outputPath, await Packer.toBuffer(doc));
    }
}
//# sourceMappingURL=reportGenerator.js.map