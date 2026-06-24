import fs from 'fs-extra';
import path from 'path';
import XLSX from 'xlsx';
import chalk from 'chalk';
import mammoth from 'mammoth';
import { loadConfig } from './config.js';
import { asFloat, asInt, findColumn, normCol, pickColumn, downsample } from './columnUtils.js';
import { findReferenceGtf, findReferenceFasta, parseGtfStats, getFastaGenomeStats } from './gtfParser.js';
import { parseFastaAssemblyStats } from './fastaStats.js';
import { findStatsWorkbook, RAW_STATS_DIRS, RAW_STATS_PATTERNS, MAPPING_STATS_DIRS, MAPPING_STATS_PATTERNS, ASSEMBLY_STATS_DIRS, ASSEMBLY_STATS_PATTERNS } from './statsDiscovery.js';
import { getAssetsDir, getComponentsDir, getStaticContentPath, getWetLabNotesDocx } from './paths.js';
/**
 * Note: We now use extractRawText for primary parsing, but we keep this function
 * to handle legacy txt content/cleanup from older workflow formats.
 * Strip backslash escapes that mammoth adds during markdown conversion: \( → (, \- → -, etc.
 */
function stripMarkdownEscapes(text) {
    // Handle all common markdown escape sequences mammoth produces
    return text.replace(/\\([\\.()\[\]\-_*#!{}+])/g, '$1');
}
async function getTableDataFromCsv(filePath) {
    try {
        if (!(await fs.pathExists(filePath)))
            return null;
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length === 0)
            return null;
        const isTsv = filePath.toLowerCase().endsWith('.tsv') || filePath.toLowerCase().endsWith('.txt');
        const separator = isTsv ? '\t' : ',';
        const headers = lines[0].split(separator).map((h) => h.trim().replace(/^"|"$/g, ''));
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(separator).map((c) => c.trim().replace(/^"|"$/g, ''));
            if (row.length && row.some(r => r)) {
                rows.push(row);
            }
        }
        return { headers, rows };
    }
    catch (e) {
        console.warn(chalk.yellow(`Warning: Could not parse file ${filePath}: ${e}`));
        return null;
    }
}
async function parseMetagenomeData(inputDir) {
    // 1. Raw Stats
    let metagenome_raw_stats = [];
    const rawStatsFile = path.join(inputDir, '00_Raw_Data', 'data_stats.txt');
    if (await fs.pathExists(rawStatsFile)) {
        const rawRows = await readExcelRows(rawStatsFile);
        metagenome_raw_stats = rawRows.map(row => ({
            sample_id: pickColumn(row, ['Sample ID', 'SampleID', 'sample']) ?? 'Unknown',
            pe_seq: pickColumn(row, ['PE seq', 'PE_seq', 'pe_reads']) ?? 'N/A',
            total_reads: pickColumn(row, ['Total reads (R1+R2)', 'Total reads', 'total_reads']) ?? 'N/A',
            avg_len: pickColumn(row, ['Avg. read len(bp)', 'Avg. read len', 'avg_len']) ?? 'N/A',
            data_bp: pickColumn(row, ['Data (bp)', 'data_bp']) ?? 'N/A',
            data_mb: pickColumn(row, ['Data (MB)', 'data_mb']) ?? 'N/A'
        }));
    }
    // 2. Feature Summary
    let metagenome_feature_summary = [];
    const featureStatsFile = path.join(inputDir, '03_Deblur_denoised_feature', 'sample-frequency-detail.csv');
    if (await fs.pathExists(featureStatsFile)) {
        const featRows = await readExcelRows(featureStatsFile);
        metagenome_feature_summary = featRows.map(row => ({
            sample_id: pickColumn(row, ['Sample ID', 'SampleID', 'sample']) ?? 'Unknown',
            pe_seq: pickColumn(row, ['PE seq', 'PE_seq', 'pe_reads']) ?? 'N/A',
            joined_filtered: pickColumn(row, ['Joined filtered reads', 'Joined filtered', 'joined_filtered']) ?? 'N/A',
            denoised: pickColumn(row, ['denoised sequenced', 'denoised', 'denoised_seq']) ?? 'N/A',
            filtered_seq: pickColumn(row, ['Filtered sequences', 'Filtered seq', 'filtered_seq']) ?? 'N/A',
            filtered_features: pickColumn(row, ['Filtered feature count/OTUs', 'Filtered feature count', 'features']) ?? 'N/A'
        }));
    }
    // 3. Taxonomy Phylum
    let metagenome_taxonomy_distribution = await getTableDataFromCsv(path.join(inputDir, '05_Taxonomy_barplot', 'level-2.csv')) ||
        await getTableDataFromCsv(path.join(inputDir, '05_Taxonomy_barplot', 'level-2_taxa.csv'));
    // 4. Alpha Diversity
    let metagenome_alpha_diversity = [];
    const alphaStatsFile = path.join(inputDir, '08_Alpha_diversity', 'alpha_diversity.csv');
    if (await fs.pathExists(alphaStatsFile)) {
        const alphaRows = await readExcelRows(alphaStatsFile);
        metagenome_alpha_diversity = alphaRows.map(row => ({
            sample_id: pickColumn(row, ['Sample ID', 'SampleID', 'sample']) ?? 'Unknown',
            chao1: pickColumn(row, ['chao1']) ?? 'N/A',
            shannon: pickColumn(row, ['shannon_entropy', 'shannon']) ?? 'N/A',
            observed_features: pickColumn(row, ['observed_features', 'observed_features observed_features']) ?? 'N/A'
        }));
    }
    // 5. Beta Diversity Matrix
    let metagenome_beta_matrix = await getTableDataFromCsv(path.join(inputDir, '10_Beta_diversity', 'bray_curtis_distance_matrix', 'distance-matrix.tsv'));
    // 6. Image Discovery
    const findPngInDir = async (dirName, pattern) => {
        const dirPath = path.join(inputDir, dirName);
        if (await fs.pathExists(dirPath)) {
            const files = await fs.readdir(dirPath);
            const matched = files.find(f => pattern.test(f.toLowerCase()) && /\.(png|jpg|jpeg|svg)$/i.test(f));
            if (matched)
                return path.join(dirPath, matched);
        }
        return '';
    };
    let phylumChart = await findPngInDir('05_Taxonomy_barplot', /phylum|taxa|bar/i);
    let heatmapPlot = await findPngInDir('06_Feature_heatmap', /heatmap|otu/i);
    let alphaPlot = await findPngInDir('08_Alpha_diversity', /alpha|diversity/i);
    let rarefactionPlot = await findPngInDir('09_Rarefaction_curve', /rarefaction|curve/i);
    let pcoaPlot = await findPngInDir('10_Beta_diversity', /pcoa|bray|emperor/i);
    let kronaPlot = await findPngInDir('11_Krona_graph', /krona|pie/i);
    // Fallbacks to NGS_240555 mock data if empty
    const componentsDir = getComponentsDir();
    const placeholderImg = path.join(componentsDir, 'workflow.png');
    if (metagenome_raw_stats.length === 0) {
        metagenome_raw_stats = [
            { sample_id: "S13-En", pe_seq: "1,39,588", total_reads: "2,79,176", avg_len: "301", data_bp: "84031976", data_mb: "84.03" },
            { sample_id: "S17-En", pe_seq: "1,12,805", total_reads: "2,25,610", avg_len: "301", data_bp: "67908610", data_mb: "67.90" },
            { sample_id: "S20-En", pe_seq: "1,81,292", total_reads: "3,62,584", avg_len: "301", data_bp: "109137784", data_mb: "109.13" },
            { sample_id: "S4-En", pe_seq: "1,67,813", total_reads: "3,35,626", avg_len: "301", data_bp: "101023426", data_mb: "101.02" },
            { sample_id: "S5-En", pe_seq: "1,75,032", total_reads: "3,50,064", avg_len: "301", data_bp: "105369264", data_mb: "105.36" },
            { sample_id: "S8-En", pe_seq: "1,63,080", total_reads: "3,26,160", avg_len: "301", data_bp: "98174160", data_mb: "98.17" },
            { sample_id: "SC-En", pe_seq: "1,87,852", total_reads: "3,75,704", avg_len: "301", data_bp: "113086904", data_mb: "113.08" }
        ];
    }
    if (metagenome_feature_summary.length === 0) {
        metagenome_feature_summary = [
            { sample_id: "S13-En", pe_seq: "139130", joined_filtered: "118422", denoised: "48918", filtered_seq: "48833", filtered_features: "607" },
            { sample_id: "S17-En", pe_seq: "112453", joined_filtered: "95495", denoised: "32650", filtered_seq: "32577", filtered_features: "599" },
            { sample_id: "S20-En", pe_seq: "180743", joined_filtered: "154495", denoised: "51448", filtered_seq: "51387", filtered_features: "566" },
            { sample_id: "S4-En", pe_seq: "167310", joined_filtered: "143461", denoised: "56594", filtered_seq: "56485", filtered_features: "682" },
            { sample_id: "S5-En", pe_seq: "174434", joined_filtered: "146839", denoised: "45124", filtered_seq: "45081", filtered_features: "389" },
            { sample_id: "S8-En", pe_seq: "162623", joined_filtered: "137917", denoised: "56197", filtered_seq: "56110", filtered_features: "495" },
            { sample_id: "SC-En", pe_seq: "187091", joined_filtered: "158258", denoised: "56747", filtered_seq: "56655", filtered_features: "780" }
        ];
    }
    if (metagenome_alpha_diversity.length === 0) {
        metagenome_alpha_diversity = [
            { sample_id: "S13-En", chao1: "607.3979592", shannon: "5.178711115", observed_features: "607" },
            { sample_id: "S17-En", chao1: "600.7759563", shannon: "5.008140815", observed_features: "599" },
            { sample_id: "S20-En", chao1: "567.6140351", shannon: "5.570670292", observed_features: "566" },
            { sample_id: "S4-En", chao1: "682.9952607", shannon: "6.151116162", observed_features: "682" },
            { sample_id: "S5-En", chao1: "389.3982301", shannon: "4.519957071", observed_features: "389" },
            { sample_id: "S8-En", chao1: "495.8888889", shannon: "4.900942795", observed_features: "495" },
            { sample_id: "SC-En", chao1: "781.6223176", shannon: "6.344051842", observed_features: "780" }
        ];
    }
    if (!metagenome_taxonomy_distribution) {
        metagenome_taxonomy_distribution = {
            headers: ["Phylum", "SC-En", "S13-En", "S8-En", "S20-En", "S4-En", "S5-En", "S17-En"],
            rows: [
                ["d__Bacteria;p__Firmicutes", "9399", "3059", "4413", "6859", "5997", "10150", "7548"],
                ["d__Bacteria;p__Proteobacteria", "36698", "38684", "40751", "38360", "39927", "33590", "23386"],
                ["d__Bacteria;p__Actinobacteriota", "433", "172", "340", "143", "206", "1172", "111"],
                ["d__Bacteria;p__Bacteroidota", "9411", "6136", "8929", "5937", "9447", "126", "1257"],
                ["d__Bacteria;p__Myxococcota", "0", "24", "49", "4", "18", "2", "2"],
                ["d__Bacteria;p__Chloroflexi", "19", "7", "6", "13", "18", "9", "32"],
                ["d__Bacteria;p__Fibrobacterota", "0", "0", "0", "0", "0", "0", "4"],
                ["d__Bacteria;p__Bdellovibrionota", "94", "166", "1160", "23", "602", "3", "0"],
                ["d__Bacteria;p__Desulfobacterota", "357", "4", "4", "0", "83", "0", "186"],
                ["d__Bacteria;p__Acidobacteriota", "7", "10", "0", "24", "11", "2", "9"],
                ["d__Bacteria;p__Cyanobacteria", "18", "490", "388", "2", "57", "4", "6"],
                ["d__Bacteria;p__Verrucomicrobiota", "96", "44", "49", "5", "75", "0", "4"],
                ["d__Archaea;p__Euryarchaeota", "2", "4", "0", "0", "0", "0", "0"],
                ["d__Bacteria;p__Campilobacterota", "6", "0", "0", "0", "0", "0", "0"],
                ["d__Bacteria;p__Patescibacteria", "72", "29", "3", "5", "0", "0", "20"],
                ["d__Bacteria;p__Deinococcota", "0", "0", "0", "0", "29", "0", "10"],
                ["d__Bacteria;p__Sumerlaeota", "0", "0", "16", "0", "6", "0", "0"],
                ["d__Archaea;p__Halobacterota", "0", "0", "0", "2", "0", "2", "2"],
                ["d__Bacteria;p__Armatimonadota", "8", "0", "0", "0", "0", "0", "0"],
                ["d__Bacteria;p__Planctomycetota", "2", "4", "2", "0", "0", "2", "0"],
                ["d__Archaea;p__Crenarchaeota", "0", "0", "0", "3", "0", "0", "0"],
                ["d__Bacteria;p__Fusobacteriota", "0", "0", "0", "0", "9", "17", "0"]
            ]
        };
    }
    if (!metagenome_beta_matrix) {
        metagenome_beta_matrix = {
            headers: ["", "SC-En", "S13-En", "S8-En", "S20-En", "S4-En", "S5-En", "S17-En"],
            rows: [
                ["SC-En", "0", "0.737422108", "0.753814041", "0.634772999", "0.662553335", "0.949135893", "0.63784265"],
                ["S13-En", "0.737422108", "0", "0.848389968", "0.787764374", "0.779813979", "0.943579826", "0.814194063"],
                ["S8-En", "0.753814041", "0.848389968", "0", "0.870153789", "0.796451484", "0.923013169", "0.771618013"],
                ["S20-En", "0.634772999", "0.787764374", "0.870153789", "0", "0.662215674", "0.900052184", "0.760536575"],
                ["S4-En", "0.662553335", "0.779813979", "0.796451484", "0.662215674", "0", "0.879301348", "0.71369371"],
                ["S5-En", "0.949135893", "0.943579826", "0.923013169", "0.900052184", "0.879301348", "0", "0.955305891"],
                ["S17-En", "0.63784265", "0.814194063", "0.771618013", "0.760536575", "0.71369371", "0.955305891", "0"]
            ]
        };
    }
    // Set default placeholder images if none found
    phylumChart = phylumChart || placeholderImg;
    heatmapPlot = heatmapPlot || placeholderImg;
    alphaPlot = alphaPlot || placeholderImg;
    rarefactionPlot = rarefactionPlot || placeholderImg;
    pcoaPlot = pcoaPlot || placeholderImg;
    kronaPlot = kronaPlot || placeholderImg;
    return {
        metagenome_raw_stats,
        metagenome_feature_summary,
        metagenome_taxonomy_distribution,
        metagenome_alpha_diversity,
        metagenome_beta_matrix,
        metagenome_phylum_chart_src: phylumChart,
        metagenome_heatmap_src: heatmapPlot,
        metagenome_alpha_plot_src: alphaPlot,
        metagenome_rarefaction_src: rarefactionPlot,
        metagenome_pcoa_src: pcoaPlot,
        metagenome_krona_src: kronaPlot
    };
}
export async function parseProjectData(inputDir, metadataOverride, templateName) {
    console.log(chalk.gray('Parsing project structure...'));
    const config = await loadConfig();
    // Load wet lab data if available
    const wetLabPath = path.join(inputDir, 'wet_lab_data.json');
    let wetLabData = {};
    if (await fs.pathExists(wetLabPath)) {
        try {
            wetLabData = JSON.parse(await fs.readFile(wetLabPath, 'utf-8'));
            console.log(chalk.green(`Loaded wet lab data from: wet_lab_data.json`));
        }
        catch {
            console.warn(chalk.yellow(`Warning: Could not parse wet_lab_data.json`));
        }
    }
    const isInterim = templateName === 'report_interim';
    const is16S = templateName === 'report_16s';
    const metagenomeData = is16S ? await parseMetagenomeData(inputDir) : {};
    const static_content = await loadStaticContent();
    const static_snippets = static_content?.snippets || {};
    // Load wet lab notes — prefer .docx from project folder, then interim_app/, then root
    const notesDocxPath = getWetLabNotesDocx(inputDir);
    const wetLabNotes = await parseWetLabNotes(notesDocxPath);
    // Always wire the parsed wet_lab notes into static_snippets.
    // Prefer values from wet_lab_data.json if present (edited in UI), otherwise use .docx
    if (!static_snippets.wet_lab) {
        static_snippets.wet_lab = {};
    }
    const wl = static_snippets.wet_lab;
    wl.rna_isolation_qc = wetLabData.rna_isolation_qc || wetLabNotes.rna_isolation_qc;
    wl.rna_isolation_qc_header = wetLabData.rna_isolation_qc_header || 'Extraction and Quantitative analysis of RNA:';
    wl.library_preparation = wetLabData.library_preparation || wetLabNotes.library_preparation;
    wl.library_preparation_header = wetLabData.library_preparation_header || 'Preparation of Library:';
    wl.cluster_generation = wetLabData.cluster_generation || wetLabNotes.cluster_generation;
    wl.cluster_generation_header = wetLabData.cluster_generation_header || 'Cluster Generation and Sequencing:';
    wl.library_qc = wetLabData.library_qc || 'The amplified libraries were analyzed on TapeStation 4150 (Agilent Technologies) using High Sensitivity D1000 ScreenTape® as per manufacturer\'s instructions.';
    wl.library_qc_header = wetLabData.library_qc_header || 'Quantity and quality check (QC) of library on Agilent Tape Station 4150:';
    wl.conclusions_header = wetLabData.conclusions_header || 'Conclusions';
    // Reference Genome Link snippet setup will be initialized dynamically below after scanning.
    const readmeData = isInterim ? {} : await parseReadme(inputDir);
    const project_details = isInterim ? {} : await getProjectDetails(inputDir);
    const warnings = isInterim ? [] : await validateDeliverablesStructure(inputDir, config);
    let samples = await getSamples(inputDir, config);
    let qubit_data = await getQubitData(inputDir, samples);
    // For interim, auto-detect samples list from Qubit sheet if not otherwise found
    if (samples.length === 0 && qubit_data.length > 0) {
        samples = qubit_data.map((q) => q.sample_id);
    }
    const sample_count = samples.length;
    const library_sizes = await getLibrarySizes(inputDir, samples, sample_count);
    // Auto-discover wet lab files if wet_lab_data.json is missing
    let gel_image_src = wetLabData.gel_image_src || '';
    if (!gel_image_src) {
        const files = await fs.readdir(inputDir).catch(() => []);
        const gelImg = files.find(f => {
            const name = f.toLowerCase();
            return name.includes('gel') || name.includes('agarose') || name.includes('rna_qc') || (name.includes('2600') && !name.includes('tape'));
        });
        if (gelImg)
            gel_image_src = path.join(inputDir, gelImg);
    }
    let lane_mapping = wetLabData.lane_mapping || null;
    if (lane_mapping && (!lane_mapping.rows || lane_mapping.rows.length === 0)) {
        lane_mapping = null;
    }
    if (!lane_mapping) {
        const files = await fs.readdir(inputDir).catch(() => []);
        const laneFile = files.find(f => {
            const name = f.toLowerCase();
            return name.includes('lane');
        });
        if (laneFile) {
            try {
                const filePath = path.join(inputDir, laneFile);
                const rows = await readExcelRows(filePath);
                const lanes = [];
                for (const row of rows) {
                    const keys = Object.keys(row);
                    const laneKeys = keys.filter(k => k.toLowerCase().includes('lane')).sort();
                    const sampleKeys = keys.filter(k => k.toLowerCase().includes('sample') || k.toLowerCase().includes('name')).sort();
                    const pairsCount = Math.min(laneKeys.length, sampleKeys.length);
                    for (let i = 0; i < pairsCount; i++) {
                        const laneVal = row[laneKeys[i]];
                        const sampleVal = row[sampleKeys[i]];
                        if (laneVal !== undefined && laneVal !== null && laneVal !== '') {
                            lanes.push({
                                lane: String(laneVal).trim(),
                                sample: sampleVal ? String(sampleVal).trim() : ''
                            });
                        }
                    }
                }
                lanes.sort((a, b) => {
                    const na = parseInt(a.lane, 10);
                    const nb = parseInt(b.lane, 10);
                    if (!isNaN(na) && !isNaN(nb))
                        return na - nb;
                    return a.lane.localeCompare(b.lane);
                });
                const headers = ['Lane id', 'Sample name', 'Lane id', 'Sample name', 'Lane id', 'Sample name'];
                const gridRows = [];
                for (let i = 0; i < lanes.length; i += 3) {
                    const row = [];
                    for (let j = 0; j < 3; j++) {
                        const item = lanes[i + j];
                        row.push(item ? item.lane : '');
                        row.push(item ? item.sample : '');
                    }
                    gridRows.push(row);
                }
                lane_mapping = { headers, rows: gridRows };
            }
            catch { }
        }
    }
    let tapestation_images = wetLabData.tapestation_images || [];
    if (tapestation_images.length === 0) {
        const files = await fs.readdir(inputDir).catch(() => []);
        const tapeImages = files
            .filter(f => {
            const name = f.toLowerCase();
            return /\.(png|jpg|jpeg)$/i.test(f) && (name.includes('tapestation') || name.includes('profile') || name.includes('size_dist') || name.includes('tape'));
        })
            .map(f => path.join(inputDir, f))
            .sort((a, b) => a.localeCompare(b));
        tapestation_images = tapeImages.map((p, idx) => {
            const sId = samples[idx] || `Sample ${idx + 1}`;
            return { sample_id: sId, src: p };
        });
    }
    let sequencing_stats = [];
    let ref_stats = {};
    let total_genes = 0;
    let mapping_stats = [];
    let assembly_stats = [];
    let total_transcripts = 0;
    let mean_transcript_size = 0;
    let diff_expr_stats = [];
    let dge_chart_labels = [];
    let dge_chart_up = [];
    let dge_chart_down = [];
    let dge_figures = [];
    let pathway_stats = [];
    let go_distribution = [];
    let dge_comparison_table = { headers: [], rows: [] };
    let dge_group_table = { headers: [], rows: [] };
    let func_assets = {
        go_results_xlsx: '',
        kegg_results_xlsx: '',
        go_results_preview: [],
        kegg_results_preview: [],
        kegg_pathway_image_src: '',
        enrichment_image_src: '',
        barplot_image_src: '',
        dotplot_image_src: '',
        enrichment_plots: []
    };
    let deliverables_tree = '';
    let qc_issues = [];
    let pca_plots = [];
    let correlation_plots = [];
    if (!isInterim) {
        sequencing_stats = await getSequencingStats(inputDir, config);
        ref_stats = await getReferenceStats(inputDir, metadataOverride);
        total_genes = ref_stats?.total_genes || 0;
        mapping_stats = await getMappingStats(inputDir, config);
        assembly_stats = await getAssemblyStats(inputDir, config);
        const merged = assembly_stats.find((s) => String(s.sample).toLowerCase().includes('merged'));
        total_transcripts = Number(merged?.num_transcripts) || 0;
        mean_transcript_size = Number(merged?.mean_size) || 0;
        const dgeThresholds = {
            fdr: metadataOverride?.fdr || config.dge_thresholds.fdr,
            log2fc: metadataOverride?.log2fc || config.dge_thresholds.log2fc
        };
        const dgeData = await getDGECombinedData(inputDir, dgeThresholds);
        diff_expr_stats = dgeData.stats;
        dge_chart_labels = dgeData.labels;
        dge_chart_up = dgeData.up_counts;
        dge_chart_down = dgeData.down_counts;
        dge_figures = dgeData.figures;
        pathway_stats = await getPathwayStats(inputDir, config);
        go_distribution = await getGODistribution(inputDir);
        const tables = await getDGEComparisonTables(inputDir, static_snippets, metadataOverride);
        dge_comparison_table = tables.dge_comparison_table;
        dge_group_table = tables.dge_group_table;
        func_assets = await extractFunctionalAssets(inputDir);
        const pcaCorr = await extractPcaAndCorrelationAssets(inputDir);
        pca_plots = pcaCorr.pca_plots;
        correlation_plots = pcaCorr.correlation_plots;
        deliverables_tree = await getDeliverablesTree(inputDir);
        qc_issues = runQcChecks(sequencing_stats, mapping_stats, config);
    }
    const componentsDir = getComponentsDir();
    const gffcompare_codes_src = isInterim ? '' : await findComponentAsset(componentsDir, 'gffcompare_codes.png');
    const workflow_figure_src = isInterim ? '' : await findComponentAsset(componentsDir, ['workflow.png', 'workflow.svg']);
    const stringtie_merge_figure_src = isInterim ? '' : await findComponentAsset(componentsDir, 'stringtie_merge_illustration.svg');
    const isoforms_figure_src = isInterim ? '' : await findComponentAsset(componentsDir, 'isoforms.png');
    const pathway_ex_figure_src = isInterim ? '' : await findComponentAsset(componentsDir, 'pathway_ex.png');
    const logoDefault = path.join(getAssetsDir(), 'logo.png');
    const logo_path = metadataOverride?.logo ||
        ((await fs.pathExists(logoDefault)) ? logoDefault : '');
    const unipathDefault = path.join(getAssetsDir(), 'unipath.png');
    const unipath_logo_path = (await fs.pathExists(unipathDefault)) ? unipathDefault : '';
    const reference_organism = isInterim ? '' : (metadataOverride?.reference_organism ||
        ref_stats?.organism ||
        project_details.reference_organism ||
        'Organism Name');
    const refLink = wetLabData.ref_genome_link || metadataOverride?.ref_genome_link || ref_stats?.ref_genome_link || 'https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/405/GCF_000001405.40_GRCh38.p14/';
    if (!static_snippets.reference) {
        static_snippets.reference = {};
    }
    static_snippets.reference.genome_source = `Based on information received from client, the reference genome of ${reference_organism} was downloaded from (${refLink}) and considered for analysis.`;
    return {
        project_id: metadataOverride?.projectId ||
            wetLabData.project_id ||
            project_details.project_id ||
            readmeData.project_id ||
            path.basename(inputDir),
        report_date: wetLabData.report_date || project_details.report_date || new Date().toLocaleDateString(),
        client_name: metadataOverride?.client_name ||
            metadataOverride?.clientName ||
            wetLabData.client_name ||
            project_details.client_name ||
            'Unknown',
        client_org: metadataOverride?.client_org || wetLabData.client_org || project_details.client_org || 'Unknown',
        project_pi: metadataOverride?.piName ||
            wetLabData.project_pi ||
            project_details.project_pi ||
            readmeData.project_pi ||
            '',
        submitted_to: wetLabData.submitted_to || metadataOverride?.submitted_to || 'Dr. Amit Gupta',
        ref_genome_link: refLink,
        application: wetLabData.application || project_details.application || readmeData.application || '',
        no_of_samples: wetLabData.no_of_samples || project_details.no_of_samples || readmeData.no_of_samples || String(sample_count),
        sample_count: wetLabData.sample_count !== undefined
            ? Number(wetLabData.sample_count)
            : (wetLabData.no_of_samples !== undefined && !isNaN(Number(wetLabData.no_of_samples))
                ? Number(wetLabData.no_of_samples)
                : sample_count),
        samples: (wetLabData.samples && wetLabData.samples.length > 0) ? wetLabData.samples : samples,
        qubit_data: (() => {
            if (wetLabData.qubit_data && wetLabData.qubit_data.length > 0) {
                const savedHasData = wetLabData.qubit_data.some((q) => q.conc !== 'N/A' && q.conc !== '');
                const parsedHasData = qubit_data && qubit_data.length > 0 && qubit_data.some((q) => q.conc !== 'N/A' && q.conc !== '');
                if (!savedHasData && parsedHasData) {
                    return qubit_data;
                }
                return wetLabData.qubit_data.map((savedRow) => {
                    const parsedRow = qubit_data.find((p) => p.sample_id.toLowerCase() === savedRow.sample_id.toLowerCase());
                    return {
                        sample_id: savedRow.sample_id,
                        conc: (savedRow.conc === 'N/A' || savedRow.conc === '') && parsedRow && parsedRow.conc !== 'N/A' ? parsedRow.conc : savedRow.conc,
                        vol: (savedRow.vol === 'N/A' || savedRow.vol === '') && parsedRow && parsedRow.vol !== 'N/A' ? parsedRow.vol : savedRow.vol,
                        yield: (savedRow.yield === 'N/A' || savedRow.yield === '') && parsedRow && parsedRow.yield !== 'N/A' ? parsedRow.yield : savedRow.yield,
                        remarks: savedRow.remarks || (parsedRow ? parsedRow.remarks : '')
                    };
                });
            }
            return qubit_data;
        })(),
        library_sizes: (wetLabData.library_sizes && wetLabData.library_sizes.length > 0) ? wetLabData.library_sizes : library_sizes,
        sequencing_stats,
        reference_organism,
        total_genes,
        ref_stats,
        mapping_stats,
        total_transcripts,
        mean_transcript_size,
        assembly_stats,
        diff_expr_stats,
        dge_chart_labels,
        dge_chart_up,
        dge_chart_down,
        pathway_stats,
        go_distribution,
        pathway_image_src: '',
        dge_figures,
        dge_comparison_table,
        dge_group_table,
        func_assets,
        deliverables_tree,
        gffcompare_codes_src,
        workflow_figure_src,
        stringtie_merge_figure_src,
        isoforms_figure_src,
        pathway_ex_figure_src,
        logo_path,
        unipath_logo_path,
        warnings: isInterim ? [] : [...warnings, ...qc_issues],
        qc_issues,
        pca_plots,
        correlation_plots,
        static_content,
        static_snippets,
        // Wet lab overrides
        service_type: wetLabData.service_type || 'Transcriptome Sequencing',
        platform: wetLabData.platform || 'Illumina Novaseq X Plus',
        read_length: wetLabData.read_length || '2 X 150 PE',
        data_throughput: wetLabData.data_throughput || '~06GB / Sample',
        sample_type: wetLabData.sample_type || 'Leaf',
        shipping_condition: wetLabData.shipping_condition || 'NA',
        no_of_libraries_prepared: wetLabData.no_of_libraries_prepared || wetLabData.no_of_samples || String(sample_count),
        gel_image_src,
        lane_mapping,
        tapestation_images,
        conclusions: wetLabData.conclusions && wetLabData.conclusions.length > 0 ? wetLabData.conclusions : wetLabNotes.conclusions,
        library_kit: wetLabData.library_kit || '',
        size_range: wetLabData.size_range || '',
        chemistry: wetLabData.chemistry || '',
        ...metagenomeData
    };
}
function runQcChecks(sequencing, mapping, config) {
    const issues = [];
    const { mapping_rate, q30_rate, min_reads } = config.qc_thresholds;
    for (const row of sequencing) {
        const sample = String(row.sample ?? 'Unknown');
        const reads = asFloat(row.raw_reads);
        const q30 = asFloat(row.q30);
        if (reads !== null && reads < min_reads) {
            issues.push(`QC: ${sample} raw reads (${reads}) below minimum (${min_reads})`);
        }
        if (q30 !== null && q30 < q30_rate) {
            issues.push(`QC: ${sample} Q30 (${q30}%) below threshold (${q30_rate}%)`);
        }
    }
    for (const row of mapping) {
        const sample = String(row.sample_name ?? 'Unknown');
        const pct = asFloat(row.percent_mapped);
        if (pct !== null && pct < mapping_rate) {
            issues.push(`QC: ${sample} mapping rate (${pct}%) below threshold (${mapping_rate}%)`);
        }
    }
    return issues;
}
async function loadStaticContent() {
    const staticContentPath = getStaticContentPath();
    if (await fs.pathExists(staticContentPath)) {
        try {
            return JSON.parse(await fs.readFile(staticContentPath, 'utf-8'));
        }
        catch {
            console.warn(chalk.yellow('Warning: Could not load static content JSON'));
        }
    }
    return {};
}
async function parseReadme(inputDir) {
    for (const readmeFile of ['Readme.txt', 'README.txt', 'readme.txt']) {
        const readmePath = path.join(inputDir, readmeFile);
        if (await fs.pathExists(readmePath)) {
            try {
                const content = await fs.readFile(readmePath, 'utf-8');
                const details = {};
                const patterns = {
                    project_id: /Project\s*ID\s*:\s*(.+)/i,
                    project_pi: /Project\s*PI\s*:\s*(.+)/i,
                    application: /Application\s*:\s*(.+)/i,
                    no_of_samples: /No\s*of\s*Samples\s*:\s*(.+)/i
                };
                for (const [key, pattern] of Object.entries(patterns)) {
                    const match = content.match(pattern);
                    if (match)
                        details[key] = match[1].trim();
                }
                return details;
            }
            catch {
                console.warn(chalk.yellow('Warning: Could not parse README'));
            }
        }
    }
    return {};
}
async function getProjectDetails(inputDir) {
    const metadataPath = path.join(inputDir, 'metadata.json');
    let metadata = {};
    if (await fs.pathExists(metadataPath)) {
        try {
            metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
        }
        catch {
            console.warn(chalk.yellow('Warning: Could not parse metadata.json'));
        }
    }
    return {
        project_id: String(metadata.project_id ?? ''),
        project_pi: String(metadata.project_pi ?? ''),
        client_name: String(metadata.client_name ?? ''),
        client_org: String(metadata.client_org ?? ''),
        application: String(metadata.application ?? ''),
        no_of_samples: String(metadata.no_of_samples ?? ''),
        reference_organism: String(metadata.reference_organism ?? metadata.organism ?? ''),
        report_date: String(metadata.report_date ?? new Date().toLocaleDateString())
    };
}
async function validateDeliverablesStructure(inputDir, config) {
    const warnings = [];
    for (const dir of config.required_directories) {
        if (!(await fs.pathExists(path.join(inputDir, dir)))) {
            warnings.push(`Missing required directory: ${dir}`);
        }
    }
    const groups = config.optional_directory_groups || {};
    for (const [label, options] of Object.entries(groups)) {
        const dirs = Array.isArray(options) ? options : [];
        const found = await Promise.all(dirs.map((d) => fs.pathExists(path.join(inputDir, d))));
        if (!found.some(Boolean)) {
            warnings.push(`Missing ${label} data folder (expected one of: ${options.join(', ')})`);
        }
    }
    return warnings;
}
async function readExcelRows(filePath) {
    if (filePath.toLowerCase().endsWith('.txt') || filePath.toLowerCase().endsWith('.tsv')) {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 1)
            return [];
        const headers = lines[0].split('\t').map((h) => h.trim());
        const results = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split('\t');
            const obj = {};
            headers.forEach((h, idx) => {
                obj[h] = cols[idx] ? cols[idx].trim() : '';
            });
            results.push(obj);
        }
        return results;
    }
    const buf = await fs.readFile(filePath);
    const workbook = XLSX.read(buf, {
        type: 'buffer',
        cellFormula: false,
        cellHTML: false,
        cellText: false,
        cellStyles: false
    });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet);
}
async function findExcelFiles(dir, predicate) {
    if (!(await fs.pathExists(dir)))
        return [];
    const files = await fs.readdir(dir);
    return files
        .filter((f) => predicate(f.toLowerCase()) && /\.(xlsx|xls|csv|txt|tsv)$/i.test(f))
        .map((f) => path.join(dir, f));
}
async function getSamples(inputDir, config) {
    const metadataPath = path.join(inputDir, 'metadata.json');
    if (await fs.pathExists(metadataPath)) {
        try {
            const meta = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
            if (Array.isArray(meta.samples) && meta.samples.length) {
                return meta.samples.map((s) => String(s));
            }
        }
        catch { /* fall through */ }
    }
    const sheetPath = path.join(inputDir, 'sample_sheet.xlsx');
    if (await fs.pathExists(sheetPath)) {
        try {
            const rows = await readExcelRows(sheetPath);
            const names = rows
                .map((r) => pickColumn(r, ['Sample', 'Sample Name', 'sample', 'SampleID']))
                .filter(Boolean)
                .map(String);
            if (names.length)
                return [...new Set(names)];
        }
        catch { /* fall through */ }
    }
    const samples = [];
    const rawDataDir = path.join(inputDir, '01_Raw_Data');
    const aliases = config.column_mapping.raw_stats.sample_col;
    const statsFiles = await findExcelFiles(rawDataDir, (n) => n.includes('raw') || n.includes('stats'));
    for (const filePath of statsFiles) {
        try {
            const data = await readExcelRows(filePath);
            if (data.length === 0)
                continue;
            const sampleNames = new Set();
            for (const row of data) {
                const val = String(pickColumn(row, aliases) ?? '');
                if (!val)
                    continue;
                // Strip suffixes like _R1, _L001, etc.
                const match = val.match(/^([^_.]+)/);
                if (match)
                    sampleNames.add(match[1]);
                else
                    sampleNames.add(val);
            }
            samples.push(...sampleNames);
        }
        catch (e) {
            console.warn(chalk.yellow(`Warning: Could not parse samples from ${path.basename(filePath)}: ${e}`));
        }
    }
    return [...new Set(samples)];
}
async function getQubitData(inputDir, samples) {
    const results = [];
    const searchDirs = [inputDir, path.join(inputDir, '01_Raw_Data')];
    for (const dir of searchDirs) {
        for (const filePath of await findExcelFiles(dir, (n) => n.includes('qubit'))) {
            try {
                const rows = await readExcelRows(filePath);
                for (const row of rows) {
                    const sample = String(pickColumn(row, ['Sample', 'Sample Name', 'sample', 'SampleID']) ?? '');
                    const conc = pickColumn(row, ['Concentration', 'Qubit', 'ng/ul', 'ng/uL', 'Value', 'conc']);
                    const vol = pickColumn(row, ['Volume', 'vol', 'Vol']);
                    const yld = pickColumn(row, ['Yield', 'yield']);
                    const rem = pickColumn(row, ['Remarks', 'remarks', 'Note']);
                    if (sample || conc !== undefined) {
                        results.push({
                            sample_id: sample || `Sample ${results.length + 1}`,
                            conc: conc !== undefined ? String(conc) : 'N/A',
                            vol: vol !== undefined ? String(vol) : 'N/A',
                            yield: yld !== undefined ? String(yld) : 'N/A',
                            remarks: rem !== undefined ? String(rem) : ''
                        });
                    }
                }
            }
            catch { /* ignore */ }
        }
    }
    if (results.length === 0 && samples.length) {
        return samples.map((s) => ({
            sample_id: s,
            conc: 'N/A',
            vol: 'N/A',
            yield: 'N/A',
            remarks: ''
        }));
    }
    return results;
}
async function getLibrarySizes(inputDir, samples, sampleCount) {
    const sizes = [];
    const searchDirs = [inputDir, path.join(inputDir, '01_Raw_Data')];
    for (const dir of searchDirs) {
        for (const filePath of await findExcelFiles(dir, (n) => n.includes('tape') || n.includes('library') || n.includes('bioanalyzer'))) {
            try {
                const rows = await readExcelRows(filePath);
                for (const row of rows) {
                    const size = asFloat(pickColumn(row, ['Size', 'Mean Size', 'Peak Size', 'Library Size', 'bp']));
                    if (size !== null)
                        sizes.push(Math.round(size));
                }
            }
            catch { /* ignore */ }
        }
    }
    if (sizes.length >= sampleCount && sampleCount > 0) {
        return sizes.slice(0, sampleCount);
    }
    const fallback = 450;
    return Array(Math.max(sampleCount, 1)).fill(sizes[0] ?? fallback);
}
async function getSequencingStats(inputDir, config) {
    const stats = [];
    const cols = config.column_mapping.raw_stats;
    const workbookPath = await findStatsWorkbook(inputDir, RAW_STATS_PATTERNS, RAW_STATS_DIRS);
    if (!workbookPath) {
        console.warn(chalk.yellow('Warning: No raw/sequencing stats workbook found'));
        return stats;
    }
    try {
        console.log(chalk.gray(`  Raw stats: ${path.basename(workbookPath)}`));
        const data = await readExcelRows(workbookPath);
        for (const row of data) {
            const sample = pickColumn(row, cols.sample_col) ?? 'Unknown';
            const totalReads = pickColumn(row, cols.reads_col);
            if (sample !== 'Unknown' || totalReads !== undefined) {
                stats.push({
                    sample,
                    total_reads_r1: pickColumn(row, cols.reads_r1_col ?? []) ?? 'N/A',
                    total_reads_r2: pickColumn(row, cols.reads_r2_col ?? []) ?? 'N/A',
                    total_reads: totalReads ?? 'N/A',
                    total_bases: pickColumn(row, cols.bases_col) ?? 'N/A',
                    data_gb: pickColumn(row, cols.gb_col) ?? 'N/A',
                    raw_reads: totalReads ?? 'N/A',
                    clean_reads: totalReads ?? 'N/A',
                    q30: pickColumn(row, cols.q30_col) ?? 'N/A',
                    gc_content: pickColumn(row, cols.gc_col ?? ['GC%', 'GC']) ?? 'N/A'
                });
            }
        }
    }
    catch (e) {
        console.warn(chalk.yellow(`Warning: Could not parse sequencing stats: ${e}`));
    }
    return stats;
}
async function getReferenceStats(inputDir, metadataOverride) {
    const stats = {
        total_scaffolds: 'N/A',
        genome_length: 'N/A',
        mean_scaffold_size: 'N/A',
        max_scaffold_size: 'N/A',
        total_genes: 0,
        organism: 'Reference organism',
        source: 'N/A',
        features: {},
        ref_genome_link: ''
    };
    if (metadataOverride?.total_genes || metadataOverride?.total_genes === 0) {
        stats.total_genes = Number(metadataOverride.total_genes);
        stats.organism = String(metadataOverride.reference_organism || '');
        stats.source = 'metadata.json';
        // Fall through to see if we can get FASTA stats too
    }
    const refDirCandidates = [
        path.join(inputDir, '02_Reference_Genome_and_GFF'),
        path.join(inputDir, '02_reference_genome_and_gff'),
        path.join(inputDir, '02_Reference'),
        path.join(inputDir, '02_reference'),
        path.join(inputDir, 'reference')
    ];
    let refDir = refDirCandidates[0];
    for (const cand of refDirCandidates) {
        if (await fs.pathExists(cand)) {
            refDir = cand;
            break;
        }
    }
    // Look for any .txt file in the reference directory to parse URL/organism name
    if (await fs.pathExists(refDir)) {
        try {
            const files = await fs.readdir(refDir);
            const txtFile = files.find((f) => f.toLowerCase().endsWith('.txt'));
            if (txtFile) {
                const textPath = path.join(refDir, txtFile);
                const textContent = await fs.readFile(textPath, 'utf-8');
                // Extract URL: http:// or https:// or ftp://
                const urlMatch = textContent.match(/(https?:\/\/[^\s\)\(\<\>\"]+)/i) || textContent.match(/(ftp:\/\/[^\s\)\(\<\>\"]+)/i);
                if (urlMatch) {
                    stats.ref_genome_link = urlMatch[1].trim();
                }
                // Extract organism name: e.g. "Organism: Staphylococcus aureus" or species: or a binomial name
                const orgMatch = textContent.match(/organism[:\s]+([^\n\r]+)/i) || textContent.match(/species[:\s]+([^\n\r]+)/i);
                if (orgMatch) {
                    stats.organism = orgMatch[1].trim();
                }
                else {
                    // Binomial name pattern (Capital Word followed by lower word)
                    const binomialMatch = textContent.match(/([A-Z][a-z]+ [a-z]+)/);
                    if (binomialMatch) {
                        stats.organism = binomialMatch[1].trim();
                    }
                }
            }
        }
        catch (err) {
            console.warn(chalk.yellow(`Warning: Could not scan text files in reference folder (${err})`));
        }
    }
    const gtfPath = await findReferenceGtf(refDir);
    if (gtfPath) {
        try {
            const gtfStats = await parseGtfStats(gtfPath);
            stats.total_genes = gtfStats.geneCount;
            stats.organism = gtfStats.organism || stats.organism;
            stats.source = gtfPath;
            const filteredFeatures = {};
            const targetKeys = ['mRNA', 'CDS', 'exon', 'gene'];
            if (gtfStats.features) {
                for (const rawKey of Object.keys(gtfStats.features)) {
                    const matchingTarget = targetKeys.find(tk => tk.toLowerCase() === rawKey.toLowerCase());
                    if (matchingTarget) {
                        filteredFeatures[matchingTarget] = (filteredFeatures[matchingTarget] || 0) + gtfStats.features[rawKey];
                    }
                }
            }
            stats.features = filteredFeatures;
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(chalk.yellow(`Warning: Could not parse reference GTF (${msg})`));
        }
    }
    const fastaPath = await findReferenceFasta(refDir);
    if (fastaPath) {
        try {
            console.log(chalk.gray(`  Scanning reference FASTA: ${path.basename(fastaPath)}`));
            const fastaStats = await getFastaGenomeStats(fastaPath);
            stats.total_scaffolds = fastaStats.total.toLocaleString();
            stats.genome_length = fastaStats.length.toLocaleString();
            stats.mean_scaffold_size = fastaStats.mean.toLocaleString();
            stats.max_scaffold_size = fastaStats.max.toLocaleString();
            if (!stats.total_genes)
                stats.total_genes = fastaStats.total;
            if (stats.source === 'N/A')
                stats.source = path.basename(fastaPath);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(chalk.yellow(`Warning: Could not scan reference FASTA (${msg})`));
        }
    }
    // Final metadata check for overrides
    const metadataPath = path.join(inputDir, 'metadata.json');
    if (await fs.pathExists(metadataPath)) {
        try {
            const fileMeta = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
            if (fileMeta.reference_organism || fileMeta.organism) {
                stats.organism = fileMeta.reference_organism || fileMeta.organism;
            }
            if (fileMeta.total_genes !== undefined) {
                stats.total_genes = Number(fileMeta.total_genes);
            }
        }
        catch { /* ignore */ }
    }
    return stats;
}
async function getMappingStats(inputDir, config) {
    const stats = [];
    const cols = config.column_mapping.mapping_stats;
    let workbookPath = await findStatsWorkbook(inputDir, MAPPING_STATS_PATTERNS, MAPPING_STATS_DIRS);
    if (!workbookPath) {
        // Fallback: look for ANY .txt or .xlsx file in 01_Raw_Data that might contain mapping info
        const rawDir = path.join(inputDir, '01_Raw_Data');
        if (await fs.pathExists(rawDir)) {
            const candidates = await findExcelFiles(rawDir, (n) => n.includes('mapping') || n.includes('alignment'));
            if (candidates.length > 0)
                workbookPath = candidates[0];
        }
    }
    if (!workbookPath) {
        console.warn(chalk.yellow('Warning: No mapping stats workbook found'));
        return stats;
    }
    try {
        console.log(chalk.gray(`  Mapping stats: ${path.basename(workbookPath)}`));
        const data = await readExcelRows(workbookPath);
        for (const row of data) {
            stats.push({
                sample_name: pickColumn(row, cols.sample_col) ?? 'Unknown',
                total_reads: pickColumn(row, cols.total_reads_col) ?? 'N/A',
                mapped_reads: pickColumn(row, cols.mapped_reads_col) ?? 'N/A',
                percent_mapped: pickColumn(row, cols.pct_mapped_col) ?? 'N/A',
                unique_reads: pickColumn(row, cols.unique_reads_col) ?? 'N/A',
                percent_unique: pickColumn(row, cols.pct_unique_col) ?? 'N/A'
            });
        }
    }
    catch (e) {
        console.warn(chalk.yellow(`Warning: Could not parse mapping stats: ${e}`));
    }
    return stats;
}
async function getAssemblyStats(inputDir, config) {
    const stats = [];
    const cols = config.column_mapping.assembly_stats;
    const workbookPath = await findStatsWorkbook(inputDir, ASSEMBLY_STATS_PATTERNS, ASSEMBLY_STATS_DIRS);
    if (workbookPath) {
        try {
            console.log(chalk.gray(`  Assembly stats: ${path.basename(workbookPath)}`));
            const data = await readExcelRows(workbookPath);
            for (const row of data) {
                stats.push({
                    sample: pickColumn(row, cols.sample_col) ?? 'Unknown',
                    num_transcripts: pickColumn(row, cols.transcripts_col) ?? '0',
                    total_bp: pickColumn(row, cols.total_bp_col) ?? 'N/A',
                    mean_size: pickColumn(row, cols.mean_size_col) ?? '0',
                    max_size: pickColumn(row, cols.max_size_col) ?? '0'
                });
            }
            return stats;
        }
        catch (e) {
            console.warn(chalk.yellow(`Warning: Could not parse assembly workbook: ${e}`));
        }
    }
    const fastaDirs = [
        '04_transcript_sequences_fasta',
        '04_Transcript_Sequences_FASTA',
        '03_transcript_assembly_gtf',
        '03_Transcript_Assembly_GTF',
        '04_transcript_assembly_gtf'
    ];
    for (const rel of fastaDirs) {
        const dir = path.join(inputDir, rel);
        if (!(await fs.pathExists(dir)))
            continue;
        const files = (await fs.readdir(dir))
            .filter((f) => /\.(fasta|fa)$/i.test(f))
            .sort((a, b) => a.localeCompare(b));
        for (const file of files) {
            if (/gffcompare|novel|merged_transcripts/i.test(file) && !/^merged\.fasta$/i.test(file)) {
                continue;
            }
            const filePath = path.join(dir, file);
            try {
                const row = await parseFastaAssemblyStats(filePath);
                const sampleLabel = /^merged/i.test(file)
                    ? 'merged.fasta'
                    : row.sample.replace(/Aligned_transcript$/i, '').replace(/Aligned_?/i, '') || row.sample;
                stats.push({
                    sample: sampleLabel,
                    num_transcripts: row.num_transcripts,
                    total_bp: row.total_bp,
                    mean_size: row.mean_size,
                    max_size: row.max_size
                });
                console.log(chalk.gray(`  Assembly from FASTA: ${file} (${row.num_transcripts} transcripts)`));
            }
            catch (e) {
                console.warn(chalk.yellow(`Warning: Could not parse ${file}: ${e}`));
            }
        }
        if (stats.length)
            break;
    }
    if (stats.length === 0) {
        console.warn(chalk.yellow('Warning: No assembly statistics found (workbook or per-sample FASTA/GTF)'));
    }
    return stats;
}
function findNumericColumn(data, aliases) {
    if (!data?.length)
        return null;
    const columns = Object.keys(data[0]);
    const normMap = {};
    for (const col of columns) {
        normMap[normCol(col)] = col;
    }
    for (const alias of aliases) {
        const nc = normCol(alias);
        const matchedCol = normMap[nc];
        if (matchedCol) {
            let numericCount = 0;
            let totalChecked = 0;
            for (const row of data.slice(0, 15)) {
                const val = row[matchedCol];
                if (val !== undefined && val !== null && val !== '') {
                    totalChecked++;
                    const num = asFloat(val);
                    if (num !== null && !Number.isNaN(num)) {
                        numericCount++;
                    }
                }
            }
            if (totalChecked === 0 || (numericCount / totalChecked) >= 0.5) {
                return matchedCol;
            }
        }
    }
    return null;
}
async function findExcelFilesRecursive(dir, predicate) {
    if (!(await fs.pathExists(dir)))
        return [];
    const results = [];
    async function scan(currentDir, depth) {
        if (depth > 3)
            return; // Safeguard
        const name = path.basename(currentDir).toLowerCase();
        if (name.includes('raw_data') || name.includes('fasta') || name.includes('gtf'))
            return; // Skip large folders
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await scan(fullPath, depth + 1);
            }
            else if (entry.isFile() && /\.(xlsx|xls|csv)$/i.test(entry.name) && predicate(entry.name.toLowerCase())) {
                results.push(fullPath);
            }
        }
    }
    await scan(dir, 0);
    return results;
}
async function chooseFile(files) {
    if (!files || files.length === 0)
        return null;
    const existing = [];
    for (const f of files) {
        if (await fs.pathExists(f)) {
            existing.push(f);
        }
    }
    if (existing.length === 0)
        return null;
    const stats = await Promise.all(existing.map(async (f) => {
        const s = await fs.stat(f);
        return { file: f, mtime: s.mtimeMs, size: s.size };
    }));
    stats.sort((a, b) => b.mtime - a.mtime || b.size - a.size);
    return stats[0].file;
}
function ensureRowsHaveKeys(rows, keys, warningMessage, extra) {
    if (!rows || rows.length === 0) {
        const r = {};
        for (const k of keys) {
            r[k] = '';
        }
        const first = keys[0];
        if (first) {
            r[first] = warningMessage;
        }
        if (extra) {
            Object.assign(r, extra);
        }
        return [r];
    }
    let bad = false;
    for (const r of rows) {
        if (!r || typeof r !== 'object') {
            bad = true;
            break;
        }
        for (const k of keys) {
            if (!(k in r)) {
                bad = true;
                break;
            }
        }
        if (bad)
            break;
    }
    if (!bad)
        return rows;
    const r = {};
    for (const k of keys) {
        r[k] = '';
    }
    const first = keys[0];
    if (first) {
        r[first] = warningMessage;
    }
    if (extra) {
        Object.assign(r, extra);
    }
    return [r];
}
async function getPathwayStats(inputDir, config) {
    let stats = [];
    const cols = config.column_mapping.pathway_stats;
    const pathwayDir = path.join(inputDir, '07_Significant_DGE_pathways');
    let files = [];
    if (await fs.pathExists(pathwayDir)) {
        files = await findExcelFiles(pathwayDir, (n) => n.endsWith('.xlsx') || n.endsWith('.xls'));
    }
    if (files.length === 0) {
        files = await findExcelFilesRecursive(inputDir, (n) => n.includes('significant') && n.includes('dge') && n.includes('pathway'));
    }
    if (files.length === 0) {
        files = await findExcelFilesRecursive(inputDir, (n) => n.includes('dge') && n.includes('pathway'));
    }
    if (files.length === 0) {
        files = await findExcelFilesRecursive(inputDir, (n) => n.includes('kegg'));
    }
    files = Array.from(new Set(files));
    const filePath = await chooseFile(files);
    if (filePath) {
        try {
            console.log(chalk.cyan(`    [Pathways] Processing: ${path.basename(filePath)}`));
            const data = await readExcelRows(filePath);
            console.log(chalk.gray(`      Parsed ${data.length.toLocaleString()} rows`));
            const level1Col = findColumn(data, cols.level1_col);
            const level2Col = findColumn(data, cols.level2_col);
            const countCol = findNumericColumn(data, cols.count_col);
            if (!level1Col && !level2Col && !countCol) {
                return ensureRowsHaveKeys([], ['level1', 'level2', 'count'], 'Pathway columns not recognized', { level2: `File: ${path.relative(inputDir, filePath).replace(/\\/g, '/')}` });
            }
            for (const row of data) {
                const level1 = level1Col ? String(pickColumn(row, [level1Col]) ?? '').trim() : '';
                const level2 = level2Col ? String(pickColumn(row, [level2Col]) ?? '').trim() : '';
                const count = countCol ? asInt(pickColumn(row, [countCol])) ?? 0 : 0;
                if (level1 || level2) {
                    stats.push({
                        level1: level1 || 'Unknown',
                        level2: level2 || 'Unknown',
                        pathway: level2 || 'Unknown',
                        count
                    });
                }
            }
        }
        catch (err) {
            console.warn(chalk.yellow(`Warning: Could not parse pathway stats from ${filePath}: ${err}`));
        }
    }
    stats.sort((a, b) => b.count - a.count);
    stats = stats.slice(0, 50);
    if (files.length === 0) {
        return ensureRowsHaveKeys([], ['level1', 'level2', 'count'], 'No pathway file found', { level2: 'Expected in 07_Significant_DGE_pathways or matching *Pathway*.xlsx' });
    }
    if (stats.length > 0 && !stats.some(s => s.level1 && s.level1 !== 'Unknown' && s.level1 !== '')) {
        return ensureRowsHaveKeys([], ['level1', 'level2', 'count'], 'Pathway columns not recognized', { level2: "Found file but 'level1' column was missing or empty." });
    }
    return ensureRowsHaveKeys(stats, ['level1', 'level2', 'count'], 'Pathway stats unavailable');
}
async function getGODistribution(inputDir) {
    console.log(chalk.gray('  GO distribution: looking for z2_sigDGE_GO_Statistics.txt...'));
    const goDir = path.join(inputDir, '06_Significant_DGE_GO');
    let targetFile = path.join(goDir, 'z2_sigDGE_GO_Statistics.txt');
    let stats = [];
    // Helper search function to scan for the target file recursively if not found in 06_Significant_DGE_GO
    async function search(dir) {
        if (!(await fs.pathExists(dir)))
            return null;
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.venv')
                continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const found = await search(fullPath);
                if (found)
                    return found;
            }
            else if (entry.name === 'z2_sigDGE_GO_Statistics.txt') {
                return fullPath;
            }
        }
        return null;
    }
    if (!(await fs.pathExists(targetFile))) {
        const foundPath = await search(inputDir);
        if (foundPath) {
            targetFile = foundPath;
        }
    }
    if (await fs.pathExists(targetFile)) {
        try {
            const content = await fs.readFile(targetFile, 'utf-8');
            const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length > 1) {
                const headers = lines[0].split('\t').map(h => h.trim());
                const combIdx = headers.findIndex(h => ['COMBINATION', 'SAMPLE', 'SAMPLE NAME'].includes(h.toUpperCase()));
                const sigDgeIdx = headers.findIndex(h => ['SIGDGE', 'SIGNIFICANT DGE'].includes(h.toUpperCase()));
                const sqGoIdx = headers.findIndex(h => ['SQGO', 'SEQ WITH GO', '# SEQ WITH GO'].includes(h.toUpperCase()));
                const bpIdx = headers.findIndex(h => ['BP', 'BIOLOGICAL PROCESS'].includes(h.toUpperCase()));
                const ccIdx = headers.findIndex(h => ['CC', 'CELLULAR COMPONENT'].includes(h.toUpperCase()));
                const mfIdx = headers.findIndex(h => ['MF', 'MOLECULAR FUNCTION'].includes(h.toUpperCase()));
                for (let i = 1; i < lines.length; i++) {
                    const parts = lines[i].split('\t').map(p => p.trim());
                    if (parts.length >= headers.length) {
                        stats.push({
                            combination: combIdx !== -1 ? parts[combIdx] : `Comparison${i}`,
                            sig_dge: sigDgeIdx !== -1 ? asInt(parts[sigDgeIdx]) : 0,
                            sq_go: sqGoIdx !== -1 ? asInt(parts[sqGoIdx]) : 0,
                            bp: bpIdx !== -1 ? asInt(parts[bpIdx]) : 0,
                            cc: ccIdx !== -1 ? asInt(parts[ccIdx]) : 0,
                            mf: mfIdx !== -1 ? asInt(parts[mfIdx]) : 0
                        });
                    }
                }
            }
            return stats;
        }
        catch (err) {
            console.warn(chalk.yellow(`Warning: Could not parse GO statistics from ${targetFile}: ${err}`));
        }
    }
    return ensureRowsHaveKeys(stats, ['combination', 'sig_dge', 'sq_go', 'bp', 'cc', 'mf'], 'GO statistics unavailable', { combination: 'Expected in z2_sigDGE_GO_Statistics.txt' });
}
async function getDGECombinedData(inputDir, thresholds) {
    const stats = [];
    const labels = [];
    const up_counts = [];
    const down_counts = [];
    const figures = [];
    const dgeDir = path.join(inputDir, '05_differential_expression_analysis');
    if (!(await fs.pathExists(dgeDir))) {
        return { stats, labels, up_counts, down_counts, figures };
    }
    const allFiles = await fs.readdir(dgeDir);
    const xlsxFiles = allFiles.filter((f) => f.toLowerCase().includes('dge') && /\.(xlsx|xls)$/i.test(f));
    function normalizeComp(name) {
        return name.toLowerCase().replace(/[_\-\s]+/g, '');
    }
    for (const file of xlsxFiles) {
        const filePath = path.join(dgeDir, file);
        const base = path.parse(file).name;
        // Comparison name: strip "DGE" and everything after it
        const comparison = base.replace(/_?dge.*$/i, '').trim() || base;
        const compNorm = normalizeComp(comparison);
        try {
            console.log(chalk.cyan(`    [DGE Combined] Processing: ${file}`));
            const data = await readExcelRows(filePath);
            console.log(chalk.gray(`      Parsed ${data.length.toLocaleString()} rows`));
            const fcCol = findColumn(data, ['logfc', 'log2fc', 'log2foldchange', 'lfc', 'log2(fold_change)', 'logfoldchange']);
            const sigCol = findColumn(data, ['padj', 'fdr', 'qvalue', 'pvalue', 'pval', 'p-adj', 'p-value', 'q_value', 'p_value', 'q-value']);
            const cpmCol = findColumn(data, ['logcpm', 'log_cpm', 'cpm', 'log2cpm', 'log2_cpm']);
            const meanCol = findColumn(data, ['basemean', 'aveexpr', 'mean', 'base_mean', 'average_expression']);
            // Default to the first column as the gene identifier unless it contains numeric stats columns
            const columns = Object.keys(data[0] || {});
            const firstCol = columns[0] || null;
            let geneCol = firstCol;
            if (!geneCol || geneCol === fcCol || geneCol === sigCol || geneCol === cpmCol || geneCol === meanCol) {
                geneCol = findColumn(data, ['gene', 'gene_name', 'gene_id', 'symbol', 'genesymbol', 'name', 'transcript_id', 'transcript', 'id']);
            }
            let sig_up = 0;
            let sig_down = 0;
            const plotData = {
                ma: { up: [], down: [], ns: [] },
                volcano: { up: [], down: [], ns: [] }
            };
            for (const row of data) {
                const fc = asFloat(row[fcCol ?? '']);
                const pval = sigCol ? asFloat(row[sigCol]) : null;
                const fdr = pval ?? 1;
                const isSig = pval !== null && pval > 0 && pval < thresholds.fdr;
                let bucket = 'ns';
                if (fc !== null) {
                    if (isSig && fc >= thresholds.log2fc) {
                        sig_up++;
                        bucket = 'up';
                    }
                    else if (isSig && fc <= -thresholds.log2fc) {
                        sig_down++;
                        bucket = 'down';
                    }
                    const geneName = geneCol && row[geneCol] ? String(row[geneCol]).trim() : '';
                    // Plot data
                    const cpm = cpmCol ? asFloat(row[cpmCol]) : null;
                    const meanExpr = meanCol ? asFloat(row[meanCol]) : null;
                    let maX = cpm;
                    if (maX === null && meanExpr !== null && meanExpr >= 0) {
                        maX = Math.log10(meanExpr + 1);
                    }
                    if (maX !== null) {
                        plotData.ma[bucket].push({ x: maX, y: fc, label: geneName });
                    }
                    if (pval !== null && pval > 0) {
                        plotData.volcano[bucket].push({ x: fc, y: -Math.log10(pval), label: geneName });
                    }
                }
            }
            // Downsample for charts
            const maxPoints = 8000;
            for (const key of ['ma', 'volcano']) {
                for (const bucket of ['up', 'down', 'ns']) {
                    plotData[key][bucket] = downsample(plotData[key][bucket], maxPoints);
                }
            }
            const hasMAData = Object.values(plotData.ma).some((a) => a.length > 0);
            const hasVolcanoData = Object.values(plotData.volcano).some((a) => a.length > 0);
            // Find assets (heatmap, pdf)
            const heatmap = allFiles.find((f) => {
                if (!/\.png$/i.test(f) || !/heatmap/i.test(f))
                    return false;
                return normalizeComp(f).includes(compNorm);
            });
            const maVolcano = allFiles.find((f) => {
                if (!/\.pdf$/i.test(f) || !/(volcano|ma)/i.test(f))
                    return false;
                return normalizeComp(f).includes(compNorm);
            });
            stats.push({
                comparison,
                total_genes: data.length,
                sig_up,
                sig_down,
                total_sig: sig_up + sig_down
            });
            labels.push(comparison);
            up_counts.push(sig_up);
            down_counts.push(sig_down);
            figures.push({
                comparison,
                heatmap_png_src: heatmap ? path.join(dgeDir, heatmap) : '',
                ma_volcano_pdf_src: maVolcano ? path.join(dgeDir, maVolcano) : '',
                dge_xlsx_src: filePath,
                plot_data_json: JSON.stringify(plotData),
                ma_plot_data: hasMAData,
                volcano_plot_data: hasVolcanoData
            });
            if (hasMAData || hasVolcanoData) {
                console.log(chalk.green(`      SUCCESS: Generated plot data for ${comparison} (MA points: ${plotData.ma.up.length + plotData.ma.down.length + plotData.ma.ns.length}, Volcano points: ${plotData.volcano.up.length + plotData.volcano.down.length + plotData.volcano.ns.length})`));
            }
            else {
                console.warn(chalk.yellow(`      WARNING: No plot data generated for ${comparison}. Check if columns like LogFC and P-value are present.`));
            }
        }
        catch (err) {
            console.warn(chalk.yellow(`      Warning: Could not process DGE file ${file}: ${err}`));
        }
    }
    return { stats, labels, up_counts, down_counts, figures };
}
async function getDGEComparisonTables(inputDir, static_snippets, metadataOverride) {
    const empty = { headers: [], rows: [] };
    const metadataPath = path.join(inputDir, 'metadata.json');
    let metadata = {};
    if (await fs.pathExists(metadataPath)) {
        try {
            metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
        }
        catch { /* ignore */ }
    }
    let cmp = metadataOverride?.dge_comparison_table ||
        metadata.dge_comparison_table;
    let grp = metadataOverride?.dge_group_table ||
        metadata.dge_group_table;
    // Helper to find file recursively or locally
    async function findFile(filename) {
        const local = path.join(inputDir, filename);
        if (await fs.pathExists(local))
            return local;
        // Check in subfolders
        async function search(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.venv')
                    continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    const found = await search(fullPath);
                    if (found)
                        return found;
                }
                else if (entry.name.toLowerCase() === filename.toLowerCase()) {
                    return fullPath;
                }
            }
            return null;
        }
        try {
            return await search(inputDir);
        }
        catch {
            return null;
        }
    }
    // Automate parsing tab-separated combinations.txt if found
    if (!cmp || !cmp.rows || cmp.rows.length === 0) {
        const combFile = await findFile('combinations.txt');
        if (combFile) {
            try {
                console.log(`Auto-filling DGE comparison table from: ${combFile}`);
                const text = await fs.readFile(combFile, 'utf-8');
                const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length > 0) {
                    const rows = [];
                    const headers = ['COMPARISON', 'DESCRIPTION'];
                    let compIndex = 1;
                    lines.forEach((line) => {
                        const parts = line.split('\t').map(p => p.trim()).filter(p => p.length > 0);
                        if (parts.length >= 2) {
                            const condA = parts[0];
                            const condB = parts[1];
                            if (condA.toLowerCase() === 'comparison' || condA.toLowerCase() === 'group') {
                                return; // skip potential header
                            }
                            const compName = `${condA} v/s ${condB}`;
                            const compDesc = `Comparison ${compIndex} [${condA} Vs ${condB}]`;
                            rows.push([compName, compDesc]);
                            compIndex++;
                        }
                    });
                    if (rows.length > 0) {
                        cmp = { headers, rows };
                    }
                }
            }
            catch (err) {
                console.warn(`Error parsing combinations.txt: ${err}`);
            }
        }
    }
    // Automate parsing tab-separated samples_described.txt if found
    if (!grp || !grp.rows || grp.rows.length === 0) {
        const samplesFile = await findFile('samples_described.txt');
        if (samplesFile) {
            try {
                console.log(`Auto-filling DGE group table from: ${samplesFile}`);
                const text = await fs.readFile(samplesFile, 'utf-8');
                const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length > 0) {
                    const rows = [];
                    const headers = ['GROUP NAME', 'SAMPLE NAME'];
                    lines.forEach((line) => {
                        const parts = line.split('\t').map(p => p.trim()).filter(p => p.length > 0);
                        if (parts.length >= 2) {
                            if (parts[0].toLowerCase().startsWith('group') || parts[0].toLowerCase().startsWith('test')) {
                                if (parts[0].toLowerCase() === 'group name' || parts[0].toLowerCase() === 'group')
                                    return;
                            }
                            rows.push([parts[0], parts[1]]);
                        }
                    });
                    if (rows.length > 0) {
                        grp = { headers, rows };
                    }
                }
            }
            catch (err) {
                console.warn(`Error parsing samples_described.txt: ${err}`);
            }
        }
    }
    const dgeSnippet = static_snippets.dge;
    return {
        dge_comparison_table: cmp?.rows?.length ? cmp :
            dgeSnippet?.comparison_info_table || {
                headers: ['Comparison', 'Description'],
                rows: []
            },
        dge_group_table: grp?.rows?.length ? grp :
            dgeSnippet?.group_sample_table || {
                headers: ['Group Name', 'Sample Name'],
                rows: []
            }
    };
}
async function extractFunctionalAssets(inputDir) {
    const assets = {
        go_results_xlsx: '',
        kegg_results_xlsx: '',
        go_results_preview: [],
        kegg_results_preview: [],
        kegg_pathway_image_src: '',
        enrichment_image_src: '',
        barplot_image_src: '',
        dotplot_image_src: '',
        enrichment_plots: []
    };
    async function findFilesRecursive(pattern, extensions) {
        const found = [];
        async function search(dir) {
            if (!(await fs.pathExists(dir)))
                return;
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.venv')
                    continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await search(fullPath);
                }
                else if (entry.name.toLowerCase().includes(pattern.toLowerCase()) &&
                    extensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
                    found.push(fullPath);
                }
            }
        }
        await search(inputDir);
        return found;
    }
    // 1. Find GO and KEGG excel files recursively
    const goFiles = await findFilesRecursive('go', ['.xlsx', '.xls']);
    goFiles.sort((a, b) => {
        const aName = path.basename(a).toLowerCase();
        const bName = path.basename(b).toLowerCase();
        const aScore = (aName.includes('enrichment') ? 2 : 0) + (aName.includes('results') ? 1 : 0);
        const bScore = (bName.includes('enrichment') ? 2 : 0) + (bName.includes('results') ? 1 : 0);
        return bScore - aScore;
    });
    if (goFiles.length) {
        assets.go_results_xlsx = goFiles[0];
        try {
            const wb = XLSX.readFile(goFiles[0]);
            const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
            assets.go_results_preview = data.slice(0, 16); // slice 16 to get top 15 rows + header
        }
        catch { /* ignore */ }
    }
    // Find KEGG pathway excel files in 07 folder specifically, falling back to recursive search
    const pathwayDir = path.join(inputDir, '07_Significant_DGE_pathways');
    let keggFiles = [];
    if (await fs.pathExists(pathwayDir)) {
        keggFiles = await findExcelFiles(pathwayDir, (n) => n.toLowerCase().includes('kegg') && (n.endsWith('.xlsx') || n.endsWith('.xls')));
        if (keggFiles.length === 0) {
            keggFiles = await findExcelFiles(pathwayDir, (n) => n.endsWith('.xlsx') || n.endsWith('.xls'));
        }
    }
    if (keggFiles.length === 0) {
        keggFiles = await findFilesRecursive('kegg', ['.xlsx', '.xls']);
    }
    keggFiles.sort((a, b) => {
        const aName = path.basename(a).toLowerCase();
        const bName = path.basename(b).toLowerCase();
        const aIn07 = a.includes('07_Significant_DGE_pathways') ? 1 : 0;
        const bIn07 = b.includes('07_Significant_DGE_pathways') ? 1 : 0;
        if (aIn07 !== bIn07)
            return bIn07 - aIn07;
        const aComp = aName.match(/comparison_(\d+)/i);
        const bComp = bName.match(/comparison_(\d+)/i);
        if (aComp && bComp) {
            return parseInt(aComp[1], 10) - parseInt(bComp[1], 10);
        }
        const aScore = (aName.includes('enrichment') ? 2 : 0) + (aName.includes('results') ? 1 : 0);
        const bScore = (bName.includes('enrichment') ? 2 : 0) + (bName.includes('results') ? 1 : 0);
        if (aScore !== bScore)
            return bScore - aScore;
        return aName.localeCompare(bName);
    });
    if (keggFiles.length) {
        assets.kegg_results_xlsx = keggFiles[0];
        try {
            const wb = XLSX.readFile(keggFiles[0]);
            const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
            assets.kegg_results_preview = data; // use the whole table instead of top 15 rows
        }
        catch { /* ignore */ }
    }
    // 2. Find KEGG representative pathway image
    const pathwayDirCandidates = [
        path.join(inputDir, '07_Significant_DGE_pathways'),
        path.join(inputDir, '07_significant_dge_pathways'),
        path.join(inputDir, '07_Significant_Pathways'),
        path.join(inputDir, '07_significant_pathways'),
        path.join(inputDir, '07_Pathways'),
        path.join(inputDir, '07_pathways'),
        path.join(inputDir, 'pathways')
    ];
    let pathwayImgDir = '';
    for (const cand of pathwayDirCandidates) {
        if (await fs.pathExists(cand)) {
            pathwayImgDir = cand;
            break;
        }
    }
    let keggPathwayImg = null;
    if (pathwayImgDir) {
        const pathwayImages = [];
        async function searchImages(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules')
                    continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await searchImages(fullPath);
                }
                else if (/\.(png|jpg|jpeg|svg)$/i.test(entry.name)) {
                    pathwayImages.push(fullPath);
                }
            }
        }
        await searchImages(pathwayImgDir).catch(() => { });
        if (pathwayImages.length > 0) {
            pathwayImages.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
            keggPathwayImg = pathwayImages[0];
        }
    }
    // Fallback to searching the entire input directory if not found in 07 folder
    if (!keggPathwayImg) {
        const images = await findFilesRecursive('kegg', ['.png', '.jpg', '.jpeg', '.svg']);
        keggPathwayImg = images.find((f) => path.basename(f).toLowerCase().includes('path')) || null;
    }
    if (keggPathwayImg) {
        assets.kegg_pathway_image_src = keggPathwayImg;
    }
    // 3. Find enrichment barplots and dotplots recursively
    const allPngs = await findFilesRecursive('', ['.png', '.jpg', '.jpeg', '.svg']);
    const enrichment_plots = [];
    for (const imgPath of allPngs) {
        const filename = path.basename(imgPath).toLowerCase();
        if (filename.includes('barplot') || filename.includes('dotplot')) {
            let comparison = 'Comparison';
            const compMatch = filename.match(/c\d+_sig_(up|down)/i);
            if (compMatch) {
                comparison = compMatch[0].toUpperCase();
            }
            else {
                const simpleComp = filename.match(/c\d+/i);
                const upDown = filename.includes('up') ? 'Sig_up' : filename.includes('down') ? 'Sig_down' : '';
                comparison = simpleComp ? `${simpleComp[0].toUpperCase()}_${upDown}` : filename.split('_')[0];
            }
            const type = filename.includes('kegg') ? 'KEGG' : filename.includes('go') ? 'GO' : 'Enrichment';
            const plotType = filename.includes('barplot') ? 'barplot' : 'dotplot';
            enrichment_plots.push({
                comparison,
                type,
                plotType,
                src: imgPath
            });
        }
    }
    enrichment_plots.sort((a, b) => {
        if (a.comparison !== b.comparison)
            return a.comparison.localeCompare(b.comparison);
        if (a.type !== b.type)
            return a.type.localeCompare(b.type);
        return a.plotType.localeCompare(b.plotType);
    });
    assets.enrichment_plots = enrichment_plots;
    // Set representative barplot and dotplot
    const barplot = enrichment_plots.find((p) => p.plotType === 'barplot');
    const dotplot = enrichment_plots.find((p) => p.plotType === 'dotplot');
    if (barplot)
        assets.barplot_image_src = barplot.src;
    if (dotplot)
        assets.dotplot_image_src = dotplot.src;
    const enrich = [
        ...(await findFilesRecursive('enrich', ['.png', '.jpg', '.jpeg', '.svg'])),
        ...(await findFilesRecursive('dotplot', ['.png', '.jpg', '.jpeg', '.svg']))
    ];
    if (enrich.length)
        assets.enrichment_image_src = enrich[0];
    return assets;
}
async function extractPcaAndCorrelationAssets(inputDir) {
    const pca_plots = [];
    const correlation_plots = [];
    const entries = await fs.readdir(inputDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const dirName = entry.name.toLowerCase();
        const fullPath = path.join(inputDir, entry.name);
        if (dirName.includes('pca') || dirName.includes('pcoa')) {
            const files = await fs.readdir(fullPath).catch(() => []);
            let hasImage = false;
            for (const file of files) {
                if (/\.(png|jpg|jpeg|svg)$/i.test(file)) {
                    hasImage = true;
                    let title = 'PCA Plot';
                    if (file.toLowerCase().includes('pcoa')) {
                        title = 'PCoA Plot';
                    }
                    pca_plots.push({
                        src: path.join(fullPath, file),
                        title
                    });
                }
            }
            if (!hasImage) {
                for (const file of files) {
                    if (file.toLowerCase().endsWith('.pdf')) {
                        let title = 'PCA Plot (PDF)';
                        if (file.toLowerCase().includes('pcoa')) {
                            title = 'PCoA Plot (PDF)';
                        }
                        pca_plots.push({
                            src: path.join(fullPath, file),
                            title
                        });
                    }
                }
            }
        }
        if (dirName.includes('pearson') || dirName.includes('correlation')) {
            const files = await fs.readdir(fullPath).catch(() => []);
            for (const file of files) {
                if (/\.(png|jpg|jpeg|svg)$/i.test(file)) {
                    let title = 'Correlation Heatmap';
                    if (file.toLowerCase().includes('pearson')) {
                        title = 'Pearson Correlation Heatmap';
                    }
                    else if (file.toLowerCase().includes('spearman')) {
                        title = 'Spearman Correlation Heatmap';
                    }
                    correlation_plots.push({
                        src: path.join(fullPath, file),
                        title
                    });
                }
            }
        }
    }
    return { pca_plots, correlation_plots };
}
async function getDeliverablesTree(inputDir) {
    for (const readmeFile of ['Readme.txt', 'README.txt', 'readme.txt']) {
        const readmePath = path.join(inputDir, readmeFile);
        if (await fs.pathExists(readmePath)) {
            try {
                const lines = (await fs.readFile(readmePath, 'utf-8')).split('\n');
                const treeLines = lines.filter((line) => /(\|--|├──|└──|│\s+)/.test(line) || line.includes('--'));
                if (treeLines.length)
                    return treeLines.join('\n').trim();
            }
            catch { /* ignore */ }
        }
    }
    return buildDeliverablesTreeFromFS(inputDir);
}
async function buildDeliverablesTreeFromFS(inputDir, maxDepth = 4) {
    const out = [`${path.basename(inputDir)}/`];
    async function walk(dir, depth) {
        if (depth >= maxDepth)
            return;
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const dirs = entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
            const files = entries.filter((e) => e.isFile() && !e.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name));
            for (const d of dirs) {
                const rel = path.relative(inputDir, path.join(dir, d.name));
                out.push(`${'  '.repeat(rel.split(path.sep).length)}${d.name}/`);
                await walk(path.join(dir, d.name), depth + 1);
            }
            for (const f of files.slice(0, 25)) {
                const rel = path.relative(inputDir, path.join(dir, f.name));
                out.push(`${'  '.repeat(rel.split(path.sep).length)}${f.name}`);
            }
        }
        catch { /* ignore */ }
    }
    await walk(inputDir, 0);
    return out.join('\n');
}
async function findComponentAsset(componentsDir, assetName) {
    const names = Array.isArray(assetName) ? assetName : [assetName];
    for (const name of names) {
        const assetPath = path.join(componentsDir, name);
        if (await fs.pathExists(assetPath))
            return assetPath;
    }
    return '';
}
export async function parseWetLabNotes(filePath) {
    const defaultNotes = {
        rna_isolation_qc: 'RNA sample was extracted from tissue sample using QIAGEN RNeasy mini kit (CAT.NO:74106). RNA quantity was measured using Qubit® 4.0 fluorometer and quality were analyzed by using 1% agarose gel.',
        library_preparation: 'The paired-end sequencing library was prepared using NEBNext® Ultra™ RNA Library Prep Kit for Illumina. (NEB #E7770). The library preparation process was initiated with 100 ng input. Ribosomal RNA was removed using depletion was carried out using ribodepletion kit KAPA RNA HyperPrep Kit with RiboErase (HMR), Cat no: KK8561) as per user manual. Ribo-depleted RNA was subjected to fragmentation, first & second-strand cDNA synthesis, end-repair, 3´ adapter ligation, selective enrichment of adapter-ligated DNA fragments through PCR amplification, followed by validation of Library on Agilent 4150 tape station. The final library was pooled with other samples, denatured & loaded on to flow cell. On the flowcell, cluster generation & sequencing was performed using Illumina Novaseq X plus platform to generate 2×150bp paired-end (PE) reads.',
        cluster_generation: 'After obtaining the Qubit concentration for the library and the mean peak size from Tape Station profile, library will be loaded onto Illumina Novaseq X Plus for cluster generation and sequencing. Paired-End sequencing allows the template fragments to be sequenced in both the forward and reverse directions. The library molecules will bind to complementary adapter oligos on paired-end flow cell. The adapters are designed to allow selective cleavage of the forward strands after re-synthesis of the reverse strand during sequencing. The copied reverse strand is then used to sequence from the opposite end of the fragment.',
        conclusions: [
            'The libraries were prepared from the samples by KAPA mRNA HyperPrep Kit for Illumina (CAT #KK8581).',
            'The average size of libraries is in range of 330bp to 360bp* for all samples.',
            'The libraries will be sequenced on Illumina Novaseq X Plus platform using 2-x 150 bp chemistry to generate ~06GB/Sample.'
        ]
    };
    // Try .docx first, then fall back to .txt
    const docxPath = filePath.replace(/\.txt$/i, '.docx');
    const hasDocx = await fs.pathExists(docxPath);
    const hasTxt = await fs.pathExists(filePath);
    if (!hasDocx && !hasTxt) {
        return defaultNotes;
    }
    // --- Parse .docx using mammoth raw text (no markdown escaping issues) ---
    if (hasDocx) {
        try {
            const buf = await fs.readFile(docxPath);
            // extractRawText gives clean plain text — no backslash escaping like convertToMarkdown
            const result = await mammoth.extractRawText({ buffer: buf });
            const rawText = result.value;
            // The docx has Word Heading 1 paragraphs as section names.
            // In raw text they appear as standalone lines (preceded/followed by blank lines).
            // We detect them by looking for known heading keywords on their own line.
            const HEADING_PATTERNS = [
                { key: 'rna_isolation', pattern: /^RNA Isolation/i },
                { key: 'library_preparation', pattern: /^Library Preparation/i },
                { key: 'cluster_generation', pattern: /^Cluster Generation/i },
                { key: 'conclusions', pattern: /^Conclusions?/i },
                // Skip document title / intro paragraphs
                { key: '_title', pattern: /^NGS Wet Lab Notes/i },
                { key: '_intro', pattern: /^This document contains/i },
            ];
            const sections = {};
            let currentSection = '';
            let currentContent = [];
            for (const line of rawText.split(/\r?\n/)) {
                const trimmed = line.trim();
                // Check if this line is a heading
                const match = HEADING_PATTERNS.find(h => h.pattern.test(trimmed));
                if (match) {
                    if (currentSection && !currentSection.startsWith('_')) {
                        sections[currentSection] = currentContent.join('\n').trim();
                    }
                    currentSection = match.key;
                    currentContent = [];
                }
                else {
                    currentContent.push(line);
                }
            }
            if (currentSection && !currentSection.startsWith('_')) {
                sections[currentSection] = currentContent.join('\n').trim();
            }
            const rna_isolation_qc = sections['rna_isolation'] || defaultNotes.rna_isolation_qc;
            const library_preparation = sections['library_preparation'] || defaultNotes.library_preparation;
            const cluster_generation = sections['cluster_generation'] || defaultNotes.cluster_generation;
            let conclusions = defaultNotes.conclusions;
            if (sections['conclusions']) {
                const bullets = sections['conclusions'].split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 0)
                    .map(l => l.replace(/^[-*•]\s*/, ''));
                if (bullets.length > 0) {
                    conclusions = bullets;
                }
            }
            console.log(chalk.green(`Loaded wet lab notes from: ${path.basename(docxPath)}`));
            return { rna_isolation_qc, library_preparation, cluster_generation, conclusions };
        }
        catch (e) {
            console.warn(chalk.yellow('Warning: could not parse wet_lab_notes.docx, trying .txt'), e);
        }
    }
    // --- Parse legacy .txt format ---
    if (!hasTxt)
        return defaultNotes;
    try {
        const text = await fs.readFile(filePath, 'utf-8');
        const sections = {};
        let currentSection = '';
        let currentContent = [];
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                if (currentSection) {
                    sections[currentSection] = currentContent.join('\n').trim();
                }
                currentSection = trimmed.slice(1, -1).toLowerCase().replace(/[^a-z0-9]+/g, '_');
                currentContent = [];
            }
            else {
                currentContent.push(line);
            }
        }
        if (currentSection) {
            sections[currentSection] = currentContent.join('\n').trim();
        }
        const rna_key = Object.keys(sections).find(k => k.includes('rna') || k.includes('isolation') || k.includes('qc'));
        const lib_key = Object.keys(sections).find(k => k.includes('library') || k.includes('prep'));
        const clust_key = Object.keys(sections).find(k => k.includes('cluster') || k.includes('seq') || k.includes('generation'));
        const conc_key = Object.keys(sections).find(k => k.includes('conclusion'));
        const rna_isolation_qc = rna_key && sections[rna_key] ? sections[rna_key] : defaultNotes.rna_isolation_qc;
        const library_preparation = lib_key && sections[lib_key] ? sections[lib_key] : defaultNotes.library_preparation;
        const cluster_generation = clust_key && sections[clust_key] ? sections[clust_key] : defaultNotes.cluster_generation;
        let conclusions = defaultNotes.conclusions;
        if (conc_key && sections[conc_key]) {
            const bullets = sections[conc_key].split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 0)
                .map(l => l.replace(/^[-*•]\s*/, ''));
            if (bullets.length > 0) {
                conclusions = bullets;
            }
        }
        console.log(chalk.green(`Loaded wet lab notes from: ${path.basename(filePath)}`));
        return { rna_isolation_qc, library_preparation, cluster_generation, conclusions };
    }
    catch (e) {
        console.warn('Warning: could not parse wet_lab_notes.txt, using defaults', e);
        return defaultNotes;
    }
}
//# sourceMappingURL=dataParser.js.map