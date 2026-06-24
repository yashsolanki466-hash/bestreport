import fs from 'fs-extra';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
/** Skip loading multi‑GB reference files into a single string (Node string limit ~512MB). */
const MAX_FULL_READ_BYTES = 64 * 1024 * 1024;
function extractAttr(attrs, key) {
    // Try GFF3 format first: key=value; or key=value
    const gff3Pattern = new RegExp(`${key}=([^;]+)`);
    const gff3Match = attrs.match(gff3Pattern);
    if (gff3Match)
        return gff3Match[1].replace(/"/g, '');
    // Fallback to GTF format: key "value";
    const idx = attrs.indexOf(key);
    if (idx === -1)
        return '';
    const firstQuote = attrs.indexOf('"', idx + key.length);
    if (firstQuote === -1)
        return '';
    const secondQuote = attrs.indexOf('"', firstQuote + 1);
    if (secondQuote === -1)
        return '';
    return attrs.substring(firstQuote + 1, secondQuote);
}
/** Stream-count genes/transcripts from GTF/GFF (safe for large annotation files). */
export async function parseGtfStats(gtfPath) {
    const stat = await fs.stat(gtfPath);
    if (stat.size > 5 * 1024 * 1024 * 1024) { // Increased limit to 5GB
        throw new Error(`Annotation file too large to scan (${(stat.size / 1e9).toFixed(1)} GB). Set total_genes in metadata.json.`);
    }
    const genes = new Set();
    const transcripts = new Set();
    let organism = '';
    const features = {};
    const rl = createInterface({
        input: createReadStream(gtfPath, { encoding: 'utf8' }),
        crlfDelay: Infinity
    });
    let lineCount = 0;
    const start = Date.now();
    for await (const line of rl) {
        lineCount++;
        if (lineCount % 100000 === 0) {
            const elapsed = (Date.now() - start) / 1000;
            process.stdout.write(`\r  Parsing annotation: ${lineCount.toLocaleString()} lines... (${elapsed.toFixed(1)}s)`);
        }
        if (!line || line.startsWith('#')) {
            if (line?.startsWith('#')) {
                const orgMatch = line.match(/organism[:\s]+([^\s;]+)/i);
                if (orgMatch)
                    organism = orgMatch[1];
            }
            continue;
        }
        const parts = line.split('\t');
        if (parts.length < 9)
            continue;
        const rawFeature = parts[2]?.trim();
        const feature = rawFeature?.toLowerCase();
        const attrs = parts[8] || '';
        if (rawFeature) {
            features[rawFeature] = (features[rawFeature] || 0) + 1;
        }
        // Support common GFF3/GTF attribute keys
        const geneId = extractAttr(attrs, 'gene_id') || extractAttr(attrs, 'ID') || extractAttr(attrs, 'gene');
        const txId = extractAttr(attrs, 'transcript_id') || extractAttr(attrs, 'ID') || extractAttr(attrs, 'transcript');
        if ((feature === 'gene' || feature === 'locus') && geneId) {
            genes.add(geneId);
        }
        else if (feature === 'transcript' || feature === 'mrna' || feature === 'rna') {
            if (txId)
                transcripts.add(txId);
        }
        else if (geneId && genes.size < 5_000_000) {
            // Fallback: if no explicit 'gene' feature, collect unique gene_ids from all rows
            genes.add(geneId);
        }
    }
    process.stdout.write('\n');
    return {
        geneCount: genes.size || transcripts.size,
        transcriptCount: transcripts.size,
        organism,
        source: gtfPath,
        features
    };
}
/** Count FASTA/FNA sequences and calculate genome stats without loading the whole file. */
export async function getFastaGenomeStats(fastaPath) {
    let total = 0;
    let totalLength = 0;
    let maxLength = 0;
    let currentLength = 0;
    const rl = createInterface({
        input: createReadStream(fastaPath, { encoding: 'utf8' }),
        crlfDelay: Infinity
    });
    for await (const line of rl) {
        if (line.startsWith('>')) {
            if (currentLength > 0) {
                totalLength += currentLength;
                if (currentLength > maxLength)
                    maxLength = currentLength;
                total++;
            }
            currentLength = 0;
        }
        else {
            currentLength += line.trim().length;
        }
    }
    if (currentLength > 0) {
        totalLength += currentLength;
        if (currentLength > maxLength)
            maxLength = currentLength;
        total++;
    }
    return {
        total,
        length: totalLength,
        max: maxLength,
        mean: total > 0 ? Math.round(totalLength / total) : 0
    };
}
/** Count FASTA/FNA sequences by header lines without loading the whole file. */
export async function countFastaSequences(fastaPath) {
    let count = 0;
    const rl = createInterface({
        input: createReadStream(fastaPath, { encoding: 'utf8' }),
        crlfDelay: Infinity
    });
    for await (const line of rl) {
        if (line.startsWith('>'))
            count++;
    }
    return count;
}
/** Pick the best annotation file in the reference folder (prefer .gtf, avoid huge backups). */
export async function findReferenceGtf(refDir) {
    if (!(await fs.pathExists(refDir)))
        return null;
    const entries = await fs.readdir(refDir);
    const candidates = [];
    for (const name of entries) {
        if (!/\.(gtf|gff3?|gff)$/i.test(name))
            continue;
        const fullPath = path.join(refDir, name);
        const stat = await fs.stat(fullPath);
        if (!stat.isFile())
            continue;
        let score = 0;
        if (/\.gtf$/i.test(name))
            score += 10;
        if (/gff3/i.test(name))
            score += 5;
        if (/merged|backup|raw|whole|genome/i.test(name))
            score -= 5;
        candidates.push({ path: fullPath, size: stat.size, score });
    }
    if (candidates.length === 0)
        return null;
    candidates.sort((a, b) => b.score - a.score || a.size - b.size);
    const chosen = candidates[0];
    if (chosen.size > MAX_FULL_READ_BYTES) {
        console.warn(`Using large annotation file (${(chosen.size / 1e6).toFixed(0)} MB); streaming parser will be used.`);
    }
    return chosen.path;
}
export async function findReferenceFasta(refDir) {
    if (!(await fs.pathExists(refDir)))
        return null;
    const entries = await fs.readdir(refDir);
    const fastaFiles = [];
    for (const name of entries) {
        if (!/\.(fasta|fa|fna)$/i.test(name))
            continue;
        const fullPath = path.join(refDir, name);
        const stat = await fs.stat(fullPath);
        if (stat.isFile())
            fastaFiles.push({ path: fullPath, size: stat.size });
    }
    if (fastaFiles.length === 0)
        return null;
    // Sort by size descending: the actual genome is usually the largest FASTA in the folder.
    fastaFiles.sort((a, b) => b.size - a.size);
    return fastaFiles[0].path;
}
//# sourceMappingURL=gtfParser.js.map