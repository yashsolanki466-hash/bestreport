import fs from 'fs-extra';
import path from 'path';
import XLSX from 'xlsx';
import { execSync } from 'child_process';
import { ReportGenerator } from './reportGenerator.js';
import { getTemplateDir, getInterimTemplateDir, getWetLabNotesDocx, PACKAGE_ROOT } from './paths.js';
import { pickColumn } from './columnUtils.js';
import { parseWetLabNotes } from './dataParser.js';
import { resolvePathCaseInsensitive } from './statsDiscovery.js';

async function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', (err: any) => reject(err));
  });
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

export async function handleApi(req: any, res: any, next: any) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    // File serving endpoint
    if (pathname === '/api/file') {
      const filePath = url.searchParams.get('path');
      if (!filePath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing path parameter' }));
        return;
      }

      const decodedPath = decodeURIComponent(filePath);
      if (!(await fs.pathExists(decodedPath))) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': getMimeType(decodedPath) });
      fs.createReadStream(decodedPath).pipe(res);
      return;
    }

    if (pathname === '/api/list-dirs') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const parentPath = url.searchParams.get('path') || process.cwd();
      try {
        const entries = await fs.readdir(parentPath, { withFileTypes: true });
        const dirs = entries
          .filter(e => e.isDirectory() && !e.name.startsWith('.'))
          .map(e => e.name)
          .sort();
        
        // Resolve parent path
        let parent = path.dirname(parentPath);
        if (parent === parentPath) {
          parent = ''; // at root
        }

        res.end(JSON.stringify({
          success: true,
          currentPath: parentPath,
          parentPath: parent,
          dirs
        }));
      } catch (err: any) {
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (req.method !== 'POST') {
      next();
      return;
    }

    const bodyStr = await readBody(req);
    let body: any = {};
    if (bodyStr) {
      try {
        body = JSON.parse(bodyStr);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });

    if (pathname === '/api/select-folder') {
      try {
        const command = `powershell -NoProfile -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; if($f.ShowDialog() -eq 'OK'){$f.SelectedPath}"`;
        const selectedPath = execSync(command).toString().trim();
        res.end(JSON.stringify({ success: true, path: selectedPath }));
      } catch (err: any) {
        res.end(JSON.stringify({ success: false, error: 'Failed to open folder picker' }));
      }
      return;
    }

    if (pathname === '/api/scan-project') {
      const projectPath = body.projectPath;
      if (!projectPath || !(await fs.pathExists(projectPath))) {
        res.end(JSON.stringify({ success: false, error: 'Invalid or missing project path' }));
        return;
      }

      // Check for existing configurations case-insensitively
      const metadataPathResolved = await resolvePathCaseInsensitive(projectPath, 'metadata.json');
      const wetLabPathResolved = await resolvePathCaseInsensitive(projectPath, 'wet_lab_data.json');
      
      const metadataPath = metadataPathResolved || path.join(projectPath, 'metadata.json');
      const wetLabPath = wetLabPathResolved || path.join(projectPath, 'wet_lab_data.json');
      
      let metadata: any = {};
      let wetLabData: any = {};

      if (await fs.pathExists(metadataPath)) {
        try { metadata = await fs.readJson(metadataPath); } catch {}
      }
      if (await fs.pathExists(wetLabPath)) {
        try { wetLabData = await fs.readJson(wetLabPath); } catch {}
      }

      // Load wet lab notes — try project-local .docx first, then interim_app/, then root
      const notesDocxPath = getWetLabNotesDocx(projectPath);
      // parseWetLabNotes accepts .docx or .txt path; it strips extension to try .docx
      const parsedNotes = await parseWetLabNotes(notesDocxPath);

      if (!wetLabData.conclusions || wetLabData.conclusions.length === 0) {
        wetLabData.conclusions = parsedNotes.conclusions;
      }
      
      // Inject notes if not present in wetLabData
      if (!wetLabData.rna_isolation_qc) wetLabData.rna_isolation_qc = parsedNotes.rna_isolation_qc;
      if (!wetLabData.library_preparation) wetLabData.library_preparation = parsedNotes.library_preparation;
      if (!wetLabData.cluster_generation) wetLabData.cluster_generation = parsedNotes.cluster_generation;

      // Search recursively up to 2 levels
      const excelFiles: string[] = [];
      const imageFiles: string[] = [];

      async function scanDir(dir: string, depth = 0) {
        if (depth > 2) return;
        try {
          const entries = await fs.readdir(dir);
          for (const entry of entries) {
            if (entry.startsWith('.') || entry === 'node_modules' || entry === '.venv') continue;
            const fullPath = path.join(dir, entry);
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
              await scanDir(fullPath, depth + 1);
            } else if (stat.isFile()) {
              if (/\.(xlsx|xls|csv)$/i.test(entry)) {
                excelFiles.push(fullPath);
              } else if (/\.(png|jpg|jpeg)$/i.test(entry)) {
                imageFiles.push(fullPath);
              }
            }
          }
        } catch {}
      }

      await scanDir(projectPath);

      // Classify files based on common naming rules (for convenience)
      const qubitFiles = excelFiles.filter(f => {
        const name = path.basename(f).toLowerCase();
        return name.includes('qubit') || name.includes('quant');
      });
      const laneMapFiles = excelFiles.filter(f => {
        const name = path.basename(f).toLowerCase();
        return name.includes('lane') || name.includes('mapping') || name.includes('qc') || name.includes('rna');
      });
      const gelImages = imageFiles.filter(f => {
        const name = path.basename(f).toLowerCase();
        return name.includes('gel') || name.includes('agarose') || name.includes('rna_qc') || (name.includes('2600') && !name.includes('tape'));
      });
      const tapestationImages = imageFiles.filter(f => {
        const name = path.basename(f).toLowerCase();
        return name.includes('tapestation') || name.includes('profile') || name.includes('size_dist') || name.includes('tape');
      }).sort((a, b) => a.localeCompare(b));

      const assetsDir = path.join(PACKAGE_ROOT, 'assets');
      const logoPath = path.join(assetsDir, 'logo.png');
      const unipathLogoPath = path.join(assetsDir, 'unipath.png');

      res.end(JSON.stringify({
        success: true,
        metadata,
        wetLabData,
        excelFiles,
        imageFiles,
        qubitFiles,
        laneMapFiles,
        gelImages,
        tapestationImages,
        logoPath: (await fs.pathExists(logoPath)) ? logoPath : '',
        unipathLogoPath: (await fs.pathExists(unipathLogoPath)) ? unipathLogoPath : ''
      }));
      return;
    }

    if (pathname === '/api/parse-qubit') {
      const filePath = body.filePath;
      if (!filePath || !(await fs.pathExists(filePath))) {
        res.end(JSON.stringify({ success: false, error: 'File not found' }));
        return;
      }

      try {
        const buf = await fs.readFile(filePath);
        const workbook = XLSX.read(buf, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

        const qubitData = rawRows.map((row) => {
          const sample = pickColumn(row, ['Sample', 'Sample ID', 'Sample Name', 'sample', 'SampleID']) ?? '';
          const conc = pickColumn(row, ['Concentration', 'Qubit', 'ng/ul', 'ng/uL', 'Value', 'conc']) ?? 'N/A';
          const vol = pickColumn(row, ['Volume', 'vol', 'Vol']) ?? 'N/A';
          const yieldVal = pickColumn(row, ['Yield', 'yield']) ?? 'N/A';
          const remarks = pickColumn(row, ['Remarks', 'remarks', 'Note']) ?? '';

          return {
            sample_id: String(sample),
            conc: String(conc),
            vol: String(vol),
            yield: String(yieldVal),
            remarks: String(remarks)
          };
        }).filter(r => r.sample_id);

        res.end(JSON.stringify({ success: true, qubitData }));
      } catch (err: any) {
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/parse-lane-map') {
      const filePath = body.filePath;
      if (!filePath || !(await fs.pathExists(filePath))) {
        res.end(JSON.stringify({ success: false, error: 'File not found' }));
        return;
      }

      try {
        const buf = await fs.readFile(filePath);
        const workbook = XLSX.read(buf, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

        const lanes: any[] = [];
        
        for (const row of rawRows) {
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

        // Sort lanes numerically if possible
        lanes.sort((a, b) => {
          const na = parseInt(a.lane, 10);
          const nb = parseInt(b.lane, 10);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a.lane.localeCompare(b.lane);
        });

        res.end(JSON.stringify({ success: true, lanes }));
      } catch (err: any) {
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/generate-report') {
      const { projectPath, wetLabData, reportType } = body; // reportType: 'interim' | 'comprehensive'
      if (!projectPath || !(await fs.pathExists(projectPath))) {
        res.end(JSON.stringify({ success: false, error: 'Invalid project path' }));
        return;
      }

      try {
        // Save wet_lab_data.json to the directory
        const wetLabPath = path.join(projectPath, 'wet_lab_data.json');
        await fs.writeJson(wetLabPath, wetLabData, { spaces: 2 });

        // Use interim_app/templates for interim, shared templates/ for everything else
        const templateDir = reportType === 'interim' ? getInterimTemplateDir() : getTemplateDir();
        const generator = new ReportGenerator({
          templateDir,
          headless: true
        });

        const template = reportType === 'interim' ? 'report_interim' : 'report_comprehensive';
        const outputName = reportType === 'interim' ? `${wetLabData.project_id || 'NGS'}_interim_report` : `${wetLabData.project_id || 'NGS'}_report`;

        const result = await generator.generate({
          inputDir: projectPath,
          outputName,
          formats: ['html', 'pdf'],
          template,
          embedImages: true
        });

        await generator.close();
        res.end(JSON.stringify({ success: true, files: result.files }));
      } catch (err: any) {
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  } catch (err: any) {
    console.error('API Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}
