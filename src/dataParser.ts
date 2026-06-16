import fs from 'fs-extra';
import path from 'path';
import XLSX from 'xlsx';
import chalk from 'chalk';
import { execSync } from 'child_process';
import mammoth from 'mammoth';
import { loadConfig, type AppConfig } from './config.js';
import { asFloat, asInt, findColumn, normCol, pickColumn, downsample } from './columnUtils.js';
import { findReferenceGtf, findReferenceFasta, parseGtfStats, countFastaSequences, getFastaGenomeStats } from './gtfParser.js';
import { parseFastaAssemblyStats } from './fastaStats.js';
import {
  findStatsWorkbook,
  RAW_STATS_DIRS,
  RAW_STATS_PATTERNS,
  MAPPING_STATS_DIRS,
  MAPPING_STATS_PATTERNS,
  ASSEMBLY_STATS_DIRS,
  ASSEMBLY_STATS_PATTERNS
} from './statsDiscovery.js';
import { getAssetsDir, getComponentsDir, getStaticContentPath, PACKAGE_ROOT, getWetLabNotesDocx } from './paths.js';

/** 
 * Note: We now use extractRawText for primary parsing, but we keep this function
 * to handle legacy txt content/cleanup from older workflow formats.
 * Strip backslash escapes that mammoth adds during markdown conversion: \( → (, \- → -, etc. 
 */
