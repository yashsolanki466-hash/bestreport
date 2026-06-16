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
  src: string; // absolute local file path or data URI
}

export default function App() {
  const [projectPath, setProjectPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  
  // Metadata state
  const [projectId, setProjectId] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
  const [clientName, setClientName] = useState('');
  const [clientOrg, setClientOrg] = useState('');
  const [projectPi, setProjectPi] = useState('');
  const [serviceType, setServiceType] = useState('Transcriptome Sequencing');
  const [platform, setPlatform] = useState('Illumina Novaseq X Plus');
  const [readLength, setReadLength] = useState('2 X 150 PE');
  const [dataThroughput, setDataThroughput] = useState('~06GB / Sample');
  const [sampleType, setSampleType] = useState('Leaf');
  const [shippingCondition, setShippingCondition] = useState('NA');
  const [noOfSamples, setNoOfSamples] = useState('24');
  const [noOfLibrariesPrepared, setNoOfLibrariesPrepared] = useState('24');
  
  // File selections state
  const [selectedQubitFile, setSelectedQubitFile] = useState('');
  const [selectedLaneMapFile, setSelectedLaneMapFile] = useState('');
  const [selectedGelImage, setSelectedGelImage] = useState('');

  // Dynamic lists
  const [samplesList, setSamplesList] = useState<string[]>([]);
  const [qubitData, setQubitData] = useState<QubitRow[]>([]);
  const [librarySizes, setLibrarySizes] = useState<number[]>([]);
  const [conclusions, setConclusions] = useState<string[]>([
    'The libraries were prepared from the samples by KAPA mRNA HyperPrep Kit for Illumina (CAT #KK8581).',
    'The average size of libraries is in range of 330bp to 360bp* for all samples.',
    'The libraries will be sequenced on Illumina Novaseq X Plus platform using 2-x 150 bp chemistry to generate ~06GB/Sample.'
  ]);

  // QC / Gel state
  const [gelImage, setGelImage] = useState('');
  const [gelImagePreview, setGelImagePreview] = useState('');
  const [lanes, setLanes] = useState<LaneRow[]>([]);
  
  // TapeStation state
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

      // Populate metadata from wet_lab_data.json or metadata.json
      const data = res.wetLabData.project_id ? res.wetLabData : res.metadata;
      
      setProjectId(data.project_id || res.metadata.project_id || pathBasename(projectPath));
      setReportDate(data.report_date || reportDate);
      setClientName(data.client_name || res.metadata.client_name || '');
      setClientOrg(data.client_org || res.metadata.client_org || '');
      setProjectPi(data.project_pi || res.metadata.project_pi || '');
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

      // Auto-populate selections if files were already classified
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

      if (data.lane_mapping) {
        // Convert headers and rows to Lanes state
        const rows = data.lane_mapping.rows || [];
        const flattedLanes: LaneRow[] = [];
        rows.forEach((r: string[]) => {
          for (let i = 0; i < r.length; i += 2) {
            if (r[i]) flattedLanes.push({ lane: r[i], sample: r[i+1] || '' });
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

      // Gel QC image
      if (data.gel_image_src) {
        setGelImage(data.gel_image_src);
        setGelImagePreview(data.gel_image_src.startsWith('data:') ? data.gel_image_src : `/api/file?path=${encodeURIComponent(data.gel_image_src)}`);
        setSelectedGelImage(data.gel_image_src);
      } else if (res.gelImages && res.gelImages.length > 0) {
        setGelImage(res.gelImages[0]);
        setGelImagePreview(`/api/file?path=${encodeURIComponent(res.gelImages[0])}`);
        setSelectedGelImage(res.gelImages[0]);
      }

      // TapeStation Images
      if (data.tapestation_images) {
        setTapestationImages(data.tapestation_images);
      } else {
        // Match tape images to samples sequentially if they exist
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
        client_name: clientName,
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

  const pathBasename = (p: string) => {
    const parts = p.split(/[\\/]/);
    return parts[parts.length - 1] || 'Project';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6">
      
      {/* Header */}
      <header className="max-w-7xl mx-auto flex justify-between items-center pb-6 border-b border-slate-200 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">
            Unigenome NGS Report Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">Wet Lab interim report automation &mdash; edit <span className="font-mono bg-slate-100 px-1 rounded">wet_lab_notes.docx</span> in Word to update methods text</p>
        </div>
        <div className="text-xs bg-slate-100 border border-slate-200 rounded px-3 py-1.5 text-slate-600 font-mono">
          System Time: 2026-06-09
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column - Workspace Setup & File Binding */}
        <section className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-orange-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
              Project Directory Setup
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Project Path (Absolute)
                </label>
                <input
                  type="text"
                  placeholder="e.g. C:\Bioinfo\interim_projects\NGS_260046_interim"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Each NGS project lives in its own folder inside <span className="font-mono">interim_projects/</span>
                </p>
              </div>

              <button
                onClick={handleScan}
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-350 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition shadow-sm flex justify-center items-center gap-2"
              >
                {loading && (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Scan Folder
              </button>

              {/* Word notes hint card */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Static text is in Word
                </p>
                <p>Open <span className="font-mono bg-amber-100 px-1 rounded">wet_lab_notes.docx</span> inside each project folder to edit method descriptions and conclusions. Changes take effect on next report generation.</p>
              </div>
            </div>
          </div>

          {/* File Selectors Dropdowns */}
          {scanResult && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
                Wet Lab File Linker
              </h3>
              
              {/* Qubit Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  1. Select Qubit Excel Sheet
                </label>
                <select
                  value={selectedQubitFile}
                  onChange={(e) => {
                    setSelectedQubitFile(e.target.value);
                    parseQubitFile(e.target.value);
                  }}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-mono"
                >
                  <option value="">-- Click to choose --</option>
                  {(scanResult.excelFiles || []).map((f: string) => (
                    <option key={f} value={f}>{f.split(/[\\/]/).pop()}</option>
                  ))}
                </select>
              </div>

              {/* Lane Mapping Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  2. Select RNA Gel lane Map Sheet
                </label>
                <select
                  value={selectedLaneMapFile}
                  onChange={(e) => {
                    setSelectedLaneMapFile(e.target.value);
                    parseLaneMapFile(e.target.value);
                  }}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-mono"
                >
                  <option value="">-- Click to choose --</option>
                  {(scanResult.excelFiles || []).map((f: string) => (
                    <option key={f} value={f}>{f.split(/[\\/]/).pop()}</option>
                  ))}
                </select>
              </div>

              {/* Gel Image Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  3. Select Agarose Gel Image
                </label>
                <select
                  value={selectedGelImage}
                  onChange={(e) => {
                    setSelectedGelImage(e.target.value);
                    setGelImage(e.target.value);
                    setGelImagePreview(e.target.value ? `/api/file?path=${encodeURIComponent(e.target.value)}` : '');
                  }}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-mono"
                >
                  <option value="">-- Click to choose --</option>
                  {(scanResult.imageFiles || []).map((f: string) => (
                    <option key={f} value={f}>{f.split(/[\\/]/).pop()}</option>
                  ))}
                </select>
              </div>

              {gelImagePreview && (
                <div className="pt-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Gel Preview</span>
                  <img src={gelImagePreview} alt="Gel Preview" className="w-full h-32 object-contain bg-slate-100 border border-slate-200 rounded-lg" />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Center column - Forms & Data Grid */}
        <section className="lg:col-span-2 space-y-6">
          {message && (
            <div className={`p-4 rounded-lg border text-sm font-semibold flex items-center justify-between shadow-sm ${
              message.type === 'success' ? 'bg-emerald-50 border-emerald-400 text-emerald-800' :
              message.type === 'error' ? 'bg-rose-50 border-rose-400 text-rose-800' :
              'bg-blue-50 border-blue-400 text-blue-800'
            }`}>
              <span>{message.text}</span>
              <button onClick={() => setMessage(null)} className="hover:text-slate-600">✕</button>
            </div>
          )}

          {/* Form fields */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <h2 className="text-xl font-bold text-orange-600 border-b border-slate-200 pb-3 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
              Report Information & Metadata
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1">Project ID</label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1">Report Date</label>
                <input
                  type="text"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1">PI Name (Submitted To)</label>
                <input
                  type="text"
                  value={projectPi}
                  onChange={(e) => setProjectPi(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1">Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1">Client Organization</label>
                <input
                  type="text"
                  value={clientOrg}
                  onChange={(e) => setClientOrg(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1">Service Type</label>
                <input
                  type="text"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1">Platform</label>
                <input
                  type="text"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1">Read Length</label>
                <input
                  type="text"
                  value={readLength}
                  onChange={(e) => setReadLength(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1">Data Volume / Sample</label>
                <input
                  type="text"
                  value={dataThroughput}
                  onChange={(e) => setDataThroughput(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1">Sample Type</label>
                <input
                  type="text"
                  value={sampleType}
                  onChange={(e) => setSampleType(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1">Shipping Condition</label>
                <input
                  type="text"
                  value={shippingCondition}
                  onChange={(e) => setShippingCondition(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1">No. of Samples</label>
                <input
                  type="text"
                  value={noOfSamples}
                  onChange={(e) => setNoOfSamples(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Qubit Data Grid */}
            <div className="space-y-3">
              <div className="flex justify-between items-center border-t border-slate-200 pt-4">
                <h3 className="text-md font-bold text-slate-700">
                  RNA Quantification (Qubit) Data Table
                </h3>
                <button
                  onClick={addQubitRow}
                  className="bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 px-3 py-1 rounded text-xs font-semibold transition"
                >
                  + Add Row
                </button>
              </div>

              <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-600 text-xs font-semibold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2">Sample ID</th>
                      <th className="px-4 py-2">Conc. (ng/µl)</th>
                      <th className="px-4 py-2">Vol. (µl)</th>
                      <th className="px-4 py-2">Yield (µg)</th>
                      <th className="px-4 py-2">Remarks</th>
                      <th className="px-4 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qubitData.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="px-3 py-1">
                          <input
                            type="text"
                            value={row.sample_id}
                            onChange={(e) => updateQubitRow(idx, 'sample_id', e.target.value)}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs w-full font-mono text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="text"
                            value={row.conc}
                            onChange={(e) => updateQubitRow(idx, 'conc', e.target.value)}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs w-full text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="text"
                            value={row.vol}
                            onChange={(e) => updateQubitRow(idx, 'vol', e.target.value)}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs w-full text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="text"
                            value={row.yield}
                            onChange={(e) => updateQubitRow(idx, 'yield', e.target.value)}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs w-full text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={(e) => updateQubitRow(idx, 'remarks', e.target.value)}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs w-full text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                          />
                        </td>
                        <td className="px-3 py-1 text-center">
                          <button
                            onClick={() => removeQubitRow(idx)}
                            className="text-rose-600 hover:text-rose-700 font-bold"
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

            {/* Gel Image Mapping */}
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <div className="flex justify-between items-center">
                <h3 className="text-md font-bold text-slate-700">
                  RNA Agarose Gel Lane Mapping Grid
                </h3>
                <button
                  onClick={addLaneRow}
                  className="bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 px-3 py-1 rounded text-xs font-semibold transition"
                >
                  + Add Lane
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[200px] overflow-y-auto p-1">
                {lanes.map((lane, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded p-2 flex gap-2 items-center justify-between">
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={lane.lane}
                        onChange={(e) => updateLaneRow(idx, 'lane', e.target.value)}
                        placeholder="Lane"
                        className="bg-white border border-slate-300 text-slate-800 rounded px-2 py-1 text-xs w-10 text-center font-bold"
                      />
                      <input
                        type="text"
                        value={lane.sample}
                        onChange={(e) => updateLaneRow(idx, 'sample', e.target.value)}
                        placeholder="Sample ID"
                        className="bg-white border border-slate-300 text-slate-800 rounded px-2 py-1 text-xs w-24 font-mono"
                      />
                    </div>
                    <button
                      onClick={() => removeLaneRow(idx)}
                      className="text-rose-600 hover:text-rose-700 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* TapeStation Profiles Assigner */}
            {scanResult && (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <h3 className="text-md font-bold text-slate-700">
                  Agilent TapeStation 4150 Profiles Assigner
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto p-1">
                  {qubitData.map((row, idx) => {
                    const assignedImg = tapestationImages.find(img => img.sample_id === row.sample_id)?.src || '';
                    return (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-sm font-bold text-slate-800">{row.sample_id}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Peak Size (bp):</span>
                            <input
                              type="number"
                              value={librarySizes[idx] || 350}
                              onChange={(e) => {
                                const updatedSizes = [...librarySizes];
                                updatedSizes[idx] = parseInt(e.target.value, 10) || 350;
                                setLibrarySizes(updatedSizes);
                              }}
                              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs w-16 text-center text-slate-800"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-1">Assign Profile Image</label>
                          <select
                            value={assignedImg}
                            onChange={(e) => {
                              const updatedImgs = tapestationImages.filter(img => img.sample_id !== row.sample_id);
                              if (e.target.value) {
                                updatedImgs.push({ sample_id: row.sample_id, src: e.target.value });
                              }
                              setTapestationImages(updatedImgs);
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none font-mono"
                          >
                            <option value="">-- No Image --</option>
                            {(scanResult.imageFiles || []).map((f: string) => (
                              <option key={f} value={f}>{f.split(/[\\/]/).pop()}</option>
                            ))}
                          </select>
                        </div>
                        {assignedImg && (
                          <div className="mt-1 flex items-center gap-2">
                            <img
                              src={assignedImg.startsWith('data:') ? assignedImg : `/api/file?path=${encodeURIComponent(assignedImg)}`}
                              alt="Tape Profile"
                              className="h-12 w-auto object-contain bg-white rounded border border-slate-200"
                            />
                            <span className="text-[10px] text-slate-500 font-mono truncate" title={assignedImg}>
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

            {/* conclusions list */}
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <div className="flex justify-between items-center">
                <h3 className="text-md font-bold text-slate-700">
                  Interim Conclusions (Section 5)
                </h3>
                <button
                  onClick={addConclusion}
                  className="bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 px-3 py-1 rounded text-xs font-semibold transition"
                >
                  + Add Point
                </button>
              </div>

              <ul className="space-y-3">
                {conclusions.map((bullet, idx) => (
                  <li key={idx} className="flex gap-3 items-center">
                    <span className="text-orange-600 font-bold">•</span>
                    <input
                      type="text"
                      value={bullet}
                      onChange={(e) => updateConclusion(idx, e.target.value)}
                      className="bg-white border border-slate-300 rounded px-3 py-1.5 text-xs flex-grow text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    />
                    <button
                      onClick={() => removeConclusion(idx)}
                      className="text-rose-600 hover:text-rose-700 font-bold"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Generation Panel */}
            <div className="border-t border-slate-200 pt-6 flex flex-wrap gap-4 justify-between items-center">
              <div className="text-xs text-slate-500">
                Data will be saved as <span className="font-mono text-slate-700">wet_lab_data.json</span> inside project deliverables root.
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => handleGenerate('interim')}
                  disabled={loading}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition shadow-md flex items-center gap-2"
                >
                  Generate Interim Report
                </button>
                <button
                  onClick={() => handleGenerate('comprehensive')}
                  disabled={loading}
                  className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition shadow-md flex items-center gap-2"
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
