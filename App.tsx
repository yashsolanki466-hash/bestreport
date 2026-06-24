import React, { useState, useEffect } from 'react';

interface QubitRow {
  sample_id: string;
  conc: string;
  vol: string;
  yield: string;
  remarks: string;
}

interface LaneRow {
  lane: string;
  sample: string;
}

interface TapeStationImage {
  sample_id: string;
  src: string;
}

export default function App() {
  const [projectPath, setProjectPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const [projectId, setProjectId] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
  const [clientOrg, setClientOrg] = useState('');
  const [projectPi, setProjectPi] = useState('');
  const [refGenomeLink, setRefGenomeLink] = useState('https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/405/GCF_000001405.40_GRCh38.p14/');
  const [serviceType, setServiceType] = useState('Transcriptome Sequencing');
  const [platform, setPlatform] = useState('Illumina Novaseq X Plus');
  const [readLength, setReadLength] = useState('2 X 150 PE');
  const [dataThroughput, setDataThroughput] = useState('~06GB / Sample');
  const [sampleType, setSampleType] = useState('Leaf');
  const [shippingCondition, setShippingCondition] = useState('NA');
  const [noOfSamples, setNoOfSamples] = useState('24');
  const [noOfLibrariesPrepared, setNoOfLibrariesPrepared] = useState('24');

  const [selectedQubitFile, setSelectedQubitFile] = useState('');
  const [selectedLaneMapFile, setSelectedLaneMapFile] = useState('');
  const [selectedGelImage, setSelectedGelImage] = useState('');

  const [samplesList, setSamplesList] = useState<string[]>([]);
  const [qubitData, setQubitData] = useState<QubitRow[]>([]);
  const [librarySizes, setLibrarySizes] = useState<number[]>([]);
  const [conclusions, setConclusions] = useState<string[]>([
    'The libraries were prepared from the samples by KAPA mRNA HyperPrep Kit for Illumina (CAT #KK8581).',
    'The average size of libraries is in range of 330bp to 360bp* for all samples.',
    'The libraries will be sequenced on Illumina Novaseq X Plus platform using 2-x 150 bp chemistry to generate ~06GB/Sample.'
  ]);

  const [gelImage, setGelImage] = useState('');
  const [gelImagePreview, setGelImagePreview] = useState('');
  const [lanes, setLanes] = useState<LaneRow[]>([]);

  const [tapestationImages, setTapestationImages] = useState<TapeStationImage[]>([]);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showMsg = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  useEffect(() => {
    const savedPath = localStorage.getItem('ngs_project_path');
    if (savedPath) {
      setProjectPath(savedPath);
    }
  }, []);

  const pathBasename = (p: string) => {
    const parts = p.split(/[\\/]/);
    return parts[parts.length - 1] || 'Project';
  };

  const handleScan = async () => {
    if (!projectPath.trim()) {
      showMsg('Please provide a valid project folder path.', 'error');
      return;
    }

    setLoading(true);
    try {
      localStorage.setItem('ngs_project_path', projectPath.trim());
      const response = await fetch('/api/scan-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: projectPath.trim() })
      });

      const res = await response.json();
      if (!res.success) {
        showMsg(res.error || 'Failed to scan project path.', 'error');
        setScanResult(null);
        return;
      }

      setScanResult(res);
      showMsg('Scan complete! Found project files.', 'success');

      const data = res.wetLabData.project_id ? res.wetLabData : res.metadata;

      setProjectId(data.project_id || res.metadata.project_id || pathBasename(projectPath));
      setReportDate(data.report_date || reportDate);
      setClientOrg(data.client_org || res.metadata.client_org || '');
      setProjectPi(data.submitted_to || data.project_pi || res.metadata.submitted_to || res.metadata.project_pi || '');
      setRefGenomeLink(data.ref_genome_link || res.metadata.ref_genome_link || 'https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/405/GCF_000001405.40_GRCh38.p14/');
      setServiceType(data.service_type || 'Transcriptome Sequencing');
      setPlatform(data.platform || 'Illumina Novaseq X Plus');
      setReadLength(data.read_length || '2 X 150 PE');
      setDataThroughput(data.data_throughput || '~06GB / Sample');
      setSampleType(data.sample_type || 'Leaf');
      setShippingCondition(data.shipping_condition || 'NA');
      setNoOfSamples(data.no_of_samples || String(data.samples?.length || '24'));
      setNoOfLibrariesPrepared(data.no_of_libraries_prepared || String(data.samples?.length || '24'));

      let activeSamples = data.samples || [];
      setSamplesList(activeSamples);

      const qubitRows = data.qubit_data;
      const hasQubitNAs = qubitRows && qubitRows.length > 0 && qubitRows.every((r: any) => r.conc === 'N/A' || r.conc === '');

      if (qubitRows && !hasQubitNAs) {
        setQubitData(qubitRows);
      } else if (res.qubitFiles && res.qubitFiles.length > 0) {
        setSelectedQubitFile(res.qubitFiles[0]);
        const parsedSamples = await parseQubitFile(res.qubitFiles[0]);
        if (parsedSamples && parsedSamples.length > 0) {
          activeSamples = parsedSamples;
        }
      } else if (qubitRows) {
        setQubitData(qubitRows);
      }

      if (data.lane_mapping && data.lane_mapping.rows && data.lane_mapping.rows.length > 0) {
        const rows = data.lane_mapping.rows || [];
        const flattedLanes: LaneRow[] = [];
        rows.forEach((r: string[]) => {
          for (let i = 0; i < r.length; i += 2) {
            if (r[i]) flattedLanes.push({ lane: r[i], sample: r[i + 1] || '' });
          }
        });
        setLanes(flattedLanes);
      } else if (res.laneMapFiles && res.laneMapFiles.length > 0) {
        setSelectedLaneMapFile(res.laneMapFiles[0]);
        await parseLaneMapFile(res.laneMapFiles[0]);
      }

      if (data.library_sizes) {
        setLibrarySizes(data.library_sizes);
      } else {
        setLibrarySizes(Array.from({ length: activeSamples.length || 24 }).map(() => 350));
      }

      if (data.conclusions) {
        setConclusions(data.conclusions);
      }

      if (data.gel_image_src) {
        setGelImage(data.gel_image_src);
        setGelImagePreview(data.gel_image_src.startsWith('data:') ? data.gel_image_src : `/api/file?path=${encodeURIComponent(data.gel_image_src)}`);
        setSelectedGelImage(data.gel_image_src);
      } else if (res.gelImages && res.gelImages.length > 0) {
        setGelImage(res.gelImages[0]);
        setGelImagePreview(`/api/file?path=${encodeURIComponent(res.gelImages[0])}`);
        setSelectedGelImage(res.gelImages[0]);
      }

      if (data.tapestation_images) {
        setTapestationImages(data.tapestation_images);
      } else {
        const tsImg = res.tapestationImages.map((p: string, idx: number) => {
          const sId = activeSamples[idx] || `Sample ${idx + 1}`;
          return {
            sample_id: sId,
            src: p
          };
        });
        setTapestationImages(tsImg);
      }

    } catch (e: any) {
      showMsg('Network error: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const parseQubitFile = async (filePath: string): Promise<string[]> => {
    if (!filePath) return [];
    setLoading(true);
    try {
      const response = await fetch('/api/parse-qubit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      const res = await response.json();
      if (res.success && res.qubitData.length > 0) {
        setQubitData(res.qubitData);
        const parsed = res.qubitData.map((r: any) => r.sample_id);
        setSamplesList(parsed);
        setNoOfSamples(String(parsed.length));
        setNoOfLibrariesPrepared(String(parsed.length));
        setLibrarySizes(parsed.map(() => 350));
        showMsg('Parsed Qubit spreadsheet columns successfully!', 'success');
        return parsed;
      } else {
        showMsg(res.error || 'No rows parsed from spreadsheet.', 'error');
      }
    } catch (e: any) {
      showMsg('Failed to parse file: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
    return [];
  };

  const parseLaneMapFile = async (filePath: string) => {
    if (!filePath) return;
    setLoading(true);
    try {
      const response = await fetch('/api/parse-lane-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      const res = await response.json();
      if (res.success && res.lanes.length > 0) {
        setLanes(res.lanes);
        showMsg('Parsed Gel lane mapping spreadsheet successfully!', 'success');
      } else {
        showMsg(res.error || 'No lanes parsed from spreadsheet.', 'error');
      }
    } catch (e: any) {
      showMsg('Failed to parse file: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatLaneMapping = () => {
    const headers = ['Lane id', 'Sample name', 'Lane id', 'Sample name', 'Lane id', 'Sample name'];
    const rows: string[][] = [];

    for (let i = 0; i < lanes.length; i += 3) {
      const row: string[] = [];
      for (let j = 0; j < 3; j++) {
        const item = lanes[i + j];
        row.push(item ? item.lane : '');
        row.push(item ? item.sample : '');
      }
      rows.push(row);
    }
    return { headers, rows };
  };

  const handleGenerate = async (type: 'interim' | 'comprehensive') => {
    if (!projectPath.trim()) {
      showMsg('Provide folder path first.', 'error');
      return;
    }

    setLoading(true);
    try {
      const wetLabPayload = {
        project_id: projectId,
        report_date: reportDate,
        client_name: projectPi,
        submitted_to: projectPi,
        ref_genome_link: refGenomeLink,
        client_org: clientOrg,
        project_pi: projectPi,
        service_type: serviceType,
        platform: platform,
        read_length: readLength,
        data_throughput: dataThroughput,
        sample_type: sampleType,
        shipping_condition: shippingCondition,
        no_of_samples: noOfSamples,
        no_of_libraries_prepared: noOfLibrariesPrepared,
        samples: samplesList.length > 0 ? samplesList : qubitData.map(r => r.sample_id),
        qubit_data: qubitData,
        library_sizes: librarySizes,
        gel_image_src: gelImage,
        lane_mapping: formatLaneMapping(),
        tapestation_images: tapestationImages,
        conclusions: conclusions
      };

      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: projectPath.trim(),
          wetLabData: wetLabPayload,
          reportType: type
        })
      });

      const res = await response.json();
      if (res.success) {
        showMsg(`Successfully generated ${type} reports! (HTML and PDF written to folder)`, 'success');
      } else {
        showMsg(res.error || 'Generation failed.', 'error');
      }
    } catch (e: any) {
      showMsg('Error generating: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateQubitRow = (idx: number, field: keyof QubitRow, value: string) => {
    const updated = [...qubitData];
    updated[idx] = { ...updated[idx], [field]: value };
    setQubitData(updated);

    if (field === 'sample_id') {
      const newList = updated.map(r => r.sample_id).filter(Boolean);
      setSamplesList(newList);
    }
  };

  const addQubitRow = () => {
    setQubitData([...qubitData, { sample_id: `Sample ${qubitData.length + 1}`, conc: '', vol: '', yield: '', remarks: 'QC PASS' }]);
    setLibrarySizes([...librarySizes, 350]);
  };

  const removeQubitRow = (idx: number) => {
    const updated = qubitData.filter((_, i) => i !== idx);
    setQubitData(updated);
    setSamplesList(updated.map(r => r.sample_id).filter(Boolean));
    setLibrarySizes(librarySizes.filter((_, i) => i !== idx));
  };

  const updateLaneRow = (idx: number, field: keyof LaneRow, value: string) => {
    const updated = [...lanes];
    updated[idx] = { ...updated[idx], [field]: value };
    setLanes(updated);
  };

  const addLaneRow = () => {
    setLanes([...lanes, { lane: String(lanes.length + 1), sample: '' }]);
  };

  const removeLaneRow = (idx: number) => {
    setLanes(lanes.filter((_, i) => i !== idx));
  };

  const updateConclusion = (idx: number, value: string) => {
    const updated = [...conclusions];
    updated[idx] = value;
    setConclusions(updated);
  };

  const addConclusion = () => {
    setConclusions([...conclusions, '']);
  };

  const removeConclusion = (idx: number) => {
    setConclusions(conclusions.filter((_, i) => i !== idx));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 text-slate-800 font-sans p-8">

      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center pb-8 border-b border-slate-200/60 mb-10">
        <div className="text-center md:text-left mb-4 md:mb-0">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 drop-shadow-sm">
            Unigenome NGS Report Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-2">Wet Lab interim report automation &mdash; edit <span className="font-mono bg-slate-200/60 px-2 py-0.5 rounded text-slate-700">wet_lab_notes.docx</span> in Word to update methods text</p>
        </div>
        <div className="text-xs bg-white/70 backdrop-blur-sm border border-slate-200 rounded-xl px-5 py-3 text-slate-600 font-mono shadow-sm">
          System Time: {new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

        <section className="lg:col-span-1 space-y-7">
          <div className="bg-white border border-slate-200/70 rounded-2xl p-7 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-200/60 transition-all duration-300">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-orange-600">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
              Project Directory Setup
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Project Path (Absolute)
                </label>
                <input
                  type="text"
                  placeholder="e.g. C:\Bioinfo\interim_projects\NGS_260046_interim"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 font-mono transition-all duration-200"
                />
                <p className="text-[11px] text-slate-400 mt-2">
                  Each NGS project lives in its own folder inside <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">interim_projects/</span>
                </p>
              </div>

              <button
                onClick={handleScan}
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 disabled:from-orange-400 disabled:to-amber-400 text-white font-bold py-4 px-6 rounded-xl text-base transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-orange-500/30 flex justify-center items-center gap-3 transform hover:-translate-y-0.5"
              >
                {loading && (
                  <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Scan Folder
              </button>

              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-2">
                <p className="font-bold flex items-center gap-2 text-amber-900">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Static text is in Word
                </p>
                <p className="leading-relaxed">Open <span className="font-mono bg-amber-100/70 px-1.5 py-0.5 rounded">wet_lab_notes.docx</span> inside each project folder to edit method descriptions and conclusions. Changes take effect on next report generation.</p>
              </div>
            </div>
          </div>

          {scanResult && (
            <div className="bg-white border border-slate-200/70 rounded-2xl p-7 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-200/60 transition-all duration-300 space-y-5">
              <h3 className="text-base font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-3 mb-2">
                Wet Lab File Linker
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">
                  1. Select Qubit Excel Sheet
                </label>
                <select
                  value={selectedQubitFile}
                  onChange={(e) => {
                    setSelectedQubitFile(e.target.value);
                    parseQubitFile(e.target.value);
                  }}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 font-mono transition-all duration-200"
                >
                  <option value="">-- Click to choose --</option>
                  {(scanResult.excelFiles || []).map((f: string) => (
                    <option key={f} value={f}>{f.split(/[\\/]/).pop()}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">
                  2. Select RNA Gel lane Map Sheet
                </label>
                <select
                  value={selectedLaneMapFile}
                  onChange={(e) => {
                    setSelectedLaneMapFile(e.target.value);
                    parseLaneMapFile(e.target.value);
                  }}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 font-mono transition-all duration-200"
                >
                  <option value="">-- Click to choose --</option>
                  {(scanResult.excelFiles || []).map((f: string) => (
                    <option key={f} value={f}>{f.split(/[\\/]/).pop()}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">
                  3. Select Agarose Gel Image
                </label>
                <select
                  value={selectedGelImage}
                  onChange={(e) => {
                    setSelectedGelImage(e.target.value);
                    setGelImage(e.target.value);
                    setGelImagePreview(e.target.value ? `/api/file?path=${encodeURIComponent(e.target.value)}` : '');
                  }}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 font-mono transition-all duration-200"
                >
                  <option value="">-- Click to choose --</option>
                  {(scanResult.imageFiles || []).map((f: string) => (
                    <option key={f} value={f}>{f.split(/[\\/]/).pop()}</option>
                  ))}
                </select>
              </div>

              {gelImagePreview && (
                <div className="pt-3">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Gel Preview</span>
                  <img src={gelImagePreview} alt="Gel Preview" className="w-full h-40 object-contain bg-slate-50 border-2 border-slate-200 rounded-xl" />
                </div>
              )}
            </div>
          )}
        </section>

        <section className="lg:col-span-2 space-y-7">
          {message && (
            <div className={`p-5 rounded-2xl border text-sm font-semibold flex items-center justify-between shadow-xl transition-all duration-300 transform ${message.type === 'success' ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-400 text-emerald-800' :
                message.type === 'error' ? 'bg-gradient-to-r from-rose-50 to-red-50 border-rose-400 text-rose-800' :
                  'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-400 text-blue-800'
              }`}>
              <span className="flex items-center gap-2">
                {message.type === 'success' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
                {message.type === 'error' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>}
                {message.type === 'info' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                {message.text}
              </span>
              <button onClick={() => setMessage(null)} className="hover:opacity-70 transition-opacity text-xl">✕</button>
            </div>
          )}

          <div className="bg-white border border-slate-200/70 rounded-2xl p-8 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-200/60 transition-all duration-300 space-y-8">
            <h2 className="text-2xl font-bold text-orange-600 border-b border-slate-200 pb-4 flex items-center gap-3">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
              Report Information & Metadata
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-2">Project ID</label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-2">Report Date</label>
                <input
                  type="text"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-2">Submitted To</label>
                <input
                  type="text"
                  value={projectPi}
                  onChange={(e) => setProjectPi(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-1">
                <label className="block text-xs text-slate-500 font-semibold mb-2">Reference Genome Link</label>
                <input
                  type="text"
                  value={refGenomeLink}
                  onChange={(e) => setRefGenomeLink(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-2">Client Organization</label>
                <input
                  type="text"
                  value={clientOrg}
                  onChange={(e) => setClientOrg(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-2">Service Type</label>
                <input
                  type="text"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-2">Platform</label>
                <input
                  type="text"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-2">Read Length</label>
                <input
                  type="text"
                  value={readLength}
                  onChange={(e) => setReadLength(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-2">Data Volume / Sample</label>
                <input
                  type="text"
                  value={dataThroughput}
                  onChange={(e) => setDataThroughput(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-2">Sample Type</label>
                <input
                  type="text"
                  value={sampleType}
                  onChange={(e) => setSampleType(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-2">Shipping Condition</label>
                <input
                  type="text"
                  value={shippingCondition}
                  onChange={(e) => setShippingCondition(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-2">No. of Samples</label>
                <input
                  type="text"
                  value={noOfSamples}
                  onChange={(e) => setNoOfSamples(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center border-t border-slate-200 pt-5">
                <h3 className="text-lg font-bold text-slate-700">
                  RNA Quantification (Qubit) Data Table
                </h3>
                <button
                  onClick={addQubitRow}
                  className="bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 text-orange-700 border-2 border-orange-200 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  + Add Row
                </button>
              </div>

              <div className="max-h-[350px] overflow-y-auto border-2 border-slate-200 rounded-2xl bg-slate-50">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 text-xs font-bold sticky top-0 border-b-2 border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Sample ID</th>
                      <th className="px-5 py-3">Conc. (ng/µl)</th>
                      <th className="px-5 py-3">Vol. (µl)</th>
                      <th className="px-5 py-3">Yield (µg)</th>
                      <th className="px-5 py-3">Remarks</th>
                      <th className="px-5 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qubitData.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-200 hover:bg-orange-50 transition-colors duration-200">
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={row.sample_id}
                            onChange={(e) => updateQubitRow(idx, 'sample_id', e.target.value)}
                            className="bg-white border-2 border-slate-200 rounded-lg px-3 py-2 text-xs w-full font-mono text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 transition-all duration-200"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={row.conc}
                            onChange={(e) => updateQubitRow(idx, 'conc', e.target.value)}
                            className="bg-white border-2 border-slate-200 rounded-lg px-3 py-2 text-xs w-full text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 transition-all duration-200"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={row.vol}
                            onChange={(e) => updateQubitRow(idx, 'vol', e.target.value)}
                            className="bg-white border-2 border-slate-200 rounded-lg px-3 py-2 text-xs w-full text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 transition-all duration-200"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={row.yield}
                            onChange={(e) => updateQubitRow(idx, 'yield', e.target.value)}
                            className="bg-white border-2 border-slate-200 rounded-lg px-3 py-2 text-xs w-full text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 transition-all duration-200"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={(e) => updateQubitRow(idx, 'remarks', e.target.value)}
                            className="bg-white border-2 border-slate-200 rounded-lg px-3 py-2 text-xs w-full text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 transition-all duration-200"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeQubitRow(idx)}
                            className="text-rose-600 hover:text-rose-700 font-bold text-lg hover:scale-110 transition-transform"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4 border-t border-slate-200 pt-5">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-700">
                  RNA Agarose Gel Lane Mapping Grid
                </h3>
                <button
                  onClick={addLaneRow}
                  className="bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 text-orange-700 border-2 border-orange-200 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  + Add Lane
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[250px] overflow-y-auto p-1">
                {lanes.map((lane, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-2xl p-4 flex gap-3 items-center justify-between hover:border-orange-300 hover:shadow-lg transition-all duration-200">
                    <div className="flex gap-3 items-center">
                      <input
                        type="text"
                        value={lane.lane}
                        onChange={(e) => updateLaneRow(idx, 'lane', e.target.value)}
                        placeholder="Lane"
                        className="bg-white border-2 border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm w-12 text-center font-bold focus:outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 transition-all duration-200"
                      />
                      <input
                        type="text"
                        value={lane.sample}
                        onChange={(e) => updateLaneRow(idx, 'sample', e.target.value)}
                        placeholder="Sample ID"
                        className="bg-white border-2 border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm w-32 font-mono focus:outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 transition-all duration-200"
                      />
                    </div>
                    <button
                      onClick={() => removeLaneRow(idx)}
                      className="text-rose-600 hover:text-rose-700 text-lg font-bold hover:scale-110 transition-transform"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {scanResult && (
              <div className="space-y-4 border-t border-slate-200 pt-5">
                <h3 className="text-lg font-bold text-slate-700">
                  Agilent TapeStation 4150 Profiles Assigner
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[350px] overflow-y-auto p-1">
                  {qubitData.map((row, idx) => {
                    const assignedImg = tapestationImages.find(img => img.sample_id === row.sample_id)?.src || '';
                    return (
                      <div key={idx} className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-2xl p-5 flex flex-col gap-3 hover:border-orange-300 hover:shadow-lg transition-all duration-200">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-base font-bold text-slate-800">{row.sample_id}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 font-semibold">Peak Size (bp):</span>
                            <input
                              type="number"
                              value={librarySizes[idx] || 350}
                              onChange={(e) => {
                                const updatedSizes = [...librarySizes];
                                updatedSizes[idx] = parseInt(e.target.value, 10) || 350;
                                setLibrarySizes(updatedSizes);
                              }}
                              className="bg-white border-2 border-slate-200 rounded-lg px-3 py-1.5 text-sm w-20 text-center text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 transition-all duration-200"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 font-semibold mb-2">Assign Profile Image</label>
                          <select
                            value={assignedImg}
                            onChange={(e) => {
                              const updatedImgs = tapestationImages.filter(img => img.sample_id !== row.sample_id);
                              if (e.target.value) {
                                updatedImgs.push({ sample_id: row.sample_id, src: e.target.value });
                              }
                              setTapestationImages(updatedImgs);
                            }}
                            className="w-full bg-white border-2 border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 font-mono transition-all duration-200"
                          >
                            <option value="">-- No Image --</option>
                            {(scanResult.imageFiles || []).map((f: string) => (
                              <option key={f} value={f}>{f.split(/[\\/]/).pop()}</option>
                            ))}
                          </select>
                        </div>
                        {assignedImg && (
                          <div className="mt-2 flex items-center gap-3">
                            <img
                              src={assignedImg.startsWith('data:') ? assignedImg : `/api/file?path=${encodeURIComponent(assignedImg)}`}
                              alt="Tape Profile"
                              className="h-16 w-auto object-contain bg-white rounded-lg border-2 border-slate-200"
                            />
                            <span className="text-[11px] text-slate-500 font-mono truncate" title={assignedImg}>
                              {assignedImg.split(/[\\/]/).pop()}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-4 border-t border-slate-200 pt-5">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-700">
                  Interim Conclusions (Section 5)
                </h3>
                <button
                  onClick={addConclusion}
                  className="bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 text-orange-700 border-2 border-orange-200 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  + Add Point
                </button>
              </div>

              <ul className="space-y-4">
                {conclusions.map((bullet, idx) => (
                  <li key={idx} className="flex gap-4 items-center bg-slate-50 border-2 border-slate-200 rounded-xl p-4 hover:border-orange-300 hover:shadow-lg transition-all duration-200">
                    <span className="text-orange-600 font-bold text-2xl">•</span>
                    <input
                      type="text"
                      value={bullet}
                      onChange={(e) => updateConclusion(idx, e.target.value)}
                      className="bg-white border-2 border-slate-200 rounded-lg px-4 py-2.5 text-sm flex-grow text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
                    />
                    <button
                      onClick={() => removeConclusion(idx)}
                      className="text-rose-600 hover:text-rose-700 font-bold text-xl hover:scale-110 transition-transform"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-slate-200 pt-8 flex flex-col lg:flex-row gap-6 justify-between items-center">
              <div className="text-sm text-slate-500 text-center lg:text-left">
                Data will be saved as <span className="font-mono text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded">wet_lab_data.json</span> inside project deliverables root.
              </div>
              <div className="flex gap-4 flex-wrap justify-center">
                <button
                  onClick={() => handleGenerate('interim')}
                  disabled={loading}
                  className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:from-amber-400 disabled:to-orange-400 text-white font-bold py-4 px-7 rounded-xl text-base transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-amber-500/30 flex items-center gap-3 transform hover:-translate-y-0.5"
                >
                  Generate Interim Report
                </button>
                <button
                  onClick={() => handleGenerate('comprehensive')}
                  disabled={loading}
                  className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-700 hover:via-amber-700 hover:to-orange-700 disabled:from-orange-400 disabled:via-amber-400 disabled:to-orange-400 text-white font-bold py-4 px-7 rounded-xl text-base transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-orange-500/30 flex items-center gap-3 transform hover:-translate-y-0.5"
                >
                  Generate Combined Report
                </button>
              </div>
            </div>

          </div>
        </section>

      </main>
    </div>
  );
}