function stripMarkdownEscapes(text: string): string {
  // Handle all common markdown escape sequences mammoth produces
  return text.replace(/\\([\\.()\[\]\-_*#!{}+])/g, '$1');
}

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
  application: string;
  no_of_samples: string;
  sample_count: number;
  samples: string[];
  qubit_data: Array<{ sample_id: string; conc: string; vol: string; yield: string; remarks: string }>;
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
  tapestation_images?: Array<{ sample_id: string; src: string }>;
  conclusions?: string[];
  library_kit?: string;
  size_range?: string;
  chemistry?: string;
  pathway_ex_figure_src: string;
  logo_path: string;
  warnings: string[];
  qc_issues: string[];
}

export async function parseProjectData(
  inputDir: string,
  metadataOverride?: Record<string, unknown>,
  templateName?: string
): Promise<ProjectData> {
  console.log(chalk.gray('Parsing project structure...'));
  const config = await loadConfig();

  // Load wet lab data if available
  const wetLabPath = path.join(inputDir, 'wet_lab_data.json');
  let wetLabData: Record<string, any> = {};
  if (await fs.pathExists(wetLabPath)) {
    try {
      wetLabData = JSON.parse(await fs.readFile(wetLabPath, 'utf-8'));
      console.log(chalk.green(`Loaded wet lab data from: wet_lab_data.json`));
    } catch {
      console.warn(chalk.yellow(`Warning: Could not parse wet_lab_data.json`));
    }
  }

  const isInterim = templateName === 'report_interim';

  const static_content = await loadStaticContent();
  const static_snippets = (static_content?.snippets as Record<string, unknown>) || {};

  // Load wet lab notes — prefer .docx from project folder, then interim_app/, then root
  const notesDocxPath = getWetLabNotesDocx(inputDir);
  const wetLabNotes = await parseWetLabNotes(notesDocxPath);

  // Always wire the parsed wet_lab notes into static_snippets.
  // Prefer values from wet_lab_data.json if present (edited in UI), otherwise use .docx
  if (!static_snippets.wet_lab) {
    (static_snippets as any).wet_lab = {};
  }
  const wl = static_snippets.wet_lab as any;
  
  wl.rna_isolation_qc = wetLabData.rna_isolation_qc || wetLabNotes.rna_isolation_qc;
  wl.rna_isolation_qc_header = wetLabData.rna_isolation_qc_header || 'Extraction and Quantitative analysis of RNA:';
  wl.library_preparation = wetLabData.library_preparation || wetLabNotes.library_preparation;
  wl.library_preparation_header = wetLabData.library_preparation_header || 'Preparation of Library:';
  wl.cluster_generation = wetLabData.cluster_generation || wetLabNotes.cluster_generation;
  wl.cluster_generation_header = wetLabData.cluster_generation_header || 'Cluster Generation and Sequencing:';
  wl.library_qc = wetLabData.library_qc || 'The amplified libraries were analyzed on TapeStation 4150 (Agilent Technologies) using High Sensitivity D1000 ScreenTape® as per manufacturer\'s instructions.';
  wl.library_qc_header = wetLabData.library_qc_header || 'Quantity and quality check (QC) of library on Agilent Tape Station 4150:';
  wl.conclusions_header = wetLabData.conclusions_header || 'Conclusions';

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
    if (gelImg) gel_image_src = path.join(inputDir, gelImg);
  }

  let lane_mapping = wetLabData.lane_mapping || null;
  if (!lane_mapping) {
    const files = await fs.readdir(inputDir).catch(() => []);
    const laneFile = files.find(f => {
      const name = f.toLowerCase();
      return name.includes('lane') || name.includes('mapping') || name.includes('qc') || name.includes('rna');
    });
    if (laneFile) {
      try {
        const filePath = path.join(inputDir, laneFile);
        const rows = await readExcelRows(filePath);
        const lanes: { lane: string; sample: string }[] = [];
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
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a.lane.localeCompare(b.lane);
        });

        const headers = ['Lane id', 'Sample name', 'Lane id', 'Sample name', 'Lane id', 'Sample name'];
        const gridRows: string[][] = [];
        for (let i = 0; i < lanes.length; i += 3) {
          const row: string[] = [];
          for (let j = 0; j < 3; j++) {
            const item = lanes[i + j];
            row.push(item ? item.lane : '');
            row.push(item ? item.sample : '');
          }
          gridRows.push(row);
        }
        lane_mapping = { headers, rows: gridRows };
      } catch {}
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

  let sequencing_stats: Array<Record<string, unknown>> = [];
  let ref_stats: Record<string, unknown> = {};
  let total_genes = 0;
  let mapping_stats: Array<Record<string, unknown>> = [];
  let assembly_stats: Array<Record<string, unknown>> = [];
  let total_transcripts = 0;
  let mean_transcript_size = 0;
  let diff_expr_stats: Array<Record<string, unknown>> = [];
  let dge_chart_labels: string[] = [];
  let dge_chart_up: number[] = [];
  let dge_chart_down: number[] = [];
  let dge_figures: Array<Record<string, unknown>> = [];
  let pathway_stats: Array<Record<string, unknown>> = [];
  let go_distribution: Array<Record<string, unknown>> = [];
  let dge_comparison_table: TableData = { headers: [], rows: [] };
  let dge_group_table: TableData = { headers: [], rows: [] };
  let func_assets: Record<string, any> = {
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
  let qc_issues: string[] = [];

  if (!isInterim) {
    sequencing_stats = await getSequencingStats(inputDir, config);
    ref_stats = await getReferenceStats(inputDir, metadataOverride);
    total_genes = (ref_stats?.total_genes as number) || 0;

    mapping_stats = await getMappingStats(inputDir, config);
    assembly_stats = await getAssemblyStats(inputDir, config);
    const merged = assembly_stats.find((s) => String(s.sample).toLowerCase().includes('merged'));
    total_transcripts = Number(merged?.num_transcripts) || 0;
    mean_transcript_size = Number(merged?.mean_size) || 0;

    const dgeThresholds = {
      fdr: (metadataOverride?.fdr as number) || config.dge_thresholds.fdr,
      log2fc: (metadataOverride?.log2fc as number) || config.dge_thresholds.log2fc
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
  const logo_path =
    (metadataOverride?.logo as string) ||
    ((await fs.pathExists(logoDefault)) ? logoDefault : '');

  const reference_organism = isInterim ? '' : (
    (metadataOverride?.reference_organism as string) ||
    (ref_stats?.organism as string) ||
    (project_details.reference_organism as string) ||
    'Organism Name'
  );

  return {
    project_id:
      (metadataOverride?.projectId as string) ||
      wetLabData.project_id ||
      project_details.project_id ||
      readmeData.project_id ||
      path.basename(inputDir),
    report_date: wetLabData.report_date || project_details.report_date || new Date().toLocaleDateString(),
    client_name:
      (metadataOverride?.client_name as string) ||
      (metadataOverride?.clientName as string) ||
      wetLabData.client_name ||
      project_details.client_name ||
      'Unknown',
    client_org: (metadataOverride?.client_org as string) || wetLabData.client_org || project_details.client_org || 'Unknown',
    project_pi:
      (metadataOverride?.piName as string) ||
      wetLabData.project_pi ||
      project_details.project_pi ||
      readmeData.project_pi ||
      '',
    application: wetLabData.application || project_details.application || readmeData.application || '',
    no_of_samples: wetLabData.no_of_samples || project_details.no_of_samples || readmeData.no_of_samples || String(sample_count),
    sample_count: wetLabData.sample_count !== undefined ? Number(wetLabData.sample_count) : sample_count,
    samples: wetLabData.samples || samples,
    qubit_data: (() => {
      if (wetLabData.qubit_data && wetLabData.qubit_data.length > 0) {
        const savedHasData = wetLabData.qubit_data.some((q: any) => q.conc !== 'N/A' && q.conc !== '');
        const parsedHasData = qubit_data && qubit_data.length > 0 && qubit_data.some((q: any) => q.conc !== 'N/A' && q.conc !== '');
        if (!savedHasData && parsedHasData) {
          return qubit_data;
        }
        return wetLabData.qubit_data.map((savedRow: any) => {
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
    library_sizes: wetLabData.library_sizes || library_sizes,
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
    warnings: isInterim ? [] : [...warnings, ...qc_issues],
    qc_issues,
    static_content,
    static_snippets,
    // Wet lab overrides
    service_type: wetLabData.service_type || 'Transcriptome Sequencing',
    platform: wetLabData.platform || 'Illumina Novaseq X Plus',
    read_length: wetLabData.read_length || '2 X 150 PE',
    data_throughput: wetLabData.data_throughput || '~06GB / Sample',
    sample_type: wetLabData.sample_type || 'Leaf',
    shipping_condition: wetLabData.shipping_condition || 'NA',
    no_of_libraries_prepared: wetLabData.no_of_libraries_prepared || String(sample_count),
    gel_image_src,
    lane_mapping,
    tapestation_images,
    conclusions: wetLabData.conclusions && wetLabData.conclusions.length > 0 ? wetLabData.conclusions : wetLabNotes.conclusions,
    library_kit: wetLabData.library_kit || '',
    size_range: wetLabData.size_range || '',
    chemistry: wetLabData.chemistry || ''
  };
}

function runQcChecks(
  sequencing: Array<Record<string, unknown>>,
  mapping: Array<Record<string, unknown>>,
  config: AppConfig
): string[] {
  const issues: string[] = [];
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

async function loadStaticContent(): Promise<Record<string, unknown>> {
  const staticContentPath = getStaticContentPath();
  if (await fs.pathExists(staticContentPath)) {
    try {
      return JSON.parse(await fs.readFile(staticContentPath, 'utf-8'));
    } catch {
      console.warn(chalk.yellow('Warning: Could not load static content JSON'));
    }
  }
  return {};
}

async function parseReadme(inputDir: string): Promise<Record<string, string>> {
  for (const readmeFile of ['Readme.txt', 'README.txt', 'readme.txt']) {
    const readmePath = path.join(inputDir, readmeFile);
    if (await fs.pathExists(readmePath)) {
      try {
        const content = await fs.readFile(readmePath, 'utf-8');
        const details: Record<string, string> = {};
        const patterns: Record<string, RegExp> = {
          project_id: /Project\s*ID\s*:\s*(.+)/i,
          project_pi: /Project\s*PI\s*:\s*(.+)/i,
          application: /Application\s*:\s*(.+)/i,
          no_of_samples: /No\s*of\s*Samples\s*:\s*(.+)/i
        };
        for (const [key, pattern] of Object.entries(patterns)) {
          const match = content.match(pattern);
          if (match) details[key] = match[1].trim();
        }
        return details;
      } catch {
        console.warn(chalk.yellow('Warning: Could not parse README'));
      }
    }
  }
  return {};
}

async function getProjectDetails(inputDir: string): Promise<Record<string, string>> {
  const metadataPath = path.join(inputDir, 'metadata.json');
  let metadata: Record<string, unknown> = {};
  if (await fs.pathExists(metadataPath)) {
    try {
      metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    } catch {
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

async function validateDeliverablesStructure(inputDir: string, config: AppConfig): Promise<string[]> {
  const warnings: string[] = [];
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

async function readExcelRows(filePath: string): Promise<Record<string, unknown>[]> {
  if (filePath.toLowerCase().endsWith('.txt') || filePath.toLowerCase().endsWith('.tsv')) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 1) return [];
    const headers = lines[0].split('\t').map((h) => h.trim());
    const results: Record<string, unknown>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      const obj: Record<string, unknown> = {};
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
  return XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
}

async function findExcelFiles(dir: string, predicate: (name: string) => boolean): Promise<string[]> {
  if (!(await fs.pathExists(dir))) return [];
  const files = await fs.readdir(dir);
  return files
    .filter((f) => predicate(f.toLowerCase()) && /\.(xlsx|xls|csv|txt|tsv)$/i.test(f))
    .map((f) => path.join(dir, f));
}

async function getSamples(inputDir: string, config: AppConfig): Promise<string[]> {
  const metadataPath = path.join(inputDir, 'metadata.json');
  if (await fs.pathExists(metadataPath)) {
    try {
      const meta = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      if (Array.isArray(meta.samples) && meta.samples.length) {
        return meta.samples.map((s: unknown) => String(s));
      }
    } catch { /* fall through */ }
  }

  const sheetPath = path.join(inputDir, 'sample_sheet.xlsx');
  if (await fs.pathExists(sheetPath)) {
    try {
      const rows = await readExcelRows(sheetPath);
      const names = rows
        .map((r) => pickColumn(r, ['Sample', 'Sample Name', 'sample', 'SampleID']))
        .filter(Boolean)
        .map(String);
      if (names.length) return [...new Set(names)];
    } catch { /* fall through */ }
  }

  const samples: string[] = [];
  const rawDataDir = path.join(inputDir, '01_Raw_Data');
  const aliases = config.column_mapping.raw_stats.sample_col;

  const statsFiles = await findExcelFiles(rawDataDir, (n) => n.includes('raw') || n.includes('stats'));
  for (const filePath of statsFiles) {
    try {
      const data = await readExcelRows(filePath);
      if (data.length === 0) continue;
      
      const sampleNames = new Set<string>();
      for (const row of data) {
        const val = String(pickColumn(row, aliases) ?? '');
        if (!val) continue;
        
        // Strip suffixes like _R1, _L001, etc.
        const match = val.match(/^([^_.]+)/);
        if (match) sampleNames.add(match[1]);
        else sampleNames.add(val);
      }
      samples.push(...sampleNames);
    } catch (e) {
      console.warn(chalk.yellow(`Warning: Could not parse samples from ${path.basename(filePath)}: ${e}`));
    }
  }

  return [...new Set(samples)];
}

async function getQubitData(
  inputDir: string,
  samples: string[]
): Promise<Array<{ sample_id: string; conc: string; vol: string; yield: string; remarks: string }>> {
  const results: Array<{ sample_id: string; conc: string; vol: string; yield: string; remarks: string }> = [];
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
      } catch { /* ignore */ }
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

async function getLibrarySizes(inputDir: string, samples: string[], sampleCount: number): Promise<number[]> {
  const sizes: number[] = [];
  const searchDirs = [inputDir, path.join(inputDir, '01_Raw_Data')];

  for (const dir of searchDirs) {
    for (const filePath of await findExcelFiles(dir, (n) =>
      n.includes('tape') || n.includes('library') || n.includes('bioanalyzer')
    )) {
      try {
        const rows = await readExcelRows(filePath);
        for (const row of rows) {
          const size = asFloat(
            pickColumn(row, ['Size', 'Mean Size', 'Peak Size', 'Library Size', 'bp'])
          );
          if (size !== null) sizes.push(Math.round(size));
        }
      } catch { /* ignore */ }
    }
  }

  if (sizes.length >= sampleCount && sampleCount > 0) {
    return sizes.slice(0, sampleCount);
  }
  const fallback = 450;
  return Array(Math.max(sampleCount, 1)).fill(sizes[0] ?? fallback);
}

async function getSequencingStats(inputDir: string, config: AppConfig): Promise<Array<Record<string, unknown>>> {
  const stats: Array<Record<string, unknown>> = [];
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
  } catch (e) {
    console.warn(chalk.yellow(`Warning: Could not parse sequencing stats: ${e}`));
  }
  return stats;
}

async function getReferenceStats(
  inputDir: string,
  metadataOverride?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const stats: Record<string, unknown> = {
    total_scaffolds: 'N/A',
    genome_length: 'N/A',
    mean_scaffold_size: 'N/A',
    max_scaffold_size: 'N/A',
    total_genes: 0,
    organism: 'Reference organism',
    source: 'N/A'
  };

  if (metadataOverride?.total_genes || metadataOverride?.total_genes === 0) {
    stats.total_genes = Number(metadataOverride.total_genes);
    stats.organism = String(metadataOverride.reference_organism || '');
    stats.source = 'metadata.json';
    // Fall through to see if we can get FASTA stats too
  }

  const refDirCandidates = [
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

  const gtfPath = await findReferenceGtf(refDir);

  if (gtfPath) {
    try {
      const gtfStats = await parseGtfStats(gtfPath);
      stats.total_genes = gtfStats.geneCount;
      stats.organism = gtfStats.organism || (stats.organism as string);
      stats.source = gtfPath;
    } catch (e) {
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
      if (!stats.total_genes) stats.total_genes = fastaStats.total;
      if (stats.source === 'N/A') stats.source = path.basename(fastaPath);
    } catch (e) {
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
    } catch { /* ignore */ }
  }

  return stats;
}

async function getMappingStats(inputDir: string, config: AppConfig): Promise<Array<Record<string, unknown>>> {
  const stats: Array<Record<string, unknown>> = [];
  const cols = config.column_mapping.mapping_stats;

  let workbookPath = await findStatsWorkbook(inputDir, MAPPING_STATS_PATTERNS, MAPPING_STATS_DIRS);
  if (!workbookPath) {
    // Fallback: look for ANY .txt or .xlsx file in 01_Raw_Data that might contain mapping info
    const rawDir = path.join(inputDir, '01_Raw_Data');
    if (await fs.pathExists(rawDir)) {
      const candidates = await findExcelFiles(rawDir, (n) => n.includes('mapping') || n.includes('alignment'));
      if (candidates.length > 0) workbookPath = candidates[0];
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
  } catch (e) {
    console.warn(chalk.yellow(`Warning: Could not parse mapping stats: ${e}`));
  }
  return stats;
}

async function getAssemblyStats(inputDir: string, config: AppConfig): Promise<Array<Record<string, unknown>>> {
  const stats: Array<Record<string, unknown>> = [];
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
          mean_size: pickColumn(row, cols.mean_size_col) ?? '0'
        });
      }
      return stats;
    } catch (e) {
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
    if (!(await fs.pathExists(dir))) continue;

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
          mean_size: row.mean_size
        });
        console.log(chalk.gray(`  Assembly from FASTA: ${file} (${row.num_transcripts} transcripts)`));
      } catch (e) {
        console.warn(chalk.yellow(`Warning: Could not parse ${file}: ${e}`));
      }
    }
    if (stats.length) break;
  }

  if (stats.length === 0) {
    console.warn(chalk.yellow('Warning: No assembly statistics found (workbook or per-sample FASTA/GTF)'));
  }
  return stats;
}

function findNumericColumn(data: Record<string, unknown>[], aliases: string[]): string | null {
  if (!data?.length) return null;
  const columns = Object.keys(data[0]);
  const normMap: Record<string, string> = {};
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

async function findExcelFilesRecursive(dir: string, predicate: (name: string) => boolean): Promise<string[]> {
  if (!(await fs.pathExists(dir))) return [];
  const results: string[] = [];

  async function scan(currentDir: string, depth: number) {
    if (depth > 3) return; // Safeguard
    const name = path.basename(currentDir).toLowerCase();
    if (name.includes('raw_data') || name.includes('fasta') || name.includes('gtf')) return; // Skip large folders

    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await scan(fullPath, depth + 1);
      } else if (entry.isFile() && /\.(xlsx|xls|csv)$/i.test(entry.name) && predicate(entry.name.toLowerCase())) {
        results.push(fullPath);
      }
    }
  }

  await scan(dir, 0);
  return results;
}

async function chooseFile(files: string[]): Promise<string | null> {
  if (!files || files.length === 0) return null;
  const existing: string[] = [];
  for (const f of files) {
    if (await fs.pathExists(f)) {
      existing.push(f);
    }
  }
  if (existing.length === 0) return null;

  const stats = await Promise.all(
    existing.map(async (f) => {
      const s = await fs.stat(f);
      return { file: f, mtime: s.mtimeMs, size: s.size };
    })
  );

  stats.sort((a, b) => b.mtime - a.mtime || b.size - a.size);
  return stats[0].file;
}

function ensureRowsHaveKeys(
  rows: Array<Record<string, unknown>>,
  keys: string[],
  warningMessage: string,
  extra?: Record<string, unknown>
): Array<Record<string, unknown>> {
  if (!rows || rows.length === 0) {
    const r: Record<string, unknown> = {};
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
    if (bad) break;
  }

  if (!bad) return rows;

  const r: Record<string, unknown> = {};
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

async function getPathwayStats(inputDir: string, config: AppConfig): Promise<Array<Record<string, unknown>>> {
  let stats: Array<Record<string, unknown>> = [];
  const cols = config.column_mapping.pathway_stats;
  const pathwayDir = path.join(inputDir, '07_Significant_DGE_pathways');

  let files: string[] = [];
  if (await fs.pathExists(pathwayDir)) {
    files = await findExcelFiles(pathwayDir, (n) => n.endsWith('.xlsx') || n.endsWith('.xls'));
  }
  if (files.length === 0) {
    files = await findExcelFilesRecursive(inputDir, (n) =>
      n.includes('significant') && n.includes('dge') && n.includes('pathway')
    );
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
        return ensureRowsHaveKeys(
          [],
          ['level1', 'level2', 'count'],
          'Pathway columns not recognized',
          { level2: `File: ${path.relative(inputDir, filePath).replace(/\\/g, '/')}` }
        );
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
    } catch (err) {
      console.warn(chalk.yellow(`Warning: Could not parse pathway stats from ${filePath}: ${err}`));
    }
  }

  stats.sort((a, b) => (b.count as number) - (a.count as number));
  stats = stats.slice(0, 50);

  if (files.length === 0) {
    return ensureRowsHaveKeys(
      [],
      ['level1', 'level2', 'count'],
      'No pathway file found',
      { level2: 'Expected in 07_Significant_DGE_pathways or matching *Pathway*.xlsx' }
    );
  }

  if (stats.length > 0 && !stats.some(s => s.level1 && s.level1 !== 'Unknown' && s.level1 !== '')) {
    return ensureRowsHaveKeys(
      [],
      ['level1', 'level2', 'count'],
      'Pathway columns not recognized',
      { level2: "Found file but 'level1' column was missing or empty." }
    );
  }

  return ensureRowsHaveKeys(stats, ['level1', 'level2', 'count'], 'Pathway stats unavailable');
}

async function getGODistribution(inputDir: string): Promise<Array<Record<string, unknown>>> {
  console.log(chalk.gray('  GO distribution: looking for files...'));
  const goDir = path.join(inputDir, '06_Significant_DGE_GO');
  let stats: Array<Record<string, unknown>> = [];

  let files: string[] = [];
  if (await fs.pathExists(goDir)) {
    files.push(...await findExcelFiles(goDir, (n) => n.includes('with_go')));
    files.push(...await findExcelFiles(goDir, (n) => n.includes('go') && n.includes('distribution')));
    files.push(...await findExcelFiles(goDir, (n) => n.includes('go') && n.includes('results')));
    if (files.length === 0) {
      files.push(...await findExcelFiles(goDir, (n) => n.includes('go')));
    }
  }

  if (files.length === 0) {
    files.push(...await findExcelFilesRecursive(inputDir, (n) => n.includes('go') && n.includes('distribution')));
    files.push(...await findExcelFilesRecursive(inputDir, (n) => n.includes('with_go')));
  }

  files = Array.from(new Set(files));
  const filePath = await chooseFile(files);
  if (filePath) {
    try {
      const data = await readExcelRows(filePath);
      
      const termCol = findColumn(data, ['term', 'go_term', 'description', 'goterm']);
      const countCol = findNumericColumn(data, ['count', 'gene_count', 'genes']);
      const ontCol = findColumn(data, ['ontology', 'category', 'namespace', 'class']);

      if (termCol && countCol) {
        for (const row of data) {
          const term = String(pickColumn(row, [termCol]) ?? 'Unknown').trim();
          const count = asInt(pickColumn(row, [countCol])) ?? 0;
          const ontology = ontCol ? String(pickColumn(row, [ontCol]) ?? 'N/A').trim() : 'N/A';
          if (term) {
            stats.push({ term, count, ontology });
          }
        }
        stats.sort((a, b) => (b.count as number) - (a.count as number));
        stats = stats.slice(0, 30);
        return ensureRowsHaveKeys(stats, ['term', 'count', 'ontology'], 'GO distribution unavailable');
      }

      const catCol = findColumn(data, ['annotationgocategory', 'annotation_go_category', 'go_category', 'category', 'ontology']);
      const rawTermCol = findColumn(data, ['annotationgoterm', 'annotation_go_term', 'go_term', 'term']);

      if (catCol && rawTermCol) {
        const counts: Record<string, number> = {};
        const keyMap: Record<string, { cat: string; term: string }> = {};

        for (const row of data) {
          const cVal = String(pickColumn(row, [catCol]) ?? '');
          const tVal = String(pickColumn(row, [rawTermCol]) ?? '');
          const cats = cVal.split(';');
          const terms = tVal.split(';');
          
          const maxLen = Math.min(cats.length, terms.length);
          for (let i = 0; i < maxLen; i++) {
            const cat = cats[i].trim();
            const term = terms[i].trim();
            if (cat && term) {
              const key = `${cat}|||${term}`;
              counts[key] = (counts[key] || 0) + 1;
              keyMap[key] = { cat, term };
            }
          }
        }

        const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        for (const key of sortedKeys.slice(0, 30)) {
          const { cat, term } = keyMap[key];
          stats.push({
            ontology: cat,
            term,
            count: counts[key]
          });
        }
        return ensureRowsHaveKeys(stats, ['term', 'count', 'ontology'], 'GO distribution unavailable');
      }

    } catch (err) {
      console.warn(chalk.yellow(`Warning: Could not parse GO distribution from ${filePath}: ${err}`));
    }
  }

  if (files.length === 0) {
    return ensureRowsHaveKeys(
      [],
      ['term', 'count', 'ontology'],
      'No GO file found',
      { term: 'Expected in 06_Significant_DGE_GO or matching *GO*.xlsx' }
    );
  }

  return ensureRowsHaveKeys(stats, ['term', 'count', 'ontology'], 'GO distribution unavailable');
}

async function getDGECombinedData(
  inputDir: string,
  thresholds: { fdr: number; log2fc: number }
): Promise<{
  stats: Array<Record<string, unknown>>;
  labels: string[];
  up_counts: number[];
  down_counts: number[];
  figures: Array<Record<string, unknown>>;
}> {
  const stats: Array<Record<string, unknown>> = [];
  const labels: string[] = [];
  const up_counts: number[] = [];
  const down_counts: number[] = [];
  const figures: Array<Record<string, unknown>> = [];

  const dgeDir = path.join(inputDir, '05_differential_expression_analysis');
  if (!(await fs.pathExists(dgeDir))) {
    return { stats, labels, up_counts, down_counts, figures };
  }

  const allFiles = await fs.readdir(dgeDir);
  const xlsxFiles = allFiles.filter((f) => f.toLowerCase().includes('dge') && /\.(xlsx|xls)$/i.test(f));

  function normalizeComp(name: string): string {
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

      let sig_up = 0;
      let sig_down = 0;

      const plotData = {
        ma: { up: [] as any[], down: [] as any[], ns: [] as any[] },
        volcano: { up: [] as any[], down: [] as any[], ns: [] as any[] }
      };

      for (const row of data) {
        const fc = asFloat(row[fcCol ?? '']);
        const pval = sigCol ? asFloat(row[sigCol]) : null;
        const fdr = pval ?? 1;

        const isSig = pval !== null && pval > 0 && pval < thresholds.fdr;
        let bucket: 'ns' | 'up' | 'down' = 'ns';

        if (fc !== null) {
          if (isSig && fc >= thresholds.log2fc) {
            sig_up++;
            bucket = 'up';
          } else if (isSig && fc <= -thresholds.log2fc) {
            sig_down++;
            bucket = 'down';
          }

          // Plot data
          const cpm = cpmCol ? asFloat(row[cpmCol]) : null;
          const meanExpr = meanCol ? asFloat(row[meanCol]) : null;

          let maX = cpm;
          if (maX === null && meanExpr !== null && meanExpr >= 0) {
            maX = Math.log10(meanExpr + 1);
          }

          if (maX !== null) {
            plotData.ma[bucket].push({ x: maX, y: fc });
          }
          if (pval !== null && pval > 0) {
            plotData.volcano[bucket].push({ x: fc, y: -Math.log10(pval) });
          }
        }
      }

      // Downsample for charts
      const maxPoints = 8000;
      for (const key of ['ma', 'volcano'] as const) {
        for (const bucket of ['up', 'down', 'ns'] as const) {
          plotData[key][bucket] = downsample(plotData[key][bucket], maxPoints);
        }
      }

      const hasMAData = Object.values(plotData.ma).some((a) => a.length > 0);
      const hasVolcanoData = Object.values(plotData.volcano).some((a) => a.length > 0);

      // Find assets (heatmap, pdf)
      const heatmap = allFiles.find((f) => {
        if (!/\.png$/i.test(f) || !/heatmap/i.test(f)) return false;
        return normalizeComp(f).includes(compNorm);
      });

      const maVolcano = allFiles.find((f) => {
        if (!/\.pdf$/i.test(f) || !/(volcano|ma)/i.test(f)) return false;
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
      } else {
        console.warn(chalk.yellow(`      WARNING: No plot data generated for ${comparison}. Check if columns like LogFC and P-value are present.`));
      }

    } catch (err) {
      console.warn(chalk.yellow(`      Warning: Could not process DGE file ${file}: ${err}`));
    }
  }

  return { stats, labels, up_counts, down_counts, figures };
}

async function getDGEComparisonTables(
  inputDir: string,
  static_snippets: Record<string, unknown>,
  metadataOverride?: Record<string, unknown>
): Promise<{ dge_comparison_table: TableData; dge_group_table: TableData }> {
  const empty: TableData = { headers: [], rows: [] };
  const metadataPath = path.join(inputDir, 'metadata.json');
  let metadata: Record<string, unknown> = {};

  if (await fs.pathExists(metadataPath)) {
    try {
      metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    } catch { /* ignore */ }
  }

  let cmp =
    (metadataOverride?.dge_comparison_table as TableData) ||
    (metadata.dge_comparison_table as TableData);
  let grp =
    (metadataOverride?.dge_group_table as TableData) ||
    (metadata.dge_group_table as TableData);

  // Helper to find file recursively or locally
  async function findFile(filename: string): Promise<string | null> {
    const local = path.join(inputDir, filename);
    if (await fs.pathExists(local)) return local;
    
    // Check in subfolders
    async function search(dir: string): Promise<string | null> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.venv') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = await search(fullPath);
          if (found) return found;
        } else if (entry.name.toLowerCase() === filename.toLowerCase()) {
          return fullPath;
        }
      }
      return null;
    }
    try {
      return await search(inputDir);
    } catch {
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
          const rows: string[][] = [];
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
      } catch (err) {
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
          const rows: string[][] = [];
          const headers = ['GROUP NAME', 'SAMPLE NAME'];
          
          lines.forEach((line) => {
            const parts = line.split('\t').map(p => p.trim()).filter(p => p.length > 0);
            if (parts.length >= 2) {
              if (parts[0].toLowerCase().startsWith('group') || parts[0].toLowerCase().startsWith('test')) {
                if (parts[0].toLowerCase() === 'group name' || parts[0].toLowerCase() === 'group') return;
              }
              rows.push([parts[0], parts[1]]);
            }
          });
          
          if (rows.length > 0) {
            grp = { headers, rows };
          }
        }
      } catch (err) {
        console.warn(`Error parsing samples_described.txt: ${err}`);
      }
    }
  }

  const dgeSnippet = static_snippets.dge as Record<string, unknown> | undefined;

  return {
    dge_comparison_table:
      cmp?.rows?.length ? cmp :
      (dgeSnippet?.comparison_info_table as TableData) || {
        headers: ['Comparison', 'Description'],
        rows: []
      },
    dge_group_table:
      grp?.rows?.length ? grp :
      (dgeSnippet?.group_sample_table as TableData) || {
        headers: ['Group Name', 'Sample Name'],
        rows: []
      }
  };
}

