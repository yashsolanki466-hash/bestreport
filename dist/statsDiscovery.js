import fs from 'fs-extra';
import path from 'path';
export async function resolvePathCaseInsensitive(baseDir, relPath) {
    const parts = relPath.split(/[/\\]/);
    let current = baseDir;
    for (const part of parts) {
        if (!part)
            continue;
        try {
            if (!(await fs.pathExists(current)))
                return null;
            const entries = await fs.readdir(current);
            const partLower = part.toLowerCase();
            const match = entries.find(e => e.toLowerCase() === partLower);
            if (!match)
                return null;
            current = path.join(current, match);
        }
        catch {
            return null;
        }
    }
    return current;
}
/** Locate a stats spreadsheet under common deliverable layouts. */
export async function findStatsWorkbook(inputDir, matchers, searchDirs) {
    for (const rel of searchDirs) {
        let dir = rel;
        if (!path.isAbsolute(rel)) {
            const resolved = await resolvePathCaseInsensitive(inputDir, rel);
            if (!resolved)
                continue;
            dir = resolved;
        }
        else {
            if (!(await fs.pathExists(dir)))
                continue;
        }
        let entries = [];
        try {
            if ((await fs.stat(dir)).isFile() && /\.(xlsx|xls|csv)$/i.test(dir)) {
                return dir;
            }
            entries = await fs.readdir(dir);
        }
        catch {
            continue;
        }
        for (const name of entries) {
            if (!/\.(xlsx|xls|csv)$/i.test(name))
                continue;
            if (matchers.some((re) => re.test(name))) {
                return path.join(dir, name);
            }
        }
    }
    return null;
}
export const RAW_STATS_DIRS = ['01_Raw_Data', '.'];
export const RAW_STATS_PATTERNS = [/raw.*stat/i, /stat.*raw/i, /^raw_stats/i];
export const MAPPING_STATS_DIRS = ['03_Mapping', '01_Raw_Data', '.'];
export const MAPPING_STATS_PATTERNS = [/^mapping/i, /map.*stat/i, /star.*stat/i];
export const ASSEMBLY_STATS_DIRS = [
    '04_transcript_assembly_gtf',
    '03_transcript_assembly_gtf',
    '04_transcript_sequences_fasta',
    '03_Mapping'
];
export const ASSEMBLY_STATS_PATTERNS = [/assembly/i, /stringtie/i, /transcript.*stat/i];
//# sourceMappingURL=statsDiscovery.js.map