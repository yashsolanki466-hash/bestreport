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

    // Create a mock GO distribution file (z2_sigDGE_GO_Statistics.txt)
    const goContent = [
      'COMBINATION\tSigDGE\tSqGO\tBP\tCC\tMF',
      'Comparison1\t4\t2\t0\t1\t0',
      'Comparison2\t10\t5\t3\t1\t4'
    ].join('\n');
    await fs.outputFile(path.join(goDir, 'z2_sigDGE_GO_Statistics.txt'), goContent);

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

      // Verify GO distribution stats parsed from the text file
      assert.equal(data.go_distribution.length, 2);
      assert.equal(data.go_distribution[0].combination, 'Comparison1');
      assert.equal(data.go_distribution[0].sig_dge, 4);
      assert.equal(data.go_distribution[0].sq_go, 2);
      assert.equal(data.go_distribution[0].bp, 0);
      assert.equal(data.go_distribution[0].cc, 1);
      assert.equal(data.go_distribution[0].mf, 0);

      assert.equal(data.go_distribution[1].combination, 'Comparison2');
      assert.equal(data.go_distribution[1].sig_dge, 10);
      assert.equal(data.go_distribution[1].sq_go, 5);
      assert.equal(data.go_distribution[1].bp, 3);
      assert.equal(data.go_distribution[1].cc, 1);
      assert.equal(data.go_distribution[1].mf, 4);


    } finally {
      // Clean up
      await fs.remove(tempProjectDir);
    }
  });

  it('falls back to auto-discovering lane map files if wetLabData lane_mapping has empty rows', async () => {
    const tempProjectDir = path.join(__dirname, '..', 'fixtures', 'temp_test_lane_project');
    await fs.ensureDir(tempProjectDir);

    // Create a mock metadata.json
    await fs.writeJson(path.join(tempProjectDir, 'metadata.json'), {
      project_id: 'LANE-TEST',
      samples: ['S1', 'S2']
    });

    // Create wet_lab_data.json with empty lane_mapping rows
    await fs.writeJson(path.join(tempProjectDir, 'wet_lab_data.json'), {
      project_id: 'LANE-TEST',
      lane_mapping: {
        headers: ['Lane id', 'Sample name', 'Lane id', 'Sample name', 'Lane id', 'Sample name'],
        rows: []
      }
    });

    // Create a mock LANE.csv file
    const laneCsvContent = [
      'Lane id,Sample name',
      '1,S1',
      '2,S2'
    ].join('\n');
    await fs.outputFile(path.join(tempProjectDir, 'LANE.csv'), laneCsvContent);

    try {
      const data = await parseProjectData(tempProjectDir);
      assert.ok(data.lane_mapping);
      assert.ok(data.lane_mapping.rows.length > 0);
      assert.equal(data.lane_mapping.rows[0][0], '1');
      assert.equal(data.lane_mapping.rows[0][1], 'S1');
      assert.equal(data.lane_mapping.rows[0][2], '2');
      assert.equal(data.lane_mapping.rows[0][3], 'S2');
    } finally {
      await fs.remove(tempProjectDir);
    }
  });
});