async function extractFunctionalAssets(inputDir: string): Promise<Record<string, unknown>> {
  const assets: Record<string, unknown> = {
    go_results_xlsx: '',
    kegg_results_xlsx: '',
    go_results_preview: [] as unknown[],
    kegg_results_preview: [] as unknown[],
    kegg_pathway_image_src: '',
    enrichment_image_src: '',
    barplot_image_src: '',
    dotplot_image_src: '',
    enrichment_plots: [] as Array<{ comparison: string; type: string; plotType: string; src: string }>
  };

  async function findFilesRecursive(pattern: string, extensions: string[]): Promise<string[]> {
    const found: string[] = [];
    async function search(dir: string) {
      if (!(await fs.pathExists(dir))) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.venv') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await search(fullPath);
        } else if (
          entry.name.toLowerCase().includes(pattern.toLowerCase()) &&
          extensions.some((ext) => entry.name.toLowerCase().endsWith(ext))
        ) {
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
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown[][];
      assets.go_results_preview = data.slice(0, 16); // slice 16 to get top 15 rows + header
    } catch { /* ignore */ }
  }

  // Find KEGG pathway excel files in 07 folder specifically, falling back to recursive search
  const pathwayDir = path.join(inputDir, '07_Significant_DGE_pathways');
  let keggFiles: string[] = [];
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
    if (aIn07 !== bIn07) return bIn07 - aIn07;
    
    const aComp = aName.match(/comparison_(\d+)/i);
    const bComp = bName.match(/comparison_(\d+)/i);
    if (aComp && bComp) {
      return parseInt(aComp[1], 10) - parseInt(bComp[1], 10);
    }
    
    const aScore = (aName.includes('enrichment') ? 2 : 0) + (aName.includes('results') ? 1 : 0);
    const bScore = (bName.includes('enrichment') ? 2 : 0) + (bName.includes('results') ? 1 : 0);
    if (aScore !== bScore) return bScore - aScore;
    
    return aName.localeCompare(bName);
  });

  if (keggFiles.length) {
    assets.kegg_results_xlsx = keggFiles[0];
    try {
      const wb = XLSX.readFile(keggFiles[0]);
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown[][];
      assets.kegg_results_preview = data; // use the whole table instead of top 15 rows
    } catch { /* ignore */ }
  }

  // 2. Find KEGG representative pathway image
  const images = await findFilesRecursive('kegg', ['.png', '.jpg', '.jpeg', '.svg']);
  const pathwayImg = images.find((f) => path.basename(f).toLowerCase().includes('path'));
  if (pathwayImg) assets.kegg_pathway_image_src = pathwayImg;

  // 3. Find enrichment barplots and dotplots recursively
  const allPngs = await findFilesRecursive('', ['.png', '.jpg', '.jpeg', '.svg']);
  const enrichment_plots: Array<{ comparison: string; type: string; plotType: string; src: string }> = [];

  for (const imgPath of allPngs) {
    const filename = path.basename(imgPath).toLowerCase();
    if (filename.includes('barplot') || filename.includes('dotplot')) {
      let comparison = 'Comparison';
      const compMatch = filename.match(/c\d+_sig_(up|down)/i);
      if (compMatch) {
        comparison = compMatch[0].toUpperCase();
      } else {
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
    if (a.comparison !== b.comparison) return a.comparison.localeCompare(b.comparison);
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.plotType.localeCompare(b.plotType);
  });

  assets.enrichment_plots = enrichment_plots;

  // Set representative barplot and dotplot
  const barplot = enrichment_plots.find((p) => p.plotType === 'barplot');
  const dotplot = enrichment_plots.find((p) => p.plotType === 'dotplot');
  if (barplot) assets.barplot_image_src = barplot.src;
  if (dotplot) assets.dotplot_image_src = dotplot.src;

  const enrich = [
    ...(await findFilesRecursive('enrich', ['.png', '.jpg', '.jpeg', '.svg'])),
    ...(await findFilesRecursive('dotplot', ['.png', '.jpg', '.jpeg', '.svg']))
  ];
  if (enrich.length) assets.enrichment_image_src = enrich[0];

  return assets;
}

