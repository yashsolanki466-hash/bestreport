export interface TableData {
    headers: string[];
    rows: string[][];
}
export interface ProjectData {
    project_id: string;
    report_date: string;
    client_name: string;
    client_org: string;
    project_pi: string;
    submitted_to?: string;
    ref_genome_link?: string;
    application: string;
    no_of_samples: string;
    sample_count: number;
    samples: string[];
    qubit_data: Array<{
        sample_id: string;
        conc: string;
        vol: string;
        yield: string;
        remarks: string;
    }>;
    library_sizes: number[];
    sequencing_stats: Array<Record<string, unknown>>;
    reference_organism: string;
    total_genes: number;
    ref_stats: Record<string, unknown>;
    mapping_stats: Array<Record<string, unknown>>;
    total_transcripts: number;
    mean_transcript_size: number;
    assembly_stats: Array<Record<string, unknown>>;
    diff_expr_stats: Array<Record<string, unknown>>;
    dge_chart_labels: string[];
    dge_chart_up: number[];
    dge_chart_down: number[];
    pathway_stats: Array<Record<string, unknown>>;
    go_distribution: Array<Record<string, unknown>>;
    pathway_image_src: string;
    dge_figures: Array<Record<string, unknown>>;
    dge_comparison_table: TableData;
    dge_group_table: TableData;
    func_assets: Record<string, unknown>;
    deliverables_tree: string;
    gffcompare_codes_src: string;
    workflow_figure_src: string;
    stringtie_merge_figure_src: string;
    isoforms_figure_src: string;
    static_content: Record<string, unknown>;
    static_snippets: Record<string, unknown>;
    service_type?: string;
    platform?: string;
    read_length?: string;
    data_throughput?: string;
    sample_type?: string;
    shipping_condition?: string;
    no_of_libraries_prepared?: string;
    gel_image_src?: string;
    lane_mapping?: TableData | null;
    tapestation_images?: Array<{
        sample_id: string;
        src: string;
    }>;
    conclusions?: string[];
    library_kit?: string;
    size_range?: string;
    chemistry?: string;
    pathway_ex_figure_src: string;
    logo_path: string;
    unipath_logo_path?: string;
    warnings: string[];
    qc_issues: string[];
    pca_plots?: Array<{
        src: string;
        title: string;
    }>;
    correlation_plots?: Array<{
        src: string;
        title: string;
    }>;
    metagenome_raw_stats?: Array<Record<string, unknown>>;
    metagenome_feature_summary?: Array<Record<string, unknown>>;
    metagenome_taxonomy_distribution?: TableData | null;
    metagenome_alpha_diversity?: Array<Record<string, unknown>>;
    metagenome_beta_matrix?: TableData | null;
    metagenome_phylum_chart_src?: string;
    metagenome_heatmap_src?: string;
    metagenome_alpha_plot_src?: string;
    metagenome_rarefaction_src?: string;
    metagenome_pcoa_src?: string;
    metagenome_krona_src?: string;
}
export declare function parseProjectData(inputDir: string, metadataOverride?: Record<string, unknown>, templateName?: string): Promise<ProjectData>;
export interface WetLabNotes {
    rna_isolation_qc: string;
    library_preparation: string;
    cluster_generation: string;
    conclusions: string[];
}
export declare function parseWetLabNotes(filePath: string): Promise<WetLabNotes>;
//# sourceMappingURL=dataParser.d.ts.map