import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import XLSX from 'xlsx';
import { parseProjectData } from './dataParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, '..', 'fixtures', 'minimal_project');

describe('parseProjectData', () => {
  it('parses minimal fixture metadata', async () => {
    const data = await parseProjectData(fixtureDir);
    assert.equal(data.project_id, 'DEMO-001');
    assert.equal(data.project_pi, 'Dr. Example');
    assert.deepEqual(data.samples, ['S1', 'S2']);
    assert.ok(data.total_genes >= 2);
  });

  it('parses pathway and GO distribution correctly with numeric count matching and sorting', async () => {
    const tempProjectDir = path.join(__dirname, '..', 'fixtures', 'temp_test_project');
    await fs.ensureDir(tempProjectDir);

    // Create required folders
    const pathwayDir = path.join(tempProjectDir, '07_Significant_DGE_pathways');
    const goDir = path.join(tempProjectDir, '06_Significant_DGE_GO');
    await fs.ensureDir(pathwayDir);
    await fs.ensureDir(goDir);

    // Create a mock metadata.json
    await fs.writeJson(path.join(tempProjectDir, 'metadata.json'), {
      project_id: 'TEMP-001',
      samples: ['S1', 'S2']
    });

    // Create a mock KEGG pathway file
    // Note: the count_col alias list includes: ['count', 'Count', 'Gene Count', 'genes']
    // We add a 'genes' column with string values (to test numeric count matching)
    // and a 'Count' column with actual counts.
    const pathwayWb = XLSX.utils.book_new();
    const pathwayWs = XLSX.utils.json_to_sheet([
      { 'Level 1 Category': 'Metabolism', 'Level 2 Sub-Category': 'Carbohydrate metabolism', 'genes': 'AT1G01010', 'Count': 15 },
      { 'Level 1 Category': 'Metabolism', 'Level 2 Sub-Category': 'Energy metabolism', 'genes': 'AT1G01020', 'Count': 5 },
      { 'Level 1 Category': 'Genetic Information Processing', 'Level 2 Sub-Category': 'Translation', 'genes': 'AT1G01030', 'Count': 25 }
    ]);
    XLSX.utils.book_append_sheet(pathwayWb, pathwayWs, 'Sheet1');
    await XLSX.writeFile(pathwayWb, path.join(pathwayDir, 'kegg_pathways.xlsx'));

    // Create a mock GO distribution file
    // We use a pre-summarized format to test Case 1 of getGODistribution
    const goWb = XLSX.utils.book_new();
    const goWs = XLSX.utils.json_to_sheet([
      { 'Ontology': 'BP', 'Term': 'transcription', 'genes': 'AT1G02010', 'Count': 8 },
      { 'Ontology': 'MF', 'Term': 'kinase activity', 'genes': 'AT1G02020', 'Count': 18 },
      { 'Ontology': 'CC', 'Term': 'nucleus', 'genes': 'AT1G02030', 'Count': 12 }
    ]);
    XLSX.utils.book_append_sheet(goWb, goWs, 'Sheet1');
    await XLSX.writeFile(goWb, path.join(goDir, 'go_distribution.xlsx'));

    try {
      const data = await parseProjectData(tempProjectDir);

      // Verify pathway stats: should be sorted by count descending (Translation (25) -> Carbohydrate (15) -> Energy (5))
      assert.equal(data.pathway_stats.length, 3);
      assert.equal(data.pathway_stats[0].level2, 'Translation');
      assert.equal(data.pathway_stats[0].count, 25);
      assert.equal(data.pathway_stats[1].level2, 'Carbohydrate metabolism');
      assert.equal(data.pathway_stats[1].count, 15);
      assert.equal(data.pathway_stats[2].level2, 'Energy metabolism');
      assert.equal(data.pathway_stats[2].count, 5);

      // Verify GO distribution stats: should be sorted by count descending (kinase activity (18) -> nucleus (12) -> transcription (8))
      assert.equal(data.go_distribution.length, 3);
      assert.equal(data.go_distribution[0].term, 'kinase activity');
      assert.equal(data.go_distribution[0].count, 18);
      assert.equal(data.go_distribution[1].term, 'nucleus');
      assert.equal(data.go_distribution[1].count, 12);
      assert.equal(data.go_distribution[2].term, 'transcription');
      assert.equal(data.go_distribution[2].count, 8);

    } finally {
      // Clean up
      await fs.remove(tempProjectDir);
    }
  });
});