async function getDeliverablesTree(inputDir: string): Promise<string> {
  for (const readmeFile of ['Readme.txt', 'README.txt', 'readme.txt']) {
    const readmePath = path.join(inputDir, readmeFile);
    if (await fs.pathExists(readmePath)) {
      try {
        const lines = (await fs.readFile(readmePath, 'utf-8')).split('\n');
        const treeLines = lines.filter((line) => /(\|--|├──|└──|│\s+)/.test(line) || line.includes('--'));
        if (treeLines.length) return treeLines.join('\n').trim();
      } catch { /* ignore */ }
    }
  }
  return buildDeliverablesTreeFromFS(inputDir);
}

async function buildDeliverablesTreeFromFS(inputDir: string, maxDepth = 4): Promise<string> {
  const out: string[] = [`${path.basename(inputDir)}/`];

  async function walk(dir: string, depth: number) {
    if (depth >= maxDepth) return;
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
    } catch { /* ignore */ }
  }

  await walk(inputDir, 0);
  return out.join('\n');
}

async function findComponentAsset(componentsDir: string, assetName: string | string[]): Promise<string> {
  const names = Array.isArray(assetName) ? assetName : [assetName];
  for (const name of names) {
    const assetPath = path.join(componentsDir, name);
    if (await fs.pathExists(assetPath)) return assetPath;
  }
  return '';
}

