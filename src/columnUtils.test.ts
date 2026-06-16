import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findColumn, pickColumn, normCol, asFloat } from './columnUtils.js';

describe('columnUtils', () => {
  it('normalizes column names', () => {
    assert.equal(normCol('log2FoldChange'), 'log2foldchange');
  });

  it('finds fold-change column', () => {
    const data = [{ logFC: 1, FDR: 0.01 }];
    assert.equal(findColumn(data, ['log2fc', 'logfc']), 'logFC');
  });

  it('picks values using aliases', () => {
    const row = { 'Sample Name': 'S1', '% Mapped': 92.5 };
    assert.equal(pickColumn(row, ['Sample', 'Sample Name']), 'S1');
    assert.equal(asFloat(pickColumn(row, ['% Mapped', 'Percent Mapped'])), 92.5);
  });

  it('matches Qubit headers with non-ASCII and special characters correctly', () => {
    const row = {
      'Sample ID': 'S1R1',
      'Concentration (ng/µl)': 372,
      'Volume (µl )': 60,
      'Yield (µg)': 22.32,
      'Remarks': 'QC PASS'
    };
    assert.equal(pickColumn(row, ['Concentration', 'Qubit', 'ng/ul', 'ng/uL', 'Value', 'conc']), 372);
    assert.equal(pickColumn(row, ['Volume', 'vol', 'Vol']), 60);
    assert.equal(pickColumn(row, ['Yield', 'yield']), 22.32);
  });
});
