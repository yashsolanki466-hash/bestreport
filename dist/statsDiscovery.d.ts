export declare function resolvePathCaseInsensitive(baseDir: string, relPath: string): Promise<string | null>;
/** Locate a stats spreadsheet under common deliverable layouts. */
export declare function findStatsWorkbook(inputDir: string, matchers: RegExp[], searchDirs: string[]): Promise<string | null>;
export declare const RAW_STATS_DIRS: string[];
export declare const RAW_STATS_PATTERNS: RegExp[];
export declare const MAPPING_STATS_DIRS: string[];
export declare const MAPPING_STATS_PATTERNS: RegExp[];
export declare const ASSEMBLY_STATS_DIRS: string[];
export declare const ASSEMBLY_STATS_PATTERNS: RegExp[];
//# sourceMappingURL=statsDiscovery.d.ts.map