export interface WetLabNotes {
  rna_isolation_qc: string;
  library_preparation: string;
  cluster_generation: string;
  conclusions: string[];
}

export async function parseWetLabNotes(filePath: string): Promise<WetLabNotes> {
  const defaultNotes: WetLabNotes = {
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
      const HEADING_PATTERNS: Array<{ key: string; pattern: RegExp }> = [
        { key: 'rna_isolation', pattern: /^RNA Isolation/i },
        { key: 'library_preparation', pattern: /^Library Preparation/i },
        { key: 'cluster_generation', pattern: /^Cluster Generation/i },
        { key: 'conclusions', pattern: /^Conclusions?/i },
        // Skip document title / intro paragraphs
        { key: '_title', pattern: /^NGS Wet Lab Notes/i },
        { key: '_intro', pattern: /^This document contains/i },
      ];

      const sections: Record<string, string> = {};
      let currentSection = '';
      let currentContent: string[] = [];

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
        } else {
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
    } catch (e) {
      console.warn(chalk.yellow('Warning: could not parse wet_lab_notes.docx, trying .txt'), e);
    }
  }


  // --- Parse legacy .txt format ---
  if (!hasTxt) return defaultNotes;

  try {
    const text = await fs.readFile(filePath, 'utf-8');
    const sections: Record<string, string> = {};
    let currentSection = '';
    let currentContent: string[] = [];

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        currentSection = trimmed.slice(1, -1).toLowerCase().replace(/[^a-z0-9]+/g, '_');
        currentContent = [];
      } else {
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
  } catch (e) {
    console.warn('Warning: could not parse wet_lab_notes.txt, using defaults', e);
    return defaultNotes;
  }
}

