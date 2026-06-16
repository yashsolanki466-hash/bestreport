import fs from 'fs-extra';
import path from 'path';
import { getConfigPath } from './paths.js';

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

const DEFAULT_CONFIG: AppConfig = {
  column_mapping: {
    raw_stats: {
      sample_col: ['Sample', 'SampleID', 'Sample Name', 'file', 'Sample_Name', 'Filename'],
      reads_r1_col: ['Total_Reads_R1', 'Total Reads R1', 'Read1_Count'],
      reads_r2_col: ['Total_Reads_R2', 'Total Reads R2', 'Read2_Count'],
      reads_col: ['Total_Reads', 'Total Reads(R1+R2)', 'Total Reads', 'num_seqs', 'Total_Read_Count'],
      bases_col: ['Total_Bases', 'Total Bases (R1+R2)', 'Total Bases', 'Total_Base_Count'],
      gb_col: ['Total_Data_GB', 'Total Data(GB)', 'Data(GB)', 'Total_Data_in_GB'],
      q30_col: ['Q30', 'Q30_Percent', '%Q30', 'Q30_Rate'],
      gc_col: ['GC%', 'GC', 'GC_Content', 'GC_Percent']
    },
    mapping_stats: {
      sample_col: ['sample', 'Sample', 'Sample Name', 'SampleID', 'Sample_Name'],
      total_reads_col: ['total reads', 'Total Reads', 'Total Clean Reads', 'Total_Reads', 'ReadCount'],
      mapped_reads_col: ['mapped reads', 'Mapped Reads', 'No. of Mapped reads', 'Mapped_Reads', 'No_of_Mapped_reads'],
      pct_mapped_col: ['mapped reads %', '% Mapped', '% of mapped reads', 'Percent_Mapped', 'Mapped_Percent'],
      unique_reads_col: ['uniquely mapped', 'uniquely mapped reads', 'Uniquely Mapped', 'Uniquely_Mapped_Reads'],
      pct_unique_col: ['unique%', '% Unique', '% uniquely mapped reads', 'Percent_Unique', 'Unique_Percent']
    },
    assembly_stats: {
      sample_col: ['Sample', 'Sample Name', 'sample'],
      transcripts_col: ['Number of Transcripts', 'Transcripts'],
      total_bp_col: ['Total (bp)', 'Total bp', 'Total Bases'],
      mean_size_col: ['Mean Size', 'Mean Transcript Size']
    },
    dge_stats: {
      fc_col: ['logfc', 'log2fc', 'log2foldchange', 'logfoldchange', 'lfc'],
      p_col: ['padj', 'adjp', 'adjpval', 'fdr', 'qvalue', 'qval', 'pvalue', 'pval'],
      cpm_col: ['logcpm', 'log_cpm'],
      mean_col: ['basemean', 'aveexpr']
    },
    pathway_stats: {
      level1_col: ['level1', 'level1category', 'category', 'class'],
      level2_col: ['level2', 'pathway', 'Pathway', 'Pathway Name'],
      count_col: ['count', 'Count', 'Gene Count', 'genes']
    }
  },
  qc_thresholds: {
    mapping_rate: 70,
    q30_rate: 80,
    min_reads: 5_000_000
  },
  dge_thresholds: {
    fdr: 0.05,
    log2fc: 1
  },
  required_directories: [
    '01_Raw_Data',
    '02_reference_genome_and_gff',
    '05_differential_expression_analysis',
    '06_Significant_DGE_GO',
    '07_Significant_DGE_pathways'
  ],
  optional_directory_groups: {
    mapping: ['03_Mapping', '01_Raw_Data'],
    assembly: ['04_transcript_assembly_gtf', '03_transcript_assembly_gtf', '04_transcript_sequences_fasta']
  },
  notifications: {
    enabled: false,
    webhook_url: ''
  }
};

let cachedConfig: AppConfig | null = null;

/** Minimal YAML parser for this project's config shape (no external dependency). */
function parseSimpleYaml(text: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [{ indent: -1, obj: root }];

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    if (trimmed.startsWith('- ')) {
      const val = parseYamlValue(trimmed.slice(2).trim());
      const lastKey = Object.keys(parent).pop();
      if (!lastKey) continue;
      const arr = parent[lastKey];
      if (!Array.isArray(arr)) {
        parent[lastKey] = [val];
      } else {
        (arr as unknown[]).push(val);
      }
      continue;
    }

    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const rest = trimmed.slice(colon + 1).trim();

    if (rest === '') {
      const child: Record<string, unknown> = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      parent[key] = rest
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      parent[key] = parseYamlValue(rest);
    }
  }
  return root;
}

function parseYamlValue(v: string): string | number | boolean {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v.replace(/^["']|["']$/g, '');
}

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const out = { ...base } as T;
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof (base as Record<string, unknown>)[k] === 'object') {
      (out as Record<string, unknown>)[k] = deepMerge(
        (base as Record<string, unknown>)[k] as Record<string, unknown>,
        v as Record<string, unknown>
      );
    } else if (v !== undefined) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

export async function loadConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;

  const configPath = getConfigPath();
  if (!(await fs.pathExists(configPath))) {
    cachedConfig = DEFAULT_CONFIG;
    return cachedConfig;
  }

  try {
    const text = await fs.readFile(configPath, 'utf-8');
    const parsed = parseSimpleYaml(text) as Record<string, unknown>;
    cachedConfig = deepMerge(
      DEFAULT_CONFIG as unknown as Record<string, unknown>,
      parsed
    ) as unknown as AppConfig;

    if (!cachedConfig.required_directories?.length) {
      cachedConfig.required_directories = DEFAULT_CONFIG.required_directories;
    }
    if (!cachedConfig.dge_thresholds) {
      cachedConfig.dge_thresholds = DEFAULT_CONFIG.dge_thresholds;
    }
    if (
      !cachedConfig.optional_directory_groups ||
      !Array.isArray(cachedConfig.optional_directory_groups.mapping)
    ) {
      cachedConfig.optional_directory_groups = DEFAULT_CONFIG.optional_directory_groups;
    }
    if (!cachedConfig.column_mapping.assembly_stats) {
      cachedConfig.column_mapping.assembly_stats = DEFAULT_CONFIG.column_mapping.assembly_stats;
    }
    if (!cachedConfig.column_mapping.raw_stats.reads_r1_col) {
      cachedConfig.column_mapping.raw_stats = {
        ...DEFAULT_CONFIG.column_mapping.raw_stats,
        ...cachedConfig.column_mapping.raw_stats
      };
    }
  } catch {
    cachedConfig = DEFAULT_CONFIG;
  }

  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
