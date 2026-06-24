import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
/** Stream-compute transcript count and length stats from a FASTA file. */
export async function parseFastaAssemblyStats(fastaPath) {
    const sample = path.basename(fastaPath, path.extname(fastaPath))
        .replace(/Aligned_transcript$/i, '')
        .replace(/_transcript$/i, '')
        .replace(/\.fasta$/i, '') || path.basename(fastaPath);
    let num_transcripts = 0;
    let total_bp = 0;
    let max_size = 0;
    let currentLen = 0;
    const rl = createInterface({
        input: createReadStream(fastaPath, { encoding: 'utf8' }),
        crlfDelay: Infinity
    });
    for await (const line of rl) {
        if (line.startsWith('>')) {
            if (currentLen > 0) {
                num_transcripts++;
                total_bp += currentLen;
                if (currentLen > max_size) {
                    max_size = currentLen;
                }
            }
            currentLen = 0;
        }
        else {
            currentLen += line.trim().length;
        }
    }
    if (currentLen > 0) {
        num_transcripts++;
        total_bp += currentLen;
        if (currentLen > max_size) {
            max_size = currentLen;
        }
    }
    return {
        sample,
        num_transcripts,
        total_bp,
        mean_size: num_transcripts > 0 ? Math.round(total_bp / num_transcripts) : 0,
        max_size
    };
}
//# sourceMappingURL=fastaStats.js.map