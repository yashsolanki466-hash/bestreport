import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Root of the ngs-report-cli package (parent of dist/ or src/). */
export const PACKAGE_ROOT = path.join(__dirname, '..');

/** Dedicated folder that houses all interim-specific app source files. */
export const INTERIM_APP_DIR = path.join(PACKAGE_ROOT, 'interim_app');

export const DEFAULT_TEMPLATE = 'report_comprehensive';

export function getTemplateDir(): string {
  return path.join(PACKAGE_ROOT, 'templates');
}

/**
 * Returns the directory that contains report_interim.ejs.
 * Prefers interim_app/templates/ if it exists (canonical location),
 * falls back to the shared templates/ folder.
 */
export function getInterimTemplateDir(): string {
  const interimDir = path.join(INTERIM_APP_DIR, 'templates');
  if (fs.existsSync(interimDir)) return interimDir;
  return path.join(PACKAGE_ROOT, 'templates');
}

export function getConfigPath(): string {
  return path.join(PACKAGE_ROOT, 'config.yaml');
}

export function getStaticContentPath(): string {
  return path.join(PACKAGE_ROOT, 'report_static_content.json');
}

export function getComponentsDir(): string {
  return path.join(PACKAGE_ROOT, 'components');
}

export function getAssetsDir(): string {
  return path.join(PACKAGE_ROOT, 'assets');
}

/**
 * Returns the canonical wet_lab_notes.docx path.
 * When called from an interim project folder, prefers the file inside that folder.
 * Otherwise falls back to interim_app/wet_lab_notes.docx, then root wet_lab_notes.docx.
 */
export function getWetLabNotesDocx(projectDir?: string): string {
  if (projectDir) {
    const local = path.join(projectDir, 'wet_lab_notes.docx');
    if (fs.existsSync(local)) return local;
  }
  const interimDefault = path.join(INTERIM_APP_DIR, 'wet_lab_notes.docx');
  if (fs.existsSync(interimDefault)) return interimDefault;
  return path.join(PACKAGE_ROOT, 'wet_lab_notes.docx');
}

