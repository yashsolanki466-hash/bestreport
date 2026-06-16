export interface GtfStats {
    geneCount: number;
    transcriptCount: number;
    organism: string;
    source: string;
}
/** Stream-count genes/transcripts from GTF/GFF (safe for large annotation files). */
export declare function parseGtfStats(gtfPath: string): Promise<GtfStats>;
/** Count FASTA/FNA sequences and calculate genome stats without loading the whole file. */
export declare function getFastaGenomeStats(fastaPath: string): Promise<{
    total: number;
    length: number;
    max: number;
    mean: number;
}>;
/** Count FASTA/FNA sequences by header lines without loading the whole file. */
export declare function countFastaSequences(fastaPath: string): Promise<number>;
/** Pick the best annotation file in the reference folder (prefer .gtf, avoid huge backups). */
export declare function findReferenceGtf(refDir: string): Promise<string | null>;
export declare function findReferenceFasta(refDir: string): Promise<string | null>;
//# sourceMappingURL=gtfParser.d.ts.map