#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { ReportGenerator } from './reportGenerator.js';
import { validateProjectDirectory, formatFileSize } from './utils.js';
import { DEFAULT_TEMPLATE, getTemplateDir } from './paths.js';
import { validateProject, printValidationResult } from './validate.js';

const program = new Command();

program
  .name('ngs-report')
  .description('Automated RNA-seq / NGS deliverables report generator (HTML, PDF, DOCX)')
  .version('1.1.0');

program
  .command('generate')
  .alias('g')
  .description('Generate report from a project deliverables directory')
  .requiredOption('-i, --input <path>', 'Input project directory path')
  .option('-o, --output <filename>', 'Output filename without extension', 'report')
  .option('-f, --formats <formats>', 'Output formats: html,pdf,docx', 'html,pdf,docx')
  .option('--project-id <id>', 'Project ID override')
  .option('--pi-name <name>', 'Principal Investigator name override')
  .option('--client-name <name>', 'Client name override')
  .option('--logo <path>', 'Custom logo path')
  .option('--template <name>', 'Template name (without .ejs)', DEFAULT_TEMPLATE)
  .option('--no-embed-images', 'Do not embed images as data URIs before PDF export')
  .option('--headless <boolean>', 'Run Puppeteer headless', 'true')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🧬 NGS Report Generator\n'));

    const inputDir = path.resolve(options.input);
    const validation = await validateProjectDirectory(inputDir);
    if (!validation.valid) {
      console.error(chalk.red('❌'), validation.error);
      process.exit(1);
    }

    const formats = options.formats.split(',').map((f: string) => f.trim().toLowerCase());
    const generator = new ReportGenerator({
      templateDir: getTemplateDir(),
      headless: options.headless === 'true'
    });

    try {
      const result = await generator.generate({
        inputDir,
        outputName: options.output,
        formats,
        metadata: {
          projectId: options.projectId,
          piName: options.piName,
          clientName: options.clientName,
          logo: options.logo
        },
        template: options.template,
        embedImages: options.embedImages !== false
      });

      console.log(chalk.green.bold('\n✅ Report generation complete!\n'));
      result.files.forEach((file) => {
        console.log(chalk.green(`  ✓ ${path.basename(file.path)} (${formatFileSize(file.size)})`));
      });
      console.log(chalk.gray(`\nTotal time: ${result.duration}ms\n`));
    } catch (error) {
      console.error(chalk.red('❌ Error generating report:'), error);
      process.exit(1);
    } finally {
      await generator.close();
    }
  });

program
  .command('validate')
  .alias('v')
  .description('Validate project folder structure and parsed data')
  .requiredOption('-i, --input <path>', 'Project directory path')
  .option('--strict', 'Treat missing required directories as errors')
  .option('--no-parse', 'Only check filesystem layout')
  .action(async (options) => {
    const result = await validateProject(path.resolve(options.input), {
      strict: options.strict,
      parse: options.parse !== false
    });
    printValidationResult(result);
    process.exit(result.valid ? 0 : 1);
  });

program
  .command('batch')
  .alias('b')
  .description('Generate reports for all projects under a root directory')
  .requiredOption('-r, --root <path>', 'Root directory containing project folders')
  .option('-f, --formats <formats>', 'Output formats', 'html,pdf,docx')
  .option('--max-depth <n>', 'Maximum scan depth', '2')
  .option('--template <name>', 'Template name', DEFAULT_TEMPLATE)
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🧬 NGS Batch Report Generator\n'));
    const { batchGenerate } = await import('./batch.js');
    await batchGenerate({
      rootDir: path.resolve(options.root),
      formats: options.formats.split(',').map((f: string) => f.trim()),
      maxDepth: parseInt(options.maxDepth, 10),
      template: options.template
    });
  });

program
  .command('watch')
  .alias('w')
  .description('Watch a directory and auto-generate reports for new projects')
  .requiredOption('-r, --root <path>', 'Directory to watch')
  .option('-f, --formats <formats>', 'Output formats', 'html,pdf,docx')
  .option('--template <name>', 'Template name', DEFAULT_TEMPLATE)
  .action(async (options) => {
    console.log(chalk.blue.bold('\n👁️  NGS Report Watcher\n'));
    const { startWatcher } = await import('./watch.js');
    await startWatcher({
      rootDir: path.resolve(options.root),
      formats: options.formats.split(',').map((f: string) => f.trim()),
      template: options.template
    });
  });

program
  .command('gui')
  .description('Start the wet lab GUI web server')
  .option('-p, --port <number>', 'Server port', '5173')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🖥️  NGS Report GUI Server\n'));
    const { createServer } = await import('vite');
    const { PACKAGE_ROOT } = await import('./paths.js');
    try {
      const server = await createServer({
        configFile: path.resolve(PACKAGE_ROOT, 'vite.config.ts'),
        server: { port: parseInt(options.port, 10) }
      });
      await server.listen();
      server.printUrls();
    } catch (error) {
      console.error(chalk.red('Error starting GUI server:'), error);
      process.exit(1);
    }
  });

program.parse();
