import chokidar from 'chokidar';
import path from 'path';
import chalk from 'chalk';
import { ReportGenerator } from './reportGenerator.js';
import { validateProjectDirectory } from './utils.js';
import { DEFAULT_TEMPLATE, getTemplateDir } from './paths.js';

interface WatchOptions {
  rootDir: string;
  formats: string[];
  template?: string;
}

const processedProjects = new Set<string>();

export async function startWatcher(options: WatchOptions): Promise<void> {
  const generator = new ReportGenerator({
    templateDir: getTemplateDir(),
    headless: true
  });

  const template = options.template || DEFAULT_TEMPLATE;
  console.log(chalk.blue(`Watching ${options.rootDir} (template: ${template})`));
  console.log(chalk.gray('Press Ctrl+C to stop\n'));

  await scanAndProcess(options.rootDir, generator, options.formats, template);

  const watcher = chokidar.watch(options.rootDir, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    depth: 3,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 }
  });

  watcher
    .on('addDir', async (dirPath) => {
      if (processedProjects.has(dirPath)) return;
      const validation = await validateProjectDirectory(dirPath);
      if (validation.valid) {
        await processProject(dirPath, generator, options.formats, template);
      }
    })
    .on('add', async (filePath) => {
      if (!path.basename(filePath).toLowerCase().includes('readme')) return;
      const dirPath = path.dirname(filePath);
      if (processedProjects.has(dirPath)) return;
      const validation = await validateProjectDirectory(dirPath);
      if (validation.valid) {
        await processProject(dirPath, generator, options.formats, template);
      }
    })
    .on('error', (error) => console.error(chalk.red('Watcher error:'), error));

  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nStopping watcher...'));
    await watcher.close();
    await generator.close();
    process.exit(0);
  });

  await new Promise(() => {});
}

async function scanAndProcess(
  rootDir: string,
  generator: ReportGenerator,
  formats: string[],
  template: string
): Promise<void> {
  const { findProjects } = await import('./utils.js');
  const projects = await findProjects(rootDir, 2);
  for (const project of projects) {
    if (!processedProjects.has(project)) {
      await processProject(project, generator, formats, template);
    }
  }
}

async function processProject(
  projectPath: string,
  generator: ReportGenerator,
  formats: string[],
  template: string
): Promise<void> {
  const projectName = path.basename(projectPath);
  console.log(chalk.blue(`\n🔄 Processing: ${projectName}`));

  try {
    const result = await generator.generate({
      inputDir: projectPath,
      outputName: `${projectName}_report`,
      formats,
      template,
      embedImages: true
    });
    processedProjects.add(projectPath);
    console.log(chalk.green(`✅ Generated ${result.files.length} file(s)`));
    result.files.forEach((f) => console.log(chalk.gray(`   ${path.basename(f.path)}`)));
  } catch (error) {
    console.error(chalk.red(`❌ Failed: ${projectName}`), error);
  }
}
