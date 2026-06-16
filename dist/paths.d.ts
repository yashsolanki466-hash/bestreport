/** Root of the ngs-report-cli package (parent of dist/ or src/). */
export declare const PACKAGE_ROOT: string;
/** Dedicated folder that houses all interim-specific app source files. */
export declare const INTERIM_APP_DIR: string;
export declare const DEFAULT_TEMPLATE = "report_comprehensive";
export declare function getTemplateDir(): string;
/**
 * Returns the directory that contains report_interim.ejs.
 * Prefers interim_app/templates/ if it exists (canonical location),
 * falls back to the shared templates/ folder.
 */
export declare function getInterimTemplateDir(): string;
export declare function getConfigPath(): string;
export declare function getStaticContentPath(): string;
export declare function getComponentsDir(): string;
export declare function getAssetsDir(): string;
/**
 * Returns the canonical wet_lab_notes.docx path.
 * When called from an interim project folder, prefers the file inside that folder.
 * Otherwise falls back to interim_app/wet_lab_notes.docx, then root wet_lab_notes.docx.
 */
export declare function getWetLabNotesDocx(projectDir?: string): string;
//# sourceMappingURL=paths.d.ts.map