export interface FastaAssemblyStats {
    sample: string;
    num_transcripts: number;
    total_bp: number;
    mean_size: number;
    max_size: number;
}
/** Stream-compute transcript count and length stats from a FASTA file. */
export declare function parseFastaAssemblyStats(fastaPath: string): Promise<FastaAssemblyStats>;
//# sourceMappingURL=fastaStats.d.ts.map