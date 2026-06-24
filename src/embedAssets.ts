import fs from 'fs-extra';
import path from 'path';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);
const MAX_EMBED_BYTES = 8 * 1024 * 1024;

const PATH_KEYS = new Set([
  'logo_path',
  'unipath_logo_path',
  'pathway_image_src',
  'gffcompare_codes_src',
  'workflow_figure_src',
  'stringtie_merge_figure_src',
  'isoforms_figure_src',
  'pathway_ex_figure_src',
  'heatmap_png_src',
  'ma_volcano_pdf_src',
  'kegg_pathway_image_src',
  'enrichment_image_src',
  'go_results_xlsx',
  'kegg_results_xlsx',
  'dge_xlsx_src',
  'barplot_image_src',
  'dotplot_image_src',
  'gel_image_src',
  'src',
  'metagenome_phylum_chart_src',
  'metagenome_heatmap_src',
  'metagenome_alpha_plot_src',
  'metagenome_rarefaction_src',
  'metagenome_pcoa_src',
  'metagenome_krona_src'
]);

function isLocalFilePath(v: string): boolean {
  if (!v || v.startsWith('data:') || v.startsWith('http://') || v.startsWith('https://')) {
    return false;
  }
  return /^([a-zA-Z]:\\|\\\\|\/)/.test(v) || v.includes(path.sep);
}

async function fileToDataUri(filePath: string): Promise<string | null> {
  try {
    if (!(await fs.pathExists(filePath))) return null;
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return null;

    const ext = path.extname(filePath).toLowerCase();
    if (!IMAGE_EXT.has(ext)) return null;

    if (stat.size > MAX_EMBED_BYTES) {
      console.warn(`Skipping embed (image too large): ${path.basename(filePath)}`);
      return null;
    }

    const buf = await fs.readFile(filePath);
    if (ext === '.svg') {
      const encoded = encodeURIComponent(buf.toString('utf-8'));
      return `data:image/svg+xml;charset=utf-8,${encoded}`;
    }
    const mime =
      ext === '.png' ? 'image/png' :
      ext === '.gif' ? 'image/gif' :
      ext === '.webp' ? 'image/webp' :
      'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Convert local image paths in report data to data URIs for reliable PDF rendering. */
export async function embedAssetsInData<T>(data: T): Promise<T> {
  return (await embedValue(data, new WeakSet())) as T;
}

async function embedValue(value: unknown, seen: WeakSet<object>): Promise<unknown> {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (!isLocalFilePath(value)) return value;
    const embedded = await fileToDataUri(value);
    return embedded ?? value;
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => embedValue(item, seen)));
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return value;
    seen.add(value as object);

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string' && PATH_KEYS.has(k) && isLocalFilePath(v)) {
        const embedded = await fileToDataUri(v);
        out[k] = embedded ?? v;
      } else {
        out[k] = await embedValue(v, seen);
      }
    }
    return out;
  }

  return value;
}
