import { launch } from 'puppeteer';
import ejs from 'ejs';
import fs from 'fs-extra';
import path from 'path';
import { Document, Paragraph, Packer, AlignmentType, HeadingLevel, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, ImageRun, PageBreak, Header, Footer, SimpleField } from 'docx';
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
            const paths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            ];
            if (process.env.LOCALAPPDATA) {
                paths.push(path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'));
            }
            let chromePath;
            for (const p of paths) {
                if (await fs.pathExists(p)) {
                    chromePath = p;
                    break;
                }
            }
            const launchOptions = {
                headless: this.options.headless,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
            };
            if (chromePath) {
                launchOptions.executablePath = chromePath;
            }
            this.browser = await launch(launchOptions);
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
            if (options.embedImages !== false) {
                spinner.text = 'Embedding assets in report data (this may take a while)...';
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
                await this.generateDOCX(projectData, docxPath, templateName);
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
    async generateDOCX(data, outputPath, templateName) {
        const children = [];
        const wl = data.static_snippets?.wet_lab || {};
        // 1. Cover Page
        const coverElements = createCoverPage(data, templateName);
        children.push(...coverElements);
        children.push(new Paragraph({ children: [new PageBreak()] }));
        // Helper to embed images in paragraphs
        const addImageIfExist = (imageSrc, width = 450, height = 300) => {
            if (!imageSrc)
                return;
            const imgInfo = getImageBufferAndType(imageSrc);
            if (imgInfo) {
                children.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new ImageRun({
                            data: imgInfo.buffer,
                            transformation: {
                                width,
                                height
                            }
                        })
                    ],
                    spacing: { before: 180, after: 180 }
                }));
            }
        };
        // Conditional render based on templateName
        if (templateName === 'report_interim') {
            // INTERIM REPORT SECTIONS WITH FORMAL LAYOUT matching report_interim.ejs
            const isDna = !!(data.service_type && (data.service_type.toLowerCase().includes('16s') ||
                data.service_type.toLowerCase().includes('dna') ||
                data.service_type.toLowerCase().includes('metagenome')));
            const sampleLabel = isDna ? "DNA" : "RNA";
            // 1. Table of Contents Page (Page 2)
            children.push(new Paragraph({
                spacing: { before: 240, after: 360 },
                border: {
                    bottom: {
                        style: BorderStyle.SINGLE,
                        size: 8,
                        color: "0F2547",
                        space: 6
                    }
                },
                children: [
                    new TextRun({
                        text: "Table of Contents",
                        bold: true,
                        font: "Times New Roman",
                        size: 32,
                        color: "0F2547"
                    })
                ]
            }));
            const resultsTitle = isDna ? "Results (DNA QC & Qubit)" : "Results (RNA QC & Qubit)";
            const tocItems = [
                { num: "1.", title: "Project Details & Sample Details", page: "Page 3" },
                { num: "2.", title: "Methods", page: "Page 4" },
                { num: "3.", title: resultsTitle, page: "Page 5" },
                { num: "4.", title: "Library QC (TapeStation)", page: "Page 6" },
                { num: "5.", title: "Conclusions", page: "Page 7" }
            ];
            const tocTableRows = tocItems.map((item) => {
                return new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 5, type: WidthType.PERCENTAGE },
                            borders: {
                                top: { style: BorderStyle.NONE },
                                bottom: { style: BorderStyle.SINGLE, size: 4, color: "EDF0F4" },
                                left: { style: BorderStyle.NONE },
                                right: { style: BorderStyle.NONE }
                            },
                            margins: { top: 120, bottom: 120, left: 60, right: 60 },
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: item.num, bold: true, font: "Times New Roman", size: 20, color: "0F2547" })
                                    ]
                                })
                            ]
                        }),
                        new TableCell({
                            width: { size: 80, type: WidthType.PERCENTAGE },
                            borders: {
                                top: { style: BorderStyle.NONE },
                                bottom: { style: BorderStyle.SINGLE, size: 4, color: "EDF0F4" },
                                left: { style: BorderStyle.NONE },
                                right: { style: BorderStyle.NONE }
                            },
                            margins: { top: 120, bottom: 120, left: 60, right: 60 },
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: item.title, font: "Times New Roman", size: 20, color: "1C2430" })
                                    ]
                                })
                            ]
                        }),
                        new TableCell({
                            width: { size: 15, type: WidthType.PERCENTAGE },
                            borders: {
                                top: { style: BorderStyle.NONE },
                                bottom: { style: BorderStyle.SINGLE, size: 4, color: "EDF0F4" },
                                left: { style: BorderStyle.NONE },
                                right: { style: BorderStyle.NONE }
                            },
                            margins: { top: 120, bottom: 120, left: 60, right: 60 },
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.RIGHT,
                                    children: [
                                        new TextRun({ text: item.page, font: "Times New Roman", size: 20, color: "5B6B7F" })
                                    ]
                                })
                            ]
                        })
                    ]
                });
            });
            children.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: tocTableRows
            }));
            children.push(new Paragraph({ spacing: { after: 240 } }));
            children.push(new Paragraph({ children: [new PageBreak()] }));
            // Section 1: Project Details & Sample Details
            children.push(createHeading("1. Project Details & Sample Details", HeadingLevel.HEADING_1));
            children.push(createParagraph(`This interim report outlines the status of ${sampleLabel} extraction, quality control, and library preparation for the project ${data.project_id}.`));
            const specHeaders = ["Parameter", "Value"];
            const specRows = [
                ["Service Type", data.service_type || "Transcriptome Sequencing"],
                ["Platform", data.platform || "Illumina Novaseq X Plus"],
                ["Read Length", data.read_length || "2 X 150 PE"],
                ["Data Throughput", data.data_throughput || "~06GB / Sample"],
                ["Type of Sample", data.sample_type || "Leaf"],
                ["No. of Samples", String(data.sample_count)],
                ["Samples ID of Libraries Prepared", data.samples.join(', ')],
                ["Shipping Condition", data.shipping_condition || "NA"],
                ["No. of Libraries Prepared", data.no_of_libraries_prepared || String(data.sample_count)]
            ];
            children.push(createStyledTable(specHeaders, specRows));
            // Section 2: Methods
            children.push(new Paragraph({ children: [new PageBreak()] }));
            children.push(createHeading("2. Methods", HeadingLevel.HEADING_1));
            // 2.1 Extraction and Quantitative analysis
            const rawIsoHeader = wl.rna_isolation_qc_header || `Extraction and Quantitative analysis of ${sampleLabel}:`;
            const cleanIsoHeader = rawIsoHeader.replace(/^(?:\d+\.\d+\s*)?/, '').trim();
            children.push(createHeading("2.1 " + cleanIsoHeader, HeadingLevel.HEADING_2));
            const isolationText = wl.rna_isolation_qc ||
                (isDna
                    ? "DNA was extracted from Soil Samples using Alexgen Soil DNA Kit. (Cat. No. 1008). DNA quantity was measured using Qubit® 4.0 fluorometer and DNA sample was amplified using 16s primer set and analyzed by gel electrophoresis."
                    : "RNA was extracted from samples using standard methods. RNA quantity was measured using Qubit® 4.0 fluorometer and quality analyzed on 1% agarose gel.");
            children.push(createParagraph(isolationText));
            // 2.2 Preparation of Library
            const rawPrepHeader = wl.library_preparation_header || "Preparation of Library:";
            const cleanPrepHeader = rawPrepHeader.replace(/^(?:\d+\.\d+\s*)?/, '').trim();
            children.push(createHeading("2.2 " + cleanPrepHeader, HeadingLevel.HEADING_2));
            const libraryPrepText = wl.library_preparation ||
                (isDna
                    ? "The V3-V4 (Product size ~459bp) region of 16s RNA gene was amplified using specific primers. PCR amplified product was re-amplified using Index Primers for library preparation (Amplicon libraries). Validation of Amplicon library was performed on Agilent 4150 TapeStation."
                    : "The paired-end sequencing library was prepared using NEBNext® Ultra™ RNA Library Prep Kit for Illumina. (NEB #E7770). mRNA enrichment was performed, fragmented, and subjected to cDNA synthesis and adapter ligation.");
            children.push(createParagraph(libraryPrepText));
            // 2.3 QC on TapeStation
            const rawQcHeader = wl.library_qc_header || "Quantity and quality check (QC) of library on Agilent Tape Station 4150:";
            const cleanQcHeader = rawQcHeader.replace(/^(?:\d+\.\d+\s*)?/, '').trim();
            children.push(createHeading("2.3 " + cleanQcHeader, HeadingLevel.HEADING_2));
            const libraryQcText = wl.library_qc ||
                "The amplified libraries were analyzed on TapeStation 4150 (Agilent Technologies) using High Sensitivity D1000 ScreenTape® as per manufacturer's instructions.";
            children.push(createParagraph(libraryQcText));
            // 2.4 Cluster Generation and Sequencing (if present)
            if (wl.cluster_generation && wl.cluster_generation.trim()) {
                const rawClusterHeader = wl.cluster_generation_header || "Cluster Generation and Sequencing:";
                const cleanClusterHeader = rawClusterHeader.replace(/^(?:\d+\.\d+\s*)?/, '').trim();
                children.push(createHeading("2.4 " + cleanClusterHeader, HeadingLevel.HEADING_2));
                children.push(createParagraph(wl.cluster_generation));
            }
            // Section 3: Results
            children.push(new Paragraph({ children: [new PageBreak()] }));
            children.push(createHeading(`3. Results (${sampleLabel} QC & Qubit)`, HeadingLevel.HEADING_1));
            // 3.1 Gel QC
            children.push(createHeading(`3.1 ${sampleLabel} QC using Agarose Gel`, HeadingLevel.HEADING_2));
            children.push(createParagraph(isDna
                ? "DNA quality was validated using 1.8% Agarose Gel electrophoresis to ensure intact genomic DNA/amplicon bands."
                : "RNA quality was validated using 1% Agarose Gel electrophoresis to ensure intact ribosomal RNA bands (28S and 18S)."));
            // Embed Gel QC Image
            if (data.gel_image_src) {
                addImageIfExist(data.gel_image_src, 400, 250);
                children.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: `Figure 1: ${sampleLabel} QC on Agarose Gel`,
                            font: "Times New Roman",
                            size: 18,
                            color: "5B6B7F",
                            italics: true
                        })
                    ],
                    spacing: { before: 120, after: 240 }
                }));
            }
            // Lane Mapping Table
            if (data.lane_mapping && data.lane_mapping.rows && data.lane_mapping.rows.length > 0) {
                children.push(createParagraph("Lane ID to Sample Name Mapping:", { bold: true }));
                children.push(createStyledTable(data.lane_mapping.headers, data.lane_mapping.rows));
                children.push(new Paragraph({ spacing: { after: 180 } }));
            }
            // 3.2 Qubit Quantification Data
            children.push(createHeading("3.2 Qubit Quantification Data", HeadingLevel.HEADING_2));
            children.push(createParagraph(`Table 3.2 outlines the quantitative analysis of the ${sampleLabel} samples as measured by Qubit fluorometer:`));
            if (data.qubit_data && data.qubit_data.length > 0) {
                const qubitHeaders = ["S.N.", "Sample ID", "Conc. (ng/µL)", "Volume (µL)", "Yield (µg)", "Remarks"];
                const qubitRows = data.qubit_data.map((q, idx) => [
                    String(idx + 1),
                    q.sample_id,
                    q.conc || "N/A",
                    q.vol || "N/A",
                    q.yield || "N/A",
                    q.remarks || ""
                ]);
                children.push(createStyledTable(qubitHeaders, qubitRows));
            }
            else {
                children.push(createParagraph("No Qubit data available.", { italic: true }));
            }
            // Section 4: Library QC
            children.push(new Paragraph({ children: [new PageBreak()] }));
            children.push(createHeading("4. Quantity and quality check (QC) of library on Agilent Tape Station 4150", HeadingLevel.HEADING_1));
            children.push(createHeading("4.1 TapeStation 4150 Profiles of Library:", HeadingLevel.HEADING_2));
            children.push(createParagraph("Agilent High Sensitivity D1000 ScreenTape® profiles for prepared libraries are shown below:"));
            if (data.tapestation_images && data.tapestation_images.length > 0) {
                let figCount = 2;
                for (const img of data.tapestation_images) {
                    children.push(createParagraph(`Sample Profile: ${img.sample_id}`, { bold: true, spacingAfter: 60 }));
                    addImageIfExist(img.src, 450, 200);
                    children.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: `Figure ${figCount}: Agilent TapeStation Size Distribution Profile for sample ${img.sample_id}`,
                                font: "Times New Roman",
                                size: 18,
                                color: "5B6B7F",
                                italics: true
                            })
                        ],
                        spacing: { before: 120, after: 240 }
                    }));
                    figCount++;
                }
            }
            else {
                children.push(createParagraph("TapeStation profile images not supplied or embedded.", { italic: true }));
            }
            // Section 5: Conclusions
            children.push(new Paragraph({ children: [new PageBreak()] }));
            const rawConcHeader = wl.conclusions_header || "Conclusions";
            const cleanConcHeader = rawConcHeader.replace(/^(?:\d+\s*)?/, '').trim();
            children.push(createHeading("5. " + cleanConcHeader, HeadingLevel.HEADING_1));
            if (data.conclusions && data.conclusions.length > 0) {
                for (const c of data.conclusions) {
                    children.push(createParagraph("•  " + c));
                }
            }
            else {
                children.push(createParagraph("•  The libraries were prepared from the samples by " + (data.library_kit || "KAPA mRNA HyperPrep Kit for Illumina (CAT #KK8581)") + "."));
                children.push(createParagraph("•  The average size of libraries is in range of " + (data.size_range || "330bp to 360bp") + " for all samples."));
                children.push(createParagraph("•  The libraries will be sequenced on " + (data.platform || "Illumina Novaseq X Plus") + " platform using " + (data.chemistry || "2x150 bp PE") + " chemistry."));
            }
            children.push(new Paragraph({ spacing: { before: 360, after: 360 } }));
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: "[END OF INTERIM REPORT]",
                        bold: true,
                        font: "Times New Roman",
                        size: 20,
                        color: "5B6B7F"
                    })
                ]
            }));
            // [Signature Block removed as requested]
        }
        else if (templateName === 'report_16s') {
            // 16S METAGENOME REPORT SECTIONS
            // 1. Project Details
            children.push(createHeading("1. Project Details", HeadingLevel.HEADING_1));
            const specHeaders = ["Specification", "Detail"];
            const specRows = [
                ["Project ID", data.project_id],
                ["Service Type", data.service_type || "16S Metagenome Sequencing & Analysis"],
                ["Sequencing Platform", data.platform || "Illumina Novaseq X Plus"],
                ["Read Length", data.read_length || "2 X 150 PE"],
                ["Data Throughput", data.data_throughput || "~06GB / Sample"],
                ["No. of Samples", String(data.sample_count)]
            ];
            children.push(createStyledTable(specHeaders, specRows));
            // 2. Sample Details
            children.push(createHeading("2. Sample Details", HeadingLevel.HEADING_1));
            if (data.qubit_data && data.qubit_data.length > 0) {
                const qubitHeaders = ["Sample ID", "Conc. (ng/µL)", "Volume (µL)", "Yield (ng)", "Remarks"];
                const qubitRows = data.qubit_data.map(q => [
                    q.sample_id,
                    q.conc || "N/A",
                    q.vol || "N/A",
                    q.yield || "N/A",
                    q.remarks || ""
                ]);
                children.push(createStyledTable(qubitHeaders, qubitRows));
            }
            // 3. Methods
            children.push(createHeading("3. Methods", HeadingLevel.HEADING_1));
            children.push(createHeading("Isolation and Quantitative analysis of DNA", HeadingLevel.HEADING_2));
            children.push(createParagraph(wl.rna_isolation_qc || "DNA was extracted from Soil Samples using Alexgen Soil DNA Kit. (Cat. No. 1008). DNA quantity was measured using Qubit® 4.0 fluorometer and DNA sample was amplified using 16s primer set and analyzed by gel electrophoresis."));
            children.push(createHeading("Preparation of Library", HeadingLevel.HEADING_2));
            children.push(createParagraph(wl.library_preparation || "The V3-V4 (Product size ~459bp) region of 16s RNA gene was amplified using specific primers. PCR amplified product was re-amplified using Index Primers for library preparation (Amplicon libraries). Validation of Amplicon library was performed on Agilent 4150 TapeStation."));
            // 4. Results & Library QC
            children.push(createHeading("4. Results & Library QC", HeadingLevel.HEADING_1));
            if (data.lane_mapping && data.lane_mapping.rows && data.lane_mapping.rows.length > 0) {
                children.push(createStyledTable(data.lane_mapping.headers, data.lane_mapping.rows));
            }
            addImageIfExist(data.gel_image_src, 400, 250);
            if (data.tapestation_images && data.tapestation_images.length > 0) {
                children.push(createHeading("TapeStation Profiles", HeadingLevel.HEADING_2));
                for (const img of data.tapestation_images) {
                    children.push(createParagraph(`Sample: ${img.sample_id}`, { bold: true }));
                    addImageIfExist(img.src, 450, 180);
                }
            }
            // 5. Data Generation (Table 1: Raw reads stats)
            children.push(createHeading("5. Data Generation", HeadingLevel.HEADING_1));
            children.push(createParagraph("Table 1 provides raw sequencing data statistics generated for each sample:"));
            if (data.metagenome_raw_stats && data.metagenome_raw_stats.length > 0) {
                const rawHeaders = ["Sample ID", "PE seq", "Total reads", "Avg len", "Data (bp)", "Data (MB)"];
                const rawRows = data.metagenome_raw_stats.map(row => [
                    String(row.sample_id ?? ''),
                    String(row.pe_seq ?? ''),
                    String(row.total_reads ?? ''),
                    String(row.avg_len ?? ''),
                    String(row.data_bp ?? ''),
                    String(row.data_mb ?? '')
                ]);
                children.push(createStyledTable(rawHeaders, rawRows));
            }
            // 6. Bioinformatics Analysis
            children.push(createHeading("6. Bioinformatics Analysis", HeadingLevel.HEADING_1));
            children.push(createCalloutBox("QIIME2 is a next-generation microbiome bioinformatics platform that is extensible, free, open source, and micro-analytically transparent. It enables researchers to perform microbiome analysis starting with raw sequencing data.", "QIIME2 Pipeline Overview"));
            // 6.1 Feature Summary
            children.push(createHeading("6.1 Denoised Feature Summary", HeadingLevel.HEADING_2));
            children.push(createParagraph("Table 2 lists the features/OTUs identified per sample post join-filtering and deblur denoising:"));
            if (data.metagenome_feature_summary && data.metagenome_feature_summary.length > 0) {
                const featHeaders = ["Sample ID", "PE seq", "Joined/Filtered", "Denoised", "Filtered Seq", "OTUs"];
                const featRows = data.metagenome_feature_summary.map(row => [
                    String(row.sample_id ?? ''),
                    String(row.pe_seq ?? ''),
                    String(row.joined_filtered ?? ''),
                    String(row.denoised ?? ''),
                    String(row.filtered_seq ?? ''),
                    String(row.filtered_features ?? '')
                ]);
                children.push(createStyledTable(featHeaders, featRows));
            }
            // 6.2 Taxonomy Distribution (Phylum)
            children.push(createHeading("6.2 Taxonomy Abundance Profile", HeadingLevel.HEADING_2));
            children.push(createParagraph("Relative abundance of phyla across all samples:"));
            if (data.metagenome_taxonomy_distribution) {
                children.push(createStyledTable(data.metagenome_taxonomy_distribution.headers, data.metagenome_taxonomy_distribution.rows));
            }
            addImageIfExist(data.metagenome_phylum_chart_src, 450, 250);
            // 6.3 Feature/OTU Heatmap
            children.push(createHeading("6.3 OTU Distribution Heatmap", HeadingLevel.HEADING_2));
            addImageIfExist(data.metagenome_heatmap_src, 450, 300);
            // 6.4 Alpha Diversity
            children.push(createHeading("6.4 Alpha Diversity", HeadingLevel.HEADING_2));
            children.push(createParagraph("Table 3 lists Chao1, Shannon, and Observed Features alpha-diversity indices:"));
            if (data.metagenome_alpha_diversity && data.metagenome_alpha_diversity.length > 0) {
                const alphaHeaders = ["Sample ID", "Chao1", "Shannon", "Observed Features"];
                const alphaRows = data.metagenome_alpha_diversity.map(row => [
                    String(row.sample_id ?? ''),
                    String(row.chao1 ?? ''),
                    String(row.shannon ?? ''),
                    String(row.observed_features ?? '')
                ]);
                children.push(createStyledTable(alphaHeaders, alphaRows));
            }
            addImageIfExist(data.metagenome_alpha_plot_src, 450, 250);
            // 6.5 Rarefaction
            children.push(createHeading("6.5 Rarefaction Curves", HeadingLevel.HEADING_2));
            addImageIfExist(data.metagenome_rarefaction_src, 450, 250);
            // 6.6 Beta Diversity
            children.push(createHeading("6.6 Beta Diversity", HeadingLevel.HEADING_2));
            children.push(createParagraph("Bray-Curtis distance matrix showing dissimilarity between samples:"));
            if (data.metagenome_beta_matrix) {
                children.push(createStyledTable(data.metagenome_beta_matrix.headers, data.metagenome_beta_matrix.rows));
            }
            addImageIfExist(data.metagenome_pcoa_src, 450, 250);
            // 6.7 Krona Graph
            children.push(createHeading("6.7 Krona Interaction Representation", HeadingLevel.HEADING_2));
            addImageIfExist(data.metagenome_krona_src, 450, 280);
            // 7. Deliverables
            children.push(createHeading("7. Data Deliverables", HeadingLevel.HEADING_1));
            children.push(createParagraph("The following folder structure outlines the files delivered for the metagenome sequencing project:"));
            if (data.deliverables_tree) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: data.deliverables_tree, font: "Courier New", size: 16 })],
                    spacing: { before: 120, after: 120 }
                }));
            }
        }
        else {
            // COMPREHENSIVE TRANSCRIPTOME REPORT SECTIONS (DEFAULT)
            // 1. Project Specifications
            children.push(createHeading("1. Project Details", HeadingLevel.HEADING_1));
            const specHeaders = ["Specification", "Detail"];
            const specRows = [
                ["Project ID", data.project_id],
                ["Service Type", data.service_type || "Transcriptome Sequencing"],
                ["Sequencing Platform", data.platform || "Illumina Novaseq X Plus"],
                ["Read Length", data.read_length || "2 X 150 PE"],
                ["Data Throughput", data.data_throughput || "~06GB / Sample"],
                ["No. of Samples", String(data.sample_count)]
            ];
            children.push(createStyledTable(specHeaders, specRows));
            // 2. Sample Details
            children.push(createHeading("2. Sample Details", HeadingLevel.HEADING_1));
            if (data.qubit_data && data.qubit_data.length > 0) {
                const qubitHeaders = ["Sample ID", "Conc. (ng/µL)", "Volume (µL)", "Yield (ng)", "Remarks"];
                const qubitRows = data.qubit_data.map(q => [
                    q.sample_id,
                    q.conc || "N/A",
                    q.vol || "N/A",
                    q.yield || "N/A",
                    q.remarks || ""
                ]);
                children.push(createStyledTable(qubitHeaders, qubitRows));
            }
            // 3. Reference Genome Summary
            children.push(createHeading("3. Reference Genome Summary", HeadingLevel.HEADING_1));
            children.push(createParagraph(`Reference Organism: ${data.reference_organism || 'N/A'}`));
            if (data.ref_stats) {
                const refHeaders = ["Metric", "Value"];
                const refRows = [
                    ["Total Scaffolds/Contigs", String(data.ref_stats.total_scaffolds || 'N/A')],
                    ["Genome Length (bp)", String(data.ref_stats.genome_length || 'N/A')],
                    ["Mean Scaffold Size (bp)", String(data.ref_stats.mean_scaffold_size || 'N/A')],
                    ["Max Scaffold Size (bp)", String(data.ref_stats.max_scaffold_size || 'N/A')],
                    ["Total Genes Annotated", String(data.total_genes || 'N/A')]
                ];
                children.push(createStyledTable(refHeaders, refRows));
            }
            // 4. Sequencing Quality Control
            children.push(createHeading("4. Sequencing Quality Control", HeadingLevel.HEADING_1));
            children.push(createParagraph("Table showing Raw sequencing throughput and quality parameters:"));
            if (data.sequencing_stats && data.sequencing_stats.length > 0) {
                const seqHeaders = ["Sample", "Raw Reads", "Clean Reads", "Data (GB)", "Q30 (%)", "GC (%)"];
                const seqRows = data.sequencing_stats.map(row => [
                    String(row.sample ?? ''),
                    String(row.raw_reads ?? ''),
                    String(row.clean_reads ?? ''),
                    String(row.data_gb ?? ''),
                    String(row.q30 ?? ''),
                    String(row.gc_content ?? '')
                ]);
                children.push(createStyledTable(seqHeaders, seqRows));
            }
            // 5. Mapping Statistics
            children.push(createHeading("5. Mapping Statistics", HeadingLevel.HEADING_1));
            if (data.mapping_stats && data.mapping_stats.length > 0) {
                const mapHeaders = ["Sample", "Total Reads", "Mapped Reads", "Percent Mapped", "Unique Mapped", "Percent Unique"];
                const mapRows = data.mapping_stats.map(row => [
                    String(row.sample_name ?? ''),
                    String(row.total_reads ?? ''),
                    String(row.mapped_reads ?? ''),
                    String(row.percent_mapped ?? ''),
                    String(row.unique_reads ?? ''),
                    String(row.percent_unique ?? '')
                ]);
                children.push(createStyledTable(mapHeaders, mapRows));
            }
            // 6. Assembly Statistics
            children.push(createHeading("6. Assembly Statistics", HeadingLevel.HEADING_1));
            if (data.assembly_stats && data.assembly_stats.length > 0) {
                const assHeaders = ["Sample", "Transcripts Count", "Total bp", "Mean Size (bp)", "Max Size (bp)"];
                const assRows = data.assembly_stats.map(row => [
                    String(row.sample ?? ''),
                    String(row.num_transcripts ?? ''),
                    String(row.total_bp ?? ''),
                    String(row.mean_size ?? ''),
                    String(row.max_size ?? '')
                ]);
                children.push(createStyledTable(assHeaders, assRows));
            }
            // 7. Differential Expression Analysis (DGE)
            children.push(createHeading("7. Differential Expression Analysis (DGE)", HeadingLevel.HEADING_1));
            if (data.diff_expr_stats && data.diff_expr_stats.length > 0) {
                const dgeHeaders = ["Comparison Group", "Total Genes", "Significant Up", "Significant Down", "Total Significant"];
                const dgeRows = data.diff_expr_stats.map(row => [
                    String(row.comparison ?? ''),
                    String(row.total_genes ?? ''),
                    String(row.sig_up ?? ''),
                    String(row.sig_down ?? ''),
                    String(row.total_sig ?? '')
                ]);
                children.push(createStyledTable(dgeHeaders, dgeRows));
            }
            // Add DGE heatmaps/volcano plots recursively
            if (data.pca_plots && data.pca_plots.length > 0) {
                children.push(createHeading("Principal Component Analysis (PCA)", HeadingLevel.HEADING_2));
                for (const p of data.pca_plots) {
                    children.push(createParagraph(p.title, { bold: true }));
                    addImageIfExist(p.src, 400, 300);
                }
            }
            // 8. Functional Enrichment (Pathway & GO)
            children.push(createHeading("8. Functional Enrichment Analysis", HeadingLevel.HEADING_1));
            children.push(createHeading("Top Significant KEGG Pathways", HeadingLevel.HEADING_2));
            if (data.pathway_stats && data.pathway_stats.length > 0) {
                const pathHeaders = ["Level 1 Category", "Pathway / Level 2", "Count"];
                const pathRows = data.pathway_stats.slice(0, 20).map(row => [
                    String(row.level1 ?? ''),
                    String(row.level2 ?? ''),
                    String(row.count ?? '0')
                ]);
                children.push(createStyledTable(pathHeaders, pathRows));
            }
            children.push(createHeading("GO Distribution Summary", HeadingLevel.HEADING_2));
            if (data.go_distribution && data.go_distribution.length > 0) {
                const goHeaders = ["Comparison", "Significant DGE", "Seq with GO", "BP Count", "CC Count", "MF Count"];
                const goRows = data.go_distribution.map(row => [
                    String(row.combination ?? ''),
                    String(row.sig_dge ?? '0'),
                    String(row.sq_go ?? '0'),
                    String(row.bp ?? '0'),
                    String(row.cc ?? '0'),
                    String(row.mf ?? '0')
                ]);
                children.push(createStyledTable(goHeaders, goRows));
            }
            // 9. Deliverables Tree
            children.push(createHeading("9. Data Deliverables Directory Tree", HeadingLevel.HEADING_1));
            if (data.deliverables_tree) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: data.deliverables_tree, font: "Courier New", size: 16 })],
                    spacing: { before: 120, after: 120 }
                }));
            }
        }
        const reportTypeLabel = templateName === 'report_interim' ? 'Interim Report' : 'Final Report';
        const docHeader = new Header({
            children: [
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.SINGLE, size: 4, color: "EDF0F4" },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE }
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    borders: {
                                        top: { style: BorderStyle.NONE },
                                        bottom: { style: BorderStyle.SINGLE, size: 4, color: "EDF0F4" },
                                        left: { style: BorderStyle.NONE },
                                        right: { style: BorderStyle.NONE }
                                    },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.LEFT,
                                            children: [
                                                new TextRun({
                                                    text: `Unigenome  |  ${reportTypeLabel}  |  Project ID: ${data.project_id}`,
                                                    font: "Times New Roman",
                                                    size: 16,
                                                    color: "5B6B7F"
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    borders: {
                                        top: { style: BorderStyle.NONE },
                                        bottom: { style: BorderStyle.SINGLE, size: 4, color: "EDF0F4" },
                                        left: { style: BorderStyle.NONE },
                                        right: { style: BorderStyle.NONE }
                                    },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.RIGHT,
                                            children: [
                                                new TextRun({
                                                    text: `Date: ${data.report_date}`,
                                                    font: "Times New Roman",
                                                    size: 16,
                                                    color: "5B6B7F"
                                                })
                                            ]
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                })
            ]
        });
        const docFooter = new Footer({
            children: [
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 4, color: "EDF0F4" },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE }
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    borders: {
                                        top: { style: BorderStyle.SINGLE, size: 4, color: "EDF0F4" },
                                        bottom: { style: BorderStyle.NONE },
                                        left: { style: BorderStyle.NONE },
                                        right: { style: BorderStyle.NONE }
                                    },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.LEFT,
                                            children: [
                                                new TextRun({
                                                    text: "Confidential - For Internal Use Only",
                                                    font: "Times New Roman",
                                                    size: 16,
                                                    color: "5B6B7F",
                                                    italics: true
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    borders: {
                                        top: { style: BorderStyle.SINGLE, size: 4, color: "EDF0F4" },
                                        bottom: { style: BorderStyle.NONE },
                                        left: { style: BorderStyle.NONE },
                                        right: { style: BorderStyle.NONE }
                                    },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.RIGHT,
                                            children: [
                                                new TextRun({
                                                    text: "Page ",
                                                    font: "Times New Roman",
                                                    size: 16,
                                                    color: "5B6B7F"
                                                }),
                                                new SimpleField("PAGE"),
                                                new TextRun({
                                                    text: " of ",
                                                    font: "Times New Roman",
                                                    size: 16,
                                                    color: "5B6B7F"
                                                }),
                                                new SimpleField("NUMPAGES")
                                            ]
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                })
            ]
        });
        // Build the Word document
        const doc = new Document({
            sections: [{
                    properties: {
                        page: {
                            size: {
                                width: 11906,
                                height: 16838
                            },
                            margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 }
                        },
                        titlePage: true
                    },
                    headers: {
                        default: docHeader
                    },
                    footers: {
                        default: docFooter
                    },
                    children
                }]
        });
        await fs.writeFile(outputPath, await Packer.toBuffer(doc));
    }
}
// ==========================================
// DOCX Styling and Construction Helpers
// ==========================================
function getImageBufferAndType(imageSrc) {
    if (!imageSrc)
        return null;
    if (imageSrc.startsWith('data:')) {
        const match = imageSrc.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (match) {
            const ext = match[1];
            const base64Data = match[2];
            return {
                buffer: Buffer.from(base64Data, 'base64'),
                extension: ext === 'jpeg' ? 'jpg' : ext
            };
        }
    }
    else {
        try {
            if (fs.existsSync(imageSrc)) {
                const ext = path.extname(imageSrc).toLowerCase().slice(1);
                return {
                    buffer: fs.readFileSync(imageSrc),
                    extension: ext === 'jpeg' ? 'jpg' : ext
                };
            }
        }
        catch { }
    }
    return null;
}
function createHeading(text, level, headingNum) {
    const color = level === HeadingLevel.HEADING_1 ? "0F2547" : "2B6CB0";
    const size = level === HeadingLevel.HEADING_1 ? 32 : 24; // 16pt and 12pt
    const spacing = level === HeadingLevel.HEADING_1
        ? { before: 360, after: 180, line: 360 }
        : { before: 240, after: 120, line: 360 };
    const prefix = headingNum ? `${headingNum} ` : '';
    return new Paragraph({
        heading: level,
        spacing,
        keepNext: true,
        border: level === HeadingLevel.HEADING_1 ? {
            bottom: {
                style: BorderStyle.SINGLE,
                size: 8,
                color: "0F2547",
                space: 6
            }
        } : undefined,
        children: [
            new TextRun({
                text: prefix + text,
                bold: true,
                font: "Times New Roman",
                size,
                color
            })
        ]
    });
}
function createCalloutBox(text, title) {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            left: { style: BorderStyle.SINGLE, size: 24, color: "E06D1B" }
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        shading: { fill: "FDF1E7" },
                        margins: { top: 180, bottom: 180, left: 240, right: 240 },
                        children: [
                            ...(title ? [new Paragraph({
                                    children: [new TextRun({ text: title, bold: true, color: "E06D1B", font: "Times New Roman", size: 20 })],
                                    spacing: { after: 120 }
                                })] : []),
                            new Paragraph({
                                children: [new TextRun({ text, font: "Times New Roman", color: "1C2430", size: 20 })]
                            })
                        ]
                    })
                ]
            })
        ]
    });
}
function createStyledTable(headers, rows) {
    const tableRows = [];
    // Header row
    tableRows.push(new TableRow({
        children: headers.map((h) => new TableCell({
            shading: { fill: "0F2547" },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                bottom: { style: BorderStyle.SINGLE, size: 8, color: "0F2547" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
            },
            children: [
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    spacing: { line: 276, after: 60 },
                    children: [new TextRun({ text: h, bold: true, color: "FFFFFF", font: "Times New Roman", size: 24 })]
                })
            ]
        }))
    }));
    // Data rows
    rows.forEach((row, rowIndex) => {
        const isEven = rowIndex % 2 === 1;
        const cells = [];
        for (let cellIndex = 0; cellIndex < headers.length; cellIndex++) {
            const cellText = row[cellIndex] !== undefined ? String(row[cellIndex]) : '';
            const isFirstCol = cellIndex === 0;
            cells.push(new TableCell({
                shading: { fill: isEven ? "FAFBFD" : "FFFFFF" },
                margins: { top: 120, bottom: 120, left: 180, right: 180 },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                    left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                    right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                },
                children: [
                    new Paragraph({
                        spacing: { line: 276, after: 60 },
                        children: [
                            new TextRun({
                                text: cellText,
                                bold: isFirstCol,
                                font: "Times New Roman",
                                size: 24,
                                color: isFirstCol ? "0F2547" : "1C2430"
                            })
                        ]
                    })
                ]
            }));
        }
        tableRows.push(new TableRow({
            children: cells
        }));
    });
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows
    });
}
function createParagraph(text, options = {}) {
    return new Paragraph({
        spacing: {
            line: 360, // 1.5 line spacing
            after: options.spacingAfter ?? 120
        },
        children: [
            new TextRun({
                text,
                bold: options.bold,
                italics: options.italic,
                color: options.color || "1C2430",
                font: "Times New Roman",
                size: 24 // 12pt
            })
        ]
    });
}
function createCoverPage(data, templateName) {
    const elements = [];
    // ── Header row: [Unigenome logo] | [Project ID + Date] | [Unipath logo] ──
    const logoInfo = getImageBufferAndType(data.logo_path);
    const unipathInfo = getImageBufferAndType(data.unipath_logo_path || '');
    const projectDate = data.report_date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const headerCells = [
        // Left: Unigenome logo
        new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            children: logoInfo ? [
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [new ImageRun({ data: logoInfo.buffer, transformation: { width: 140, height: 40 } })]
                })
            ] : [new Paragraph({})]
        }),
        // Center: Project ID + Date
        new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 40 },
                    children: [
                        new TextRun({
                            text: `Project ID: ${data.project_id || ''}`,
                            bold: true,
                            font: "Times New Roman",
                            size: 20,
                            color: "000000"
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: projectDate,
                            bold: true,
                            font: "Times New Roman",
                            size: 20,
                            color: "000000"
                        })
                    ]
                })
            ]
        }),
        // Right: Unipath logo
        new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            children: unipathInfo ? [
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new ImageRun({ data: unipathInfo.buffer, transformation: { width: 130, height: 40 } })]
                })
            ] : [new Paragraph({})]
        })
    ];
    elements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        rows: [new TableRow({ children: headerCells })]
    }));
    // Thin horizontal line under header
    elements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        rows: [new TableRow({ children: [new TableCell({ borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph({ spacing: { after: 80 } })] })] })]
    }));
    elements.push(new Paragraph({ spacing: { after: 2400 } }));
    // Centered Title Block
    const reportTypeLabel = templateName === 'report_interim' ? "Interim Report of" : "Final Report of";
    elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
            new TextRun({
                text: reportTypeLabel,
                bold: true,
                font: "Times New Roman",
                size: 40, // 20pt
                color: "000000"
            })
        ]
    }));
    const serviceText = data.service_type || "Whole Transcriptome Sequencing & Analysis";
    let serviceLines = [serviceText];
    if (serviceText.includes(" & ")) {
        serviceLines = serviceText.split(" & ");
        serviceLines[1] = "& " + serviceLines[1];
    }
    else if (serviceText.includes(" and ")) {
        serviceLines = serviceText.split(" and ");
        serviceLines[1] = "& " + serviceLines[1];
    }
    serviceLines.forEach((line, idx) => {
        elements.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: (idx === serviceLines.length - 1) ? 120 : 60 },
            children: [
                new TextRun({
                    text: line,
                    bold: true,
                    font: "Times New Roman",
                    size: 52, // 26pt
                    color: "000000"
                })
            ]
        }));
    });
    const platformText = data.platform || "Illumina Novaseq X Plus";
    const platformLine = platformText.toLowerCase().includes("platform") ? platformText : `On ${platformText} Platform`;
    elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 1600 },
        children: [
            new TextRun({
                text: platformLine,
                bold: true,
                font: "Times New Roman",
                size: 40, // 20pt
                color: "000000"
            })
        ]
    }));
    // Submitted to Block (Centered, Orange, stacked)
    elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
            new TextRun({
                text: "Submitted to:",
                bold: true,
                font: "Times New Roman",
                size: 28, // 14pt
                color: "E06D1B"
            })
        ]
    }));
    const submittedToName = data.submitted_to || data.client_name || "Dr. Amit Gupta";
    elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
            new TextRun({
                text: submittedToName,
                bold: true,
                font: "Times New Roman",
                size: 32, // 16pt
                color: "E06D1B"
            })
        ]
    }));
    elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
            new TextRun({
                text: data.client_org || "Symbiont Life Sciences",
                bold: true,
                font: "Times New Roman",
                size: 28, // 14pt
                color: "E06D1B"
            })
        ]
    }));
    const showCountry = !data.client_org || data.client_org === "Symbiont Life Sciences";
    if (showCountry) {
        elements.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 1600 },
            children: [
                new TextRun({
                    text: "India",
                    bold: true,
                    font: "Times New Roman",
                    size: 28, // 14pt
                    color: "E06D1B"
                })
            ]
        }));
    }
    else {
        elements.push(new Paragraph({ spacing: { after: 1600 } }));
    }
    // Submitted by Block (Centered, Blue, stacked)
    elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
            new TextRun({
                text: "Submitted by:",
                font: "Times New Roman",
                size: 24, // 12pt
                color: "1F4E78"
            })
        ]
    }));
    elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
            new TextRun({
                text: "Unigenome",
                bold: true,
                font: "Times New Roman",
                size: 28, // 14pt
                color: "1F4E78"
            })
        ]
    }));
    elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
            new TextRun({
                text: "A life sciences division of Unipath Specialty Laboratory Ltd.",
                font: "Times New Roman",
                size: 22, // 11pt
                color: "1F4E78"
            })
        ]
    }));
    elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [
            new TextRun({
                text: "3rd Floor, PASL House | Beside Sahjanand College | Panjara pol, Ambawadi,",
                font: "Times New Roman",
                size: 20,
                color: "1F4E78"
            })
        ]
    }));
    elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [
            new TextRun({
                text: "Ahmedabad – 380015 | Gujarat, India Tel :- +91-79-66197701",
                font: "Times New Roman",
                size: 20,
                color: "1F4E78"
            })
        ]
    }));
    elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 2200 },
        children: [
            new TextRun({
                text: "genomics@unipath.in | www.unigenome.in",
                font: "Times New Roman",
                size: 20, // 10pt
                color: "1F4E78"
            })
        ]
    }));
    // Bottom horizontal divider (gray thin line)
    elements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "D3D3D3" },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE }
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        children: [],
                        borders: {
                            top: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.SINGLE, size: 6, color: "D3D3D3" },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE }
                        }
                    })
                ]
            })
        ]
    }));
    elements.push(new Paragraph({ spacing: { before: 120 } }));
    // Bottom footer block
    elements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE }
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 90, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE }
                        },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.LEFT,
                                children: [
                                    new TextRun({
                                        text: "Unigenome | Confidential Restricted use only",
                                        font: "Times New Roman",
                                        size: 18,
                                        color: "7F8C8D"
                                    })
                                ]
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 10, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE }
                        },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.RIGHT,
                                children: [
                                    new TextRun({
                                        text: "1",
                                        font: "Times New Roman",
                                        size: 18,
                                        color: "7F8C8D",
                                        bold: true
                                    })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    }));
    return elements;
}
//# sourceMappingURL=reportGenerator.js.map