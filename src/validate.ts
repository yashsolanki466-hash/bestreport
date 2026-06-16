import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { parseProjectData } from './dataParser.js';
import { validateProjectDirectory } from './utils.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  projectPath: string;
  projectId?: string;
}

export async function validateProject(
  inputDir: string,
  options: { strict?: boolean; parse?: boolean } = {}
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const strict = options.strict ?? false;

  const access = await validateProjectDirectory(inputDir);
  if (!access.valid) {
    return { valid: false, errors: [access.error || 'Invalid directory'], warnings, projectPath: inputDir };
  }

  let readmeExists = false;
  for (const f of ['Readme.txt', 'README.txt', 'readme.txt']) {
    if (await fs.pathExists(path.join(inputDir, f))) {
      readmeExists = true;
      break;
    }
  }
  if (!readmeExists) {
    warnings.push('No Readme.txt found in project root');
  }

  let projectId: string | undefined;
  if (options.parse !== false) {
    try {
      const data = await parseProjectData(inputDir);
      projectId = data.project_id;
      for (const w of data.warnings) {
        if (strict && w.startsWith('Missing required directory:')) {
          errors.push(w);
        } else {
          warnings.push(w);
        }
      }
      if (data.samples.length === 0) {
        warnings.push('No samples detected from raw data spreadsheets');
      }
      if (data.sequencing_stats.length === 0) {
        warnings.push('No sequencing statistics parsed from 01_Raw_Data');
      }
      if (data.diff_expr_stats.length === 0) {
        warnings.push('No DGE comparison statistics found in 05_differential_expression_analysis');
      }
    } catch (e) {
      errors.push(`Parse failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const valid = errors.length === 0;
  return { valid, errors, warnings, projectPath: inputDir, projectId };
}

export function printValidationResult(result: ValidationResult): void {
  console.log(chalk.blue.bold('\nValidation:'), path.basename(result.projectPath));
  if (result.projectId) {
    console.log(chalk.gray(`Project ID: ${result.projectId}`));
  }

  if (result.errors.length) {
    console.log(chalk.red('\nErrors:'));
    result.errors.forEach((e) => console.log(chalk.red(`  ✗ ${e}`)));
  }

  if (result.warnings.length) {
    console.log(chalk.yellow('\nWarnings:'));
    result.warnings.forEach((w) => console.log(chalk.yellow(`  ⚠ ${w}`)));
  }

  if (result.valid && result.errors.length === 0) {
    console.log(chalk.green('\n✓ Project is valid for report generation\n'));
  } else {
    console.log(chalk.red('\n✗ Project validation failed\n'));
  }
}
