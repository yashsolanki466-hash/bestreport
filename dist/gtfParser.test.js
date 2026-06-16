import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseGtfStats } from './gtfParser.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureGtf = path.join(__dirname, '..', 'fixtures', 'minimal_project', '02_reference_genome_and_gff', 'reference.gtf');
describe('gtfParser', () => {
    it('counts genes from GTF', async () => {
        const stats = await parseGtfStats(fixtureGtf);
        assert.ok(stats.geneCount >= 2);
    });
});
//# sourceMappingURL=gtfParser.test.js.map