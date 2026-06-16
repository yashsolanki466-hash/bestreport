export interface AppConfig {
    column_mapping: {
        raw_stats: Record<string, string[]>;
        mapping_stats: Record<string, string[]>;
        assembly_stats: Record<string, string[]>;
        dge_stats: Record<string, string[]>;
        pathway_stats: Record<string, string[]>;
    };
    optional_directory_groups?: Record<string, string[]>;
    qc_thresholds: {
        mapping_rate: number;
        q30_rate: number;
        min_reads: number;
    };
    dge_thresholds: {
        fdr: number;
        log2fc: number;
    };
    required_directories: string[];
    notifications: {
        enabled: boolean;
        webhook_url: string;
    };
}
export declare function loadConfig(): Promise<AppConfig>;
export declare function resetConfigCache(): void;
//# sourceMappingURL=config.d.ts.map