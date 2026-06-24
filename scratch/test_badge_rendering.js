import fs from 'fs-extra';
import ejs from 'ejs';

const content = await fs.readFile('templates/report_comprehensive.ejs', 'utf-8');

// Mock context with qubit_data containing remarks that trigger status badges
const mockContext = {
  project_id: 'DEMO-001',
  sample_count: 1,
  samples: ['S1'],
  library_sizes: [300],
  qubit_data: [
    { sample_id: 'S1', conc: '10', vol: '20', yield: '0.2', remarks: 'QC PASS' },
    { sample_id: 'S2', conc: '5', vol: '15', yield: '0.075', remarks: 'QC FAIL' },
    { sample_id: 'S3', conc: '12', vol: '18', yield: '0.216', remarks: 'QC WARNING' }
  ],
  deliverables_tree: 'tree contents',
  go_distribution: [],
  pathway_stats: [],
  assembly_stats: [],
  static_snippets: {},
  workflow_figure_src: '',
  isoforms_figure_src: '',
  stringtie_merge_figure_src: '',
  sequencing_stats: [],
  mapping_stats: [],
  total_genes: 0,
  total_transcripts: 0,
  mean_transcript_size: 0,
  application: 'RNA-Seq',
  no_of_samples: '3',
  qc_issues: [],
  lane_mapping: null,
  reference_organism: 'Arabidopsis thaliana',
  genome: 'TAIR10',
  ref_stats: {},
  diff_expr_stats: [],
  dge_comparison_table: { headers: [], rows: [] },
  dge_group_table: { headers: [], rows: [] },
  func_assets: {},
  gffcompare_codes_src: '',
  static_content: {},
  pathway_ex_figure_src: '',
  conclusions: [],
  pca_plots: [],
  correlation_plots: [],
  // We need other required variables for compile if any, let's catch what is missing
  project_pi: 'Dr. Test',
  client_name: 'Test Client',
  client_org: 'Test Org',
  report_date: '2026-06-20',
  logo_path: 'logo.png',
  shipping_condition: 'Dry Ice',
  no_of_libraries_prepared: 1,
  tapestation_images: [],
  library_sizes_json: '[]',
  samples_json: '[]',
  dge_chart_labels: [],
  dge_chart_up: [],
  dge_chart_down: [],
  dge_figures: [],
  volcano: { ns: [], down: [], up: [] },
  warnings: []
};

try {
  const rendered = ejs.render(content, mockContext);
  
  // Check if status-badge is present in the rendered HTML
  const passIndex = rendered.indexOf('status-badge status-pass');
  const failIndex = rendered.indexOf('status-badge status-fail');
  const warnIndex = rendered.indexOf('status-badge status-warn');
  
  if (passIndex !== -1 && failIndex !== -1 && warnIndex !== -1) {
    console.log("SUCCESS: All status badges (pass, fail, warn) rendered correctly!");
    console.log("Rendered Pass HTML snippet:");
    console.log(rendered.substring(passIndex - 50, passIndex + 150));
  } else {
    console.log("FAILURE: Status badges did not render correctly.");
    console.log(`Pass: ${passIndex !== -1}, Fail: ${failIndex !== -1}, Warn: ${warnIndex !== -1}`);
  }
} catch (e) {
  console.error("Compilation error during test:");
  console.error(e);
}
