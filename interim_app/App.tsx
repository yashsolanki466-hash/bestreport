import React, { useState, useEffect } from 'react';

// Interfaces
interface QubitRow {
  sample_id: string;
  conc: string;
  vol: string;
  yield: string;
  remarks: string;
  qc_status: 'PASS' | 'FAIL' | 'WARN';
}

interface LaneRow {
  lane: string;
  sample: string;
}

interface TapeStationImage {
  sample_id: string;
  src: string;
}

interface CustomPage {
  id: string;
  title: string;
  content: string;
}

interface ReportPage {
  id: string;
  title: string;
  hidden: boolean;
  type: 'cover' | 'project' | 'samples' | 'gel' | 'tapestation' | 'conclusions' | 'custom';
  customId?: string;
}

interface StaticContentTemplate {
  id: string;
  name: string;
  description: string;
  diffExplanation: string;
  rnaExtractionHeader: string;
  rnaExtractionContent: string;
  libraryPrepHeader: string;
  libraryPrepContent: string;
  sequencingHeader: string;
  sequencingContent: string;
  qcDescriptionHeader: string;
  qcDescriptionContent: string;
  conclusionHeader: string;
  conclusionContent: string;
}

const STATIC_TEMPLATES: StaticContentTemplate[] = [
  {
    id: 'kapa',
    name: 'KAPA mRNA HyperPrep Kit',
    description: 'Standard mRNA enrichment workflow utilizing the KAPA mRNA HyperPrep Kit (CAT #KK8581) with In-house RNA isolation method.',
    diffExplanation: 'Uses KAPA mRNA HyperPrep Kit (500-1000 ng input), In-house RNA isolation, and Novaseq 6000 sequencing (~8-10GB/sample). No separate Cluster Gen section.',
    rnaExtractionHeader: 'Isolation and Quantitative analysis of RNA:',
    rnaExtractionContent: 'RNA were isolated from given samples by RNA isolation using In-house method. RNA quantity was measured using Qubit® 4.0 fluorometer and quality were analyzed by using 1% agarose gel.',
    libraryPrepHeader: 'Preparation of library:',
    libraryPrepContent: 'The paired-end sequencing library was prepared using KAPA mRNA HyperPrep Kit for Illumina. (CAT #KK8581). The library preparation process was initiated with 500-1000 ng input. mRNA enrichment was performed as per user manual and mRNA was subjected to fragmentation, first & second-strand cDNA synthesis, end-repair, 3´ adenylating, adapter ligation, selective enrichment of adapter-ligated DNA fragments through PCR amplification, followed by validation of Library on Agilent 4150 tape station. The final library was pooled with other samples, denatured & loaded on to flow cell. On the flow cell, cluster generation & sequencing was performed using Illumina Novaseq 6000 platform to generate 2×150bp paired-end (PE) read',
    sequencingHeader: 'Cluster Generation and Sequencing:',
    sequencingContent: '',
    qcDescriptionHeader: 'Quantity and quality check (QC) of library on Agilent Tape Station 4150:',
    qcDescriptionContent: 'The amplified libraries were analyzed on TapeStation 4150 (Agilent Technologies) using HSD100 ScreenTape® as per manufacturer\'s instructions.',
    conclusionHeader: 'Conclusions:',
    conclusionContent: '- The libraries were prepared from the samples by KAPA mRNA HyperPrep Kit for Illumina (CAT #KK8581).\n- The average size of libraries is 465bp, 491bp, 424bp, 443bp, 368bp, 441bp and 436bp respectively for samples S1, S2, F1, F2, SF2, C1 and C2.\n- The libraries were sequenced on Illumina Novaseq6000 platform (2 x 150 bp chemistry) to generate ~8-10GB data/Sample.'
  },
  {
    id: 'bacteria',
    name: 'NGS_RNA-Ribo-Bacteria',
    description: 'Bacterial ribodepletion workflow using the NEBNext® Ultra™ RNA Kit (NEB #E7770) combined with bacterial-specific ribodepletion (Cat.no. NEB #E7850X).',
    diffExplanation: 'Uses NEBNext Ultra RNA Kit (1000 ng input) with bacterial ribodepletion (NEB #E7850X), Trizol RNA isolation, and Novaseq X Plus sequencing (~6-8GB/sample). Has separate Cluster Gen section.',
    rnaExtractionHeader: 'Isolation and Quantitative analysis of DNA:',
    rnaExtractionContent: 'RNA was extracted from all given sample using Trizol RNA isolation method. RNA quantity was measured using Qubit® 4.0 fluorometer and quality were analyzed by using 1% agarose gel.',
    libraryPrepHeader: 'Preparation of library:',
    libraryPrepContent: 'The paired-end sequencing library was prepared using NEBNext® Ultra™ RNA Library Prep Kit for Illumina. (NEB #E7770) The library preparation process was initiated with 1000 ng input. Ribosomal RNA was removed using depletion was carried out using bacterial specific ribodepletion kit (Cat.no. NEB #E7850X) as per user manual. Ribo-depleted RNA was subjected to fragmentation, first & second-strand cDNA synthesis, end-repair, 3´ adapter ligation, selective enrichment of adapter-ligated DNA fragments through PCR amplification, followed by validation of Library on Agilent 4150 tape station. The final library was pooled with other samples, denatured & loaded on to flow cell. On the flowcell, cluster generation & sequencing was performed using Illumina Novaseq 6000 platform to generate 2×150bp pairedend (PE) reads.',
    sequencingHeader: 'Cluster Generation and Sequencing:',
    sequencingContent: 'After obtaining the Qubit concentration for the library and the mean peak size from Tape Station profile, library will be loaded onto illumine Novaseq X Plus for cluster generation and sequencing. Paired-End sequencing allows the template fragments to be sequenced in both the forward and reverse directions. The library molecules will bind to complementary adapter oligos on paired-end flow cell. The adapters are designed to allow selective cleavage of the forward strands after re-synthesis of the reverse strand during sequencing. The copied reverse strand is then used to sequence from the opposite end of the fragment.',
    qcDescriptionHeader: 'Quantity and quality check (QC) of library on Agilent Tape Station 4150:',
    qcDescriptionContent: 'The amplified libraries were analyzed on TapeStation 4150 (Agilent Technologies) using High Sensitivity D1000 ScreenTape® as per manufacturer\'s instructions.',
    conclusionHeader: 'Conclusions:',
    conclusionContent: '- The libraries were prepared from the samples by KAPA mRNA Hyper Prep Kit for Illumina (CAT #KK8581).\n- The average size of libraries is 479bp, 503bp, 487bp, 539bp, 464bp, 488bp, 493bp, 489bp, 493bp, 489bp, 485bp, 458bp, 447bp, 458bp and 448bp for Hcfb_a, Hcfb_b, Hcfb_c, Hcfa+b_a, Hcfa+b_b, Hcfa+b_c, Hcfa 5dh+_a, Hcfa 5dh+_b, Hcfa 5dh+_c, WT 5dh+_a, WT 5dh+_b, WT 5dh+_c, Yoh.04 mm_a, Yoh.04 mm_b and Yoh.04 mm_c.\n- The libraries were sequenced on Illumina Novaseq X Plus platform using 2-x 150 bp chemistry to generate ~06-08GB/Sample.'
  },
  {
    id: 'hmr',
    name: 'NGS_RNA-Ribo-HMR',
    description: 'Eukaryotic ribodepletion workflow using the NEBNext® Ultra™ RNA Kit (NEB #E7770) and KAPA RNA HyperPrep Kit with RiboErase (HMR) (Cat no: KK8561).',
    diffExplanation: 'Uses NEBNext Ultra RNA Kit (100 ng input) with KAPA RiboErase (HMR) (Cat no: KK8561), Trizol RNA isolation, and Novaseq X Plus sequencing (~8-9GB/sample). Has separate Cluster Gen section.',
    rnaExtractionHeader: 'Extraction and Quantitative analysis of RNA:',
    rnaExtractionContent: 'RNA was extracted from tissue samples using Trizol RNA isolation method RNA quantity was measured using Qubit® 4.0 fluorometer and quality analyzed by on 1% agarose gel',
    libraryPrepHeader: 'Preparation of library:',
    libraryPrepContent: 'The paired-end sequencing library was prepared using NEBNext® Ultra™ RNA Library Prep Kit for Illumina. (NEB #E7770). The library preparation process was initiated with 100 ng input. Ribosomal RNA was removed using depletion was carried out using ribodepletion kit KAPA RNA HyperPrep Kit with RiboErase (HMR), Cat no: KK8561) as per user manual. Ribo-depleted RNA was subjected to fragmentation, first & second-strand cDNA synthesis, end-repair, 3´ adapter ligation, selective enrichment of adapter-ligated DNA fragments through PCR amplification, followed by validation of Library on Agilent 4150 tape station. The final library was pooled with other samples, denatured & loaded on to flow cell. On the flowcell, cluster generation & sequencing was performed using Illumina Novaseq X plus platform to generate 2×150bp paired-end (PE) reads.',
    sequencingHeader: 'Cluster Generation and Sequencing:',
    sequencingContent: 'After obtaining the Qubit concentration for the library and the mean peak size from Tape Station profile, library will be loaded onto illumine Novaseq X Plus for cluster generation and sequencing. Paired-End sequencing allows the template fragments to be sequenced in both the forward and reverse directions. The library molecules will bind to complementary adapter oligos on paired-end flow cell. The adapters are designed to allow selective cleavage of the forward strands after re-synthesis of the reverse strand during sequencing. The copied reverse strand is then used to sequence from the opposite end of the fragment.',
    qcDescriptionHeader: 'Quantity and quality check (QC) of library on Agilent Tape Station 4150:',
    qcDescriptionContent: 'The amplified libraries were analyzed on TapeStation 4150 (Agilent Technologies) using High Sensitivity D1000 ScreenTape® as per manufacturer\'s instructions.',
    conclusionHeader: 'Conclusions:',
    conclusionContent: '- The libraries were prepared from the samples by NEBNext® Ultra™ RNA Library Prep Kit for Illumina. (NEB #E7770).\n- The average size of libraries is 479bp, 503bp, 487bp, 539bp, 377bp, 424bp, 469bp, 456bp, 413bp and 405bp for 01460HNTB, 01462HNTB, 01464HNTB, 01466HNTB, 01468HNTB, 01469HNTB, 01470HNTB, 01471HNTB, 01473HNTB and 01474HNTB.\n- The libraries were sequenced on Illumina Novaseq X Plus platform using 2-x 150 bp chemistry to generate ~08-9GB/Sample.'
  }
];

export default function App() {
  const tabsList = ['project', 'samples', 'static', 'qc', 'preview', 'export'] as const;
  type TabType = typeof tabsList[number];

  // Navigation active tab
  const [activeTab, setActiveTab] = useState<TabType>('project');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Directory setup
  const [projectPath, setProjectPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);

  // Generation status tracking for visual feedback
  const [generatingButton, setGeneratingButton] = useState<'interim' | 'comprehensive' | 'docx' | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<boolean>(false);

  // 1. Project Details
  const [projectId, setProjectId] = useState('');
  const [clientName, setClientName] = useState('');
  const [submittedTo, setSubmittedTo] = useState('Dr. Amit Gupta');
  const [institution, setInstitution] = useState('Unigenome Bioinformatics Lab');
  const [reportDate, setReportDate] = useState(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
  const [serviceType, setServiceType] = useState('Transcriptome Sequencing');
  const [platform, setPlatform] = useState('Illumina Novaseq X Plus');
  const [readLength, setReadLength] = useState('2 X 150 PE');
  const [noOfSamples, setNoOfSamples] = useState('0');
  const [dataOutput, setDataOutput] = useState('~06GB / Sample');
  const [sampleType, setSampleType] = useState('Leaf');
  const [shippingCondition, setShippingCondition] = useState('Dry Ice');

  // 2. Samples Information Table
  const [qubitData, setQubitData] = useState<QubitRow[]>([]);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [excelPasteText, setExcelPasteText] = useState('');

  // 3. Static Content (using exact text from wet_lab_notes.txt)
  const [useStandardTemplate, setUseStandardTemplate] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<'kapa' | 'bacteria' | 'hmr'>('kapa');

  const [rnaExtractionHeader, setRnaExtractionHeader] = useState('Isolation and Quantitative analysis of RNA:');
  const [rnaExtractionMethod, setRnaExtractionMethod] = useState(STATIC_TEMPLATES[0].rnaExtractionContent);

  const [libraryPrepHeader, setLibraryPrepHeader] = useState('Preparation of library:');
  const [libraryPrepMethod, setLibraryPrepMethod] = useState(STATIC_TEMPLATES[0].libraryPrepContent);

  const [sequencingHeader, setSequencingHeader] = useState('Cluster Generation and Sequencing:');
  const [sequencingMethod, setSequencingMethod] = useState(STATIC_TEMPLATES[0].sequencingContent);

  const [qcDescriptionHeader, setQcDescriptionHeader] = useState('Quantity and quality check (QC) of library on Agilent Tape Station 4150:');
  const [qcDescription, setQcDescription] = useState(STATIC_TEMPLATES[0].qcDescriptionContent);

  const [conclusionHeader, setConclusionHeader] = useState('Conclusions:');
  const [conclusionSection, setConclusionSection] = useState(STATIC_TEMPLATES[0].conclusionContent);

  const applyTemplate = (tplId: 'kapa' | 'bacteria' | 'hmr') => {
    setSelectedTemplateId(tplId);
    const tpl = STATIC_TEMPLATES.find(t => t.id === tplId);
    if (tpl) {
      setRnaExtractionHeader(tpl.rnaExtractionHeader);
      setRnaExtractionMethod(tpl.rnaExtractionContent);
      setLibraryPrepHeader(tpl.libraryPrepHeader);
      setLibraryPrepMethod(tpl.libraryPrepContent);
      setSequencingHeader(tpl.sequencingHeader);
      setSequencingMethod(tpl.sequencingContent);
      setQcDescriptionHeader(tpl.qcDescriptionHeader);
      setQcDescription(tpl.qcDescriptionContent);
      setConclusionHeader(tpl.conclusionHeader);
      setConclusionSection(tpl.conclusionContent);
    }
  };

  // 4. Auto Mapped & Classified Images
  const [detectedImages, setDetectedImages] = useState<{
    rnaQc: string[];
    tapestation: string[];
    bioanalyzer: string[];
    gel: string[];
    qubit: string[];
  }>({
    rnaQc: [],
    tapestation: [],
    bioanalyzer: [],
    gel: [],
    qubit: []
  });

  const [lanes, setLanes] = useState<LaneRow[]>([]);
  const [selectedGelImage, setSelectedGelImage] = useState('');
  const [tapestationImages, setTapestationImages] = useState<TapeStationImage[]>([]);
  const [librarySizes, setLibrarySizes] = useState<number[]>([]);

  // 5. Outline / Customization
  const [reportPages, setReportPages] = useState<ReportPage[]>([
    { id: 'cover', title: '1. Cover Page', hidden: false, type: 'cover' },
    { id: 'project', title: '2. Project details', hidden: false, type: 'project' },
    { id: 'samples', title: '3. RNA QC Quantification', hidden: false, type: 'samples' },
    { id: 'gel', title: '4. Agarose Gel Analysis', hidden: false, type: 'gel' },
    { id: 'tapestation', title: '5. TapeStation Size Distribution', hidden: false, type: 'tapestation' },
    { id: 'conclusions', title: '6. Interim Conclusion', hidden: false, type: 'conclusions' },
  ]);
  const [customPages, setCustomPages] = useState<CustomPage[]>([]);
  const [showAddPageModal, setShowAddPageModal] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageContent, setNewPageContent] = useState('');

  // Advanced toggles
  const [autoNumberFigures, setAutoNumberFigures] = useState(true);
  const [autoGenerateConclusions, setAutoGenerateConclusions] = useState(true);
  const [autoInsertHeaderFooter, setAutoInsertHeaderFooter] = useState(true);
  const [confidentialWatermark, setConfidentialWatermark] = useState(false);
  const [useClientBranding, setUseClientBranding] = useState(false);

  // Header & Footer
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [clientLogo, setClientLogo] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState('');
  const [unipathLogoPath, setUnipathLogoPath] = useState('');
  const [headerText, setHeaderText] = useState('UNIGENOME BIOTECH - INTERIM REPORT');
  const [footerText, setFooterText] = useState('Page {page} of {total}');
  const [confidentialStatement, setConfidentialStatement] = useState('Confidential - For Internal Use Only');

  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const saved = localStorage.getItem('ngs_project_path');
    if (saved) {
      setProjectPath(saved);
    }
  }, []);

  useEffect(() => {
    setNoOfSamples(String(qubitData.length));
  }, [qubitData]);

  // HTML Folder Browser Modal states
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [browserPath, setBrowserPath] = useState('');
  const [browserDirs, setBrowserDirs] = useState<string[]>([]);
  const [browserParent, setBrowserParent] = useState('');
  const [browserLoading, setBrowserLoading] = useState(false);

  const fetchDirs = async (pathStr: string) => {
    setBrowserLoading(true);
    try {
      const response = await fetch(`/api/list-dirs?path=${encodeURIComponent(pathStr)}`);
      const res = await response.json();
      if (res.success) {
        setBrowserPath(res.currentPath);
        setBrowserDirs(res.dirs || []);
        setBrowserParent(res.parentPath || '');
      } else {
        showToast('Error listing directory: ' + (res.error || 'Unknown error'), 'error');
      }
    } catch (e: any) {
      showToast('Failed to load directory: ' + e.message, 'error');
    } finally {
      setBrowserLoading(false);
    }
  };

  const handleBrowse = async () => {
    const startPath = projectPath.trim() || '.';
    setShowFolderBrowser(true);
    await fetchDirs(startPath);
  };

  const handleSelectBrowserFolder = () => {
    setProjectPath(browserPath);
    setShowFolderBrowser(false);
    handleScanFromPath(browserPath);
  };

  const handleScan = async () => {
    if (!projectPath.trim()) {
      showToast('Please specify a project folder path', 'error');
      return;
    }
    await handleScanFromPath(projectPath.trim());
  };

  const handleScanFromPath = async (path: string) => {
    setLoading(true);
    
    // Reset all project-specific states to default values before scanning new folder
    setProjectId('');
    setClientName('');
    setSubmittedTo('Dr. Amit Gupta');
    setInstitution('Unigenome Bioinformatics Lab');
    setReportDate(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
    setServiceType('Transcriptome Sequencing');
    setPlatform('Illumina Novaseq X Plus');
    setReadLength('2 X 150 PE');
    setNoOfSamples('0');
    setDataOutput('~06GB / Sample');
    setSampleType('Leaf');
    setShippingCondition('Dry Ice');
    
    setQubitData([]);
    setLanes([]);
    setSelectedGelImage('');
    setTapestationImages([]);
    setLibrarySizes([]);
    setLogoPath('');
    setUnipathLogoPath('');
    setDetectedImages({
      rnaQc: [],
      tapestation: [],
      bioanalyzer: [],
      gel: [],
      qubit: []
    });

    try {
      localStorage.setItem('ngs_project_path', path);
      const response = await fetch('/api/scan-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: path })
      });
      const res = await response.json();
      if (!res.success) {
        showToast(res.error || 'Failed to scan folder', 'error');
        return;
      }

      setScanResult(res);
      setLogoPath(res.logoPath || '');
      setUnipathLogoPath(res.unipathLogoPath || '');
      showToast('Project folder scanned successfully!', 'success');

      // Populate metadata
      const data = res.wetLabData.project_id ? res.wetLabData : res.metadata;
      setProjectId(data.project_id || res.metadata.project_id || path.split(/[\\/]/).pop() || '');
      setClientName(data.client_name || res.metadata.client_name || '');
      setSubmittedTo(data.submitted_to || 'Dr. Amit Gupta');
      
      // Fixed: Support client_org mapping to Institution form field
      setInstitution(data.client_org || res.metadata.client_org || data.institution || 'Unigenome Bioinformatics Lab');
      
      setReportDate(data.report_date || reportDate);
      setServiceType(data.service_type || serviceType);
      setPlatform(data.platform || platform);
      setReadLength(data.read_length || readLength);
      setDataOutput(data.data_throughput || dataOutput);
      setSampleType(data.sample_type || 'Leaf');
      setShippingCondition(data.shipping_condition || 'Dry Ice');

      // Auto-classify all found images
      const allImages = res.imageFiles || [];
      const classified = {
        rnaQc: allImages.filter((f: string) => /rna.*qc|qc.*rna/i.test(f)),
        tapestation: allImages.filter((f: string) => /tapestation|tape|4150/i.test(f)),
        bioanalyzer: allImages.filter((f: string) => /bioanalyzer|rin|ladder/i.test(f)),
        gel: allImages.filter((f: string) => /gel|agarose/i.test(f)),
        qubit: allImages.filter((f: string) => /qubit|quant/i.test(f))
      };
      setDetectedImages(classified);

      // Parse Qubit if present
      if (res.qubitFiles && res.qubitFiles.length > 0) {
        parseQubitExcel(res.qubitFiles[0]);
      } else if (data.qubit_data && data.qubit_data.length > 0) {
        setQubitData(data.qubit_data);
      }

      // Parse gel mapping if present
      if (res.laneMapFiles && res.laneMapFiles.length > 0) {
        parseLaneMapExcel(res.laneMapFiles[0]);
      }

      // Auto Gel Image
      if (res.gelImages && res.gelImages.length > 0) {
        setSelectedGelImage(res.gelImages[0]);
      } else if (classified.gel.length > 0) {
        setSelectedGelImage(classified.gel[0]);
      }

      // TapeStation assignments
      if (data.tapestation_images) {
        setTapestationImages(data.tapestation_images);
      } else if (res.tapestationImages) {
        const samples = data.samples || [];
        const matched = res.tapestationImages.map((src: string, i: number) => ({
          sample_id: samples[i] || `Sample_${i + 1}`,
          src
        }));
        setTapestationImages(matched);
      } else if (classified.tapestation.length > 0) {
        const samples = data.samples || [];
        const matched = classified.tapestation.map((src: string, i: number) => ({
          sample_id: samples[i] || `Sample_${i + 1}`,
          src
        }));
        setTapestationImages(matched);
      }

      // Load static content values from wetLabData if available
      if (res.wetLabData) {
        if (res.wetLabData.rna_isolation_qc) setRnaExtractionMethod(res.wetLabData.rna_isolation_qc);
        if (res.wetLabData.rna_isolation_qc_header) setRnaExtractionHeader(res.wetLabData.rna_isolation_qc_header);
        if (res.wetLabData.library_preparation) setLibraryPrepMethod(res.wetLabData.library_preparation);
        if (res.wetLabData.library_preparation_header) setLibraryPrepHeader(res.wetLabData.library_preparation_header);
        if (res.wetLabData.cluster_generation) setSequencingMethod(res.wetLabData.cluster_generation);
        if (res.wetLabData.cluster_generation_header) setSequencingHeader(res.wetLabData.cluster_generation_header);
        if (res.wetLabData.library_qc) setQcDescription(res.wetLabData.library_qc);
        if (res.wetLabData.library_qc_header) setQcDescriptionHeader(res.wetLabData.library_qc_header);
        if (res.wetLabData.conclusions_header) setConclusionHeader(res.wetLabData.conclusions_header);
        if (res.wetLabData.conclusions && res.wetLabData.conclusions.length > 0) {
          setConclusionSection(res.wetLabData.conclusions.join('\n'));
        }
        if (res.wetLabData.selected_template_id) setSelectedTemplateId(res.wetLabData.selected_template_id);
        if (res.wetLabData.rna_isolation_qc || res.wetLabData.selected_template_id) {
          setUseStandardTemplate(false);
        }
      }

    } catch (e: any) {
      showToast('Scan error: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const parseQubitExcel = async (file: string) => {
    try {
      const response = await fetch('/api/parse-qubit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: file })
      });
      const res = await response.json();
      if (res.success && res.qubitData) {
        const updated = res.qubitData.map((row: any) => ({
          ...row,
          qc_status: parseFloat(row.conc) > 20 ? 'PASS' : parseFloat(row.conc) > 5 ? 'WARN' : 'FAIL'
        }));
        setQubitData(updated);
        setLibrarySizes(updated.map(() => 350));
      }
    } catch (e: any) {
      showToast('Failed to parse Qubit file: ' + e.message, 'error');
    }
  };

  const parseLaneMapExcel = async (file: string) => {
    try {
      const response = await fetch('/api/parse-lane-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: file })
      });
      const res = await response.json();
      if (res.success && res.lanes) {
        setLanes(res.lanes);
      }
    } catch (e: any) {
      showToast('Failed to parse Gel lane map: ' + e.message, 'error');
    }
  };

  // Drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    // Attempt folder path discovery
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file) {
        const path = (file as any).path || file.name;
        if (path) {
          showToast('Project folder dropped! Loading...', 'info');
          if (projectPath) {
            handleScanFromPath(projectPath);
          } else {
            handleScan();
          }
        }
      }
    }
  };

  // Editable table helpers
  const handleAddRow = () => {
    const nextId = `S${qubitData.length + 1}`;
    setQubitData([...qubitData, { sample_id: nextId, conc: '', vol: '', yield: '', remarks: '', qc_status: 'PASS' }]);
  };

  const handleDeleteRow = (index: number) => {
    setQubitData(qubitData.filter((_, i) => i !== index));
  };

  const handleExcelPaste = () => {
    if (!excelPasteText.trim()) return;
    const rows = excelPasteText.trim().split('\n');
    const parsed: QubitRow[] = rows.map((line) => {
      const cols = line.split('\t');
      const sample_id = cols[0] || 'Unknown';
      const conc = cols[1] || '0';
      const vol = cols[2] || '0';
      const yieldVal = cols[3] || '0';
      const remarks = cols[4] || '';
      const qc_status = parseFloat(conc) > 20 ? 'PASS' : parseFloat(conc) > 5 ? 'WARN' : 'FAIL';
      return { sample_id, conc, vol, yield: yieldVal, remarks, qc_status };
    });
    setQubitData(parsed);
    setShowPasteModal(false);
    setExcelPasteText('');
    showToast(`Successfully pasted ${parsed.length} rows from Excel!`, 'success');
  };

  // CSV Import / Export
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      const parsed: QubitRow[] = lines.slice(1).map((line) => {
        const cols = line.split(',');
        const sample_id = cols[0]?.replace(/"/g, '') || 'Unknown';
        const conc = cols[1]?.replace(/"/g, '') || '0';
        const vol = cols[2]?.replace(/"/g, '') || '0';
        const yieldVal = cols[3]?.replace(/"/g, '') || '0';
        const remarks = cols[4]?.replace(/"/g, '') || '';
        const statusVal = cols[5]?.replace(/"/g, '').trim() as any;
        const qc_status = ['PASS', 'WARN', 'FAIL'].includes(statusVal) ? statusVal : 'PASS';
        return { sample_id, conc, vol, yield: yieldVal, remarks, qc_status };
      });
      setQubitData(parsed);
      showToast(`Imported ${parsed.length} samples from CSV`, 'success');
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    const headers = 'Sample ID,Concentration,Volume,Yield,Remarks,QC Status\n';
    const rows = qubitData.map(r => `"${r.sample_id}","${r.conc}","${r.vol}","${r.yield}","${r.remarks}","${r.qc_status}"`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectId || 'NGS'}_sample_metadata.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported CSV file', 'success');
  };

  // Custom pages addition
  const handleAddCustomPage = () => {
    if (!newPageTitle.trim()) return;
    const pageId = `custom_${Date.now()}`;
    const newPage: CustomPage = {
      id: pageId,
      title: newPageTitle,
      content: newPageContent
    };
    setCustomPages([...customPages, newPage]);
    setReportPages([
      ...reportPages,
      { id: pageId, title: `Custom: ${newPageTitle}`, hidden: false, type: 'custom', customId: pageId }
    ]);
    setNewPageTitle('');
    setNewPageContent('');
    setShowAddPageModal(false);
    showToast('Added custom page successfully!', 'success');
  };

  const movePage = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === reportPages.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const copy = [...reportPages];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setReportPages(copy);
  };

  const togglePageVisibility = (id: string) => {
    setReportPages(
      reportPages.map(p => p.id === id ? { ...p, hidden: !p.hidden } : p)
    );
  };

  // Navigation wizard
  const handleNextTab = () => {
    const currentIdx = tabsList.indexOf(activeTab);
    if (currentIdx < tabsList.length - 1) {
      setActiveTab(tabsList[currentIdx + 1]);
    }
  };

  const handlePrevTab = () => {
    const currentIdx = tabsList.indexOf(activeTab);
    if (currentIdx > 0) {
      setActiveTab(tabsList[currentIdx - 1]);
    }
  };

  // Compile full report payload and call generator
  const triggerGenerate = async (type: 'interim' | 'comprehensive' | 'docx', format: 'pdf' | 'docx' | 'html') => {
    if (!projectPath) {
      showToast('Please scan or select a project directory first', 'error');
      return;
    }

    setGeneratingButton(type);
    setGenerationSuccess(false);

    try {
      const payload = {
        project_id: projectId,
        report_date: reportDate,
        client_name: clientName,
        submitted_to: submittedTo,
        client_org: institution, // Maps to client_org in EJS and parsed json backend
        service_type: serviceType,
        platform: platform,
        read_length: readLength,
        no_of_samples: noOfSamples,
        data_throughput: dataOutput,
        sample_type: sampleType,
        shipping_condition: shippingCondition,
        samples: qubitData.map(r => r.sample_id),
        qubit_data: qubitData,
        library_sizes: librarySizes.length ? librarySizes : qubitData.map(() => 350),
        gel_image_src: selectedGelImage,
        lane_mapping: {
          headers: ['Lane id', 'Sample name', 'Lane id', 'Sample name', 'Lane id', 'Sample name'],
          rows: Array.from({ length: Math.ceil(lanes.length / 3) }).map((_, rIdx) => {
            const row: string[] = [];
            for (let i = 0; i < 3; i++) {
              const item = lanes[rIdx * 3 + i];
              row.push(item ? item.lane : '');
              row.push(item ? item.sample : '');
            }
            return row;
          })
        },
        tapestation_images: tapestationImages,
        rna_isolation_qc: rnaExtractionMethod,
        rna_isolation_qc_header: rnaExtractionHeader,
        library_preparation: libraryPrepMethod,
        library_preparation_header: libraryPrepHeader,
        cluster_generation: sequencingMethod,
        cluster_generation_header: sequencingHeader,
        library_qc: qcDescription,
        library_qc_header: qcDescriptionHeader,
        conclusions: [conclusionSection],
        conclusions_header: conclusionHeader,
        selected_template_id: selectedTemplateId,
        advanced: {
          autoNumberFigures,
          autoGenerateConclusions,
          autoInsertHeaderFooter,
          confidentialWatermark,
          useClientBranding
        },
        branding: {
          headerText,
          footerText,
          confidentialStatement
        }
      };

      const finalType = type === 'docx' ? 'interim' : type;

      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          wetLabData: payload,
          reportType: finalType
        })
      });
      const res = await response.json();
      if (res.success) {
        setGenerationSuccess(true);
        showToast(`Successfully generated report in deliverables directory!`, 'success');
        setTimeout(() => {
          setGenerationSuccess(false);
          setGeneratingButton(null);
        }, 3000);
      } else {
        showToast(res.error || 'Generation failed', 'error');
        setGeneratingButton(null);
      }
    } catch (e: any) {
      showToast('Network error during generation: ' + e.message, 'error');
      setGeneratingButton(null);
    }
  };

  const handleTemplateToggle = (checked: boolean) => {
    setUseStandardTemplate(checked);
    if (checked) {
      const tpl = STATIC_TEMPLATES.find(t => t.id === selectedTemplateId) || STATIC_TEMPLATES[0];
      setRnaExtractionHeader(tpl.rnaExtractionHeader);
      setRnaExtractionMethod(tpl.rnaExtractionContent);
      setLibraryPrepHeader(tpl.libraryPrepHeader);
      setLibraryPrepMethod(tpl.libraryPrepContent);
      setSequencingHeader(tpl.sequencingHeader);
      setSequencingMethod(tpl.sequencingContent);
      setQcDescriptionHeader(tpl.qcDescriptionHeader);
      setQcDescription(tpl.qcDescriptionContent);
      setConclusionHeader(tpl.conclusionHeader);
      setConclusionSection(tpl.conclusionContent);
    }
  };

  // Compile mock HTML for instantaneous preview inside standard template style
  const generateLivePreviewHtml = () => {
    const activePages = reportPages.filter(p => !p.hidden);
    let previewStyles = `
      body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 24px; background: #fff; }
      .page { border: 1px solid #e2e8f0; padding: 40px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); background: #fff; border-radius: 4px; min-height: 800px; position: relative; }
      .logo-bar { display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 30px; font-size: 11px; color: #64748b; font-weight: 600; }
      .title { font-size: 28px; font-weight: 800; color: #1e3a8a; margin-top: 100px; text-transform: uppercase; }
      .subtitle { font-size: 18px; color: #f97316; font-weight: 600; margin-bottom: 100px; }
      h2 { color: #1e3a8a; border-bottom: 2px solid #f97316; padding-bottom: 6px; margin-top: 24px; font-size: 20px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 15px; }
      table th { background: #1e3a8a; color: white; padding: 8px; text-align: left; }
      table td { border: 1px solid #e2e8f0; padding: 6px 8px; }
      table tr:nth-child(even) { background: #f8fafc; }
      .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 60px; font-weight: bold; color: rgba(226, 232, 240, 0.4); pointer-events: none; z-index: 10; text-transform: uppercase; }
      .footer { position: absolute; bottom: 20px; left: 40px; right: 40px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px; }
    `;

    let html = `<html><head><style>${previewStyles}</style></head><body>`;

    activePages.forEach((page, index) => {
      html += `<div class="page">`;
      if (confidentialWatermark) {
        html += `<div class="watermark">CONFIDENTIAL</div>`;
      }
      if (autoInsertHeaderFooter) {
        html += `
          <div class="logo-bar">
            <span>${headerText}</span>
            <span>${projectId ? 'PROJ: ' + projectId : 'INTERIM REPORT'}</span>
          </div>
        `;
      }

      // Render content depending on page type
      if (page.type === 'cover') {
        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 40px; padding-bottom: 20px;">
            <img src="${logoPath ? '/api/file?path=' + encodeURIComponent(logoPath) : ''}" style="max-height: 45px; max-width: 180px; object-fit: contain;" />
            <img src="${unipathLogoPath ? '/api/file?path=' + encodeURIComponent(unipathLogoPath) : ''}" style="max-height: 45px; max-width: 180px; object-fit: contain;" />
          </div>
          <div style="text-align: center; padding-top: 40px;">
            <div style="font-size: 14px; text-transform: uppercase; font-weight: bold; color: #64748b; tracking: 0.1em;">Interim Quality Control & Sequencing Report</div>
            <div class="title">${projectId || 'NGS PROJECT REPORT'}</div>
            <div class="subtitle">${serviceType}</div>
            
            <div style="margin-top: 80px; font-size: 14px; line-height: 1.8;">
              <div><strong>Client Name:</strong> ${clientName || 'N/A'}</div>
              <div><strong>Institution:</strong> ${institution || 'N/A'}</div>
              <div><strong>Date:</strong> ${reportDate}</div>
              <div><strong>Platform:</strong> ${platform}</div>
            </div>

            <div style="margin-top: 120px; font-size: 12px; color: #64748b;">
              Submitted To: ${submittedTo}
            </div>
          </div>
        `;
      } else if (page.type === 'project') {
        html += `
          <h2>1. Project Specifications</h2>
          <table style="margin-top: 24px;">
            <tr><td><strong>Project ID</strong></td><td>${projectId || 'N/A'}</td></tr>
            <tr><td><strong>Client Name</strong></td><td>${clientName || 'N/A'}</td></tr>
            <tr><td><strong>Institution</strong></td><td>${institution || 'N/A'}</td></tr>
            <tr><td><strong>Service Type</strong></td><td>${serviceType}</td></tr>
            <tr><td><strong>Platform</strong></td><td>${platform}</td></tr>
            <tr><td><strong>Read Length</strong></td><td>${readLength}</td></tr>
            <tr><td><strong>No. of Samples</strong></td><td>${noOfSamples}</td></tr>
            <tr><td><strong>Data output target</strong></td><td>${dataOutput}</td></tr>
            <tr><td><strong>Sample Type</strong></td><td>${sampleType}</td></tr>
            <tr><td><strong>Shipping Condition</strong></td><td>${shippingCondition}</td></tr>
          </table>

          <h3 style="margin-top: 30px; font-size: 14px; color: #1e3a8a;">${rnaExtractionHeader}</h3>
          <p style="font-size: 12px; line-height: 1.6; color: #334155;">${rnaExtractionMethod}</p>
        `;
      } else if (page.type === 'samples') {
        html += `
          <h2>2. RNA QC Quantification</h2>
          <p style="font-size: 12px; margin-bottom: 20px;">The samples were quantified using Qubit Fluorometric assay to determine precise concentrations.</p>
          <table>
            <thead>
              <tr>
                <th>Sample ID</th>
                <th>Conc. (ng/µl)</th>
                <th>Vol (µl)</th>
                <th>Yield (µg)</th>
                <th>Remarks</th>
                <th>QC Status</th>
              </tr>
            </thead>
            <tbody>
              ${qubitData.map(r => `
                <tr>
                  <td><strong>${r.sample_id}</strong></td>
                  <td>${r.conc || 'N/A'}</td>
                  <td>${r.vol || 'N/A'}</td>
                  <td>${r.yield || 'N/A'}</td>
                  <td>${r.remarks || '-'}</td>
                  <td>
                    <span style="padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9px; 
                      background: ${r.qc_status === 'PASS' ? '#dcfce7' : r.qc_status === 'WARN' ? '#fef9c3' : '#fee2e2'}; 
                      color: ${r.qc_status === 'PASS' ? '#166534' : r.qc_status === 'WARN' ? '#854d0e' : '#991b1b'};">
                      ${r.qc_status}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } else if (page.type === 'gel') {
        html += `
          <h2>3. Agarose Gel Analysis</h2>
          <p style="font-size: 12px;">Total RNA integrity was resolved on a 1% agarose gel for assessment of 28S/18S ribosomal RNA bands.</p>
          <div style="border: 1px dashed #cbd5e1; height: 320px; display: flex; align-items: center; justify-content: center; background: #f8fafc; margin: 20px 0; border-radius: 8px;">
            ${selectedGelImage ? 
              `<img src="/api/file?path=${encodeURIComponent(selectedGelImage)}" style="max-height: 100%; max-width: 100%; object-fit: contain;"/>` : 
              `<span style="color: #94a3b8; font-size: 12px;">[ Agarose Gel QC Image Not Loaded ]</span>`
            }
          </div>
          <div style="font-size: 11px; text-align: center; font-style: italic; color: #64748b;">Figure 3.1: 1% Agarose Gel profile of experimental RNA samples.</div>
        `;
      } else if (page.type === 'tapestation') {
        html += `
          <h2>4. TapeStation Size Distribution</h2>
          <p style="font-size: 12px;">Electrophoretic distribution profile of fragmented samples or final library preparation sizing.</p>
          <div style="grid-template-columns: repeat(2, 1fr); gap: 16px; display: grid; margin-top: 20px;">
            ${tapestationImages.slice(0, 4).map(img => `
              <div style="border: 1px solid #e2e8f0; padding: 8px; border-radius: 6px; text-align: center; background: #fafafa;">
                <div style="font-weight: bold; font-size: 11px; margin-bottom: 6px; color: #1e3a8a;">${img.sample_id}</div>
                <div style="height: 120px; display: flex; align-items: center; justify-content: center; background: #fff;">
                  <img src="/api/file?path=${encodeURIComponent(img.src)}" style="max-height: 100%; max-width: 100%; object-fit: contain;"/>
                </div>
              </div>
            `).join('')}
            ${tapestationImages.length === 0 ? `<div style="grid-column: span 2; text-align: center; color: #94a3b8; padding: 40px; font-size: 12px;">[ No TapeStation Profile Images Assigned ]</div>` : ''}
          </div>
        `;
      } else if (page.type === 'conclusions') {
        html += `
          <h2>5. ${conclusionHeader}</h2>
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="font-size: 13px; font-weight: bold; color: #166534; margin: 0 0 8px 0;">Sequence Ready Verdict: PASS</p>
            <p style="font-size: 12px; margin: 0; color: #14532d; white-space: pre-line;">${conclusionSection}</p>
          </div>
          
          <h3 style="margin-top: 20px; font-size: 14px; color: #1e3a8a;">${libraryPrepHeader}</h3>
          <p style="font-size: 12px; line-height: 1.6; color: #334155;">${libraryPrepMethod}</p>
          
          <h3 style="margin-top: 20px; font-size: 14px; color: #1e3a8a;">${qcDescriptionHeader}</h3>
          <p style="font-size: 12px; line-height: 1.6; color: #334155;">${qcDescription}</p>

          ${sequencingMethod.trim() ? `
          <h3 style="margin-top: 20px; font-size: 14px; color: #1e3a8a;">${sequencingHeader}</h3>
          <p style="font-size: 12px; line-height: 1.6; color: #334155;">${sequencingMethod}</p>
          ` : ''}
        `;
      } else if (page.type === 'custom') {
        const cPage = customPages.find(cp => cp.id === page.customId);
        html += `
          <h2>${cPage?.title || 'Custom Section'}</h2>
          <div style="font-size: 12px; line-height: 1.6; margin-top: 20px; white-space: pre-wrap;">${cPage?.content || ''}</div>
        `;
      }

      if (autoInsertHeaderFooter) {
        html += `
          <div class="footer">
            <span>${confidentialStatement}</span>
            <span>Page ${index + 1} of ${activePages.length}</span>
          </div>
        `;
      }
      html += `</div>`;
    });

    html += `</body></html>`;
    return html;
  };

  // If no folder path has been successfully scanned, show Onboarding Welcome Card
  if (!scanResult) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans antialiased text-slate-800 animate-in fade-in duration-300">
        
        {toast && (
          <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className={`px-4 py-3 rounded-lg shadow-lg border text-sm font-semibold flex items-center gap-2 ${
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <span className="w-2.5 h-2.5 rounded-full bg-current"></span>
              <span>{toast.text}</span>
            </div>
          </div>
        )}

        <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6 transform hover:scale-[1.01] transition-transform duration-300">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-sky-600 flex items-center justify-center text-white font-extrabold text-xl mx-auto shadow-sm">
              N
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">NGS Interim Report Automator</h1>
            <p className="text-xs text-slate-400">Select a project deliverables folder containing raw QC and quantification files.</p>
          </div>

          {/* Large Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition cursor-pointer ${
              dragOver ? 'border-sky-500 bg-sky-50/50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100/50'
            }`}
          >
            <svg className="w-10 h-10 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
            <span className="text-xs font-bold text-slate-700">Drop QC Image Folder Here</span>
            <span className="text-[10px] text-slate-400 mt-1">Recursively scans subfolders</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Or Paste Path Manually</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. C:\Users\Lab\Deliverables_260046"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-sky-500"
                />
                <button
                  onClick={handleBrowse}
                  className="bg-slate-100 hover:bg-slate-200 active:scale-[0.98] border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0"
                >
                  Browse Folder
                </button>
              </div>
            </div>

            <button
              onClick={handleScan}
              disabled={loading}
              className="w-full bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white font-bold py-2.5 rounded-lg text-xs transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scanning & Auto-Mapping...
                </>
              ) : 'Initialize Workspace'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Active State
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800 h-screen overflow-hidden">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className={`px-4 py-3 rounded-lg shadow-lg border text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
            'bg-sky-50 border-sky-200 text-sky-800'
          }`}>
            <span className="w-2.5 h-2.5 rounded-full bg-current"></span>
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 transform transition-transform duration-300 md:translate-x-0 md:static ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="p-6 border-b border-slate-100 flex items-center justify-between relative">
            <div className="flex items-center justify-center w-full">
              <img
                src={logoPath ? `/api/file?path=${encodeURIComponent(logoPath)}` : ''}
                alt="Unigenome Logo"
                className="max-h-10 w-auto object-contain"
              />
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-slate-600 font-bold p-1 text-sm absolute right-4"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
            {tabsList.map((tab) => {
              const icons: Record<string, React.ReactNode> = {
                project: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5"></path></svg>,
                samples: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>,
                static: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>,
                qc: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>,
                preview: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>,
                export: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20"></path></svg>
              };

              const labels: Record<TabType, string> = {
                project: 'Project Information',
                samples: 'Sample Information',
                static: 'Static Content',
                qc: 'QC Images',
                preview: 'Report Preview',
                export: 'Export Report'
              };

              return (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold transition-all border-l-4 ${
                    activeTab === tab
                      ? 'bg-slate-100 text-[#1A365D] border-[#1A365D] font-bold'
                      : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {icons[tab]}
                  {labels[tab]}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs flex justify-between items-center">
            <div className="truncate text-slate-400 font-mono text-[10px] max-w-[150px]" title={projectPath}>
              {projectPath.split(/[\\/]/).pop()}
            </div>
            <button
              onClick={() => setScanResult(null)}
              className="text-[10px] text-sky-600 hover:underline font-bold"
            >
              Reset
            </button>
          </div>
        </aside>

        {/* Mobile menu backdrop */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden"
          />
        )}

        {/* Dashboard Panels */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
          
          {/* Header */}
          <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden text-slate-600 hover:text-slate-900 focus:outline-none p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest truncate max-w-[200px] sm:max-w-xs md:max-w-none">
                Active Project: <span className="font-mono text-slate-800">{projectPath || 'None'}</span>
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleScan}
                className="bg-slate-100 hover:bg-slate-200 active:scale-[0.98] border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
              >
                Refresh Scan
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full pb-24 space-y-6">
            
            {/* TAB 1: Project details */}
            {activeTab === 'project' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Project Details Card</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Project ID</label>
                      <input
                        type="text"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Client Name</label>
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Submitted To</label>
                      <input
                        type="text"
                        value={submittedTo}
                        onChange={(e) => setSubmittedTo(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Institution</label>
                      <input
                        type="text"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Report Date</label>
                      <input
                        type="text"
                        value={reportDate}
                        onChange={(e) => setReportDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Service Type</label>
                      <input
                        type="text"
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Sequencing Platform</label>
                      <input
                        type="text"
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Read Length</label>
                      <input
                        type="text"
                        value={readLength}
                        onChange={(e) => setReadLength(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Number of Samples</label>
                      <input
                        type="text"
                        value={noOfSamples}
                        onChange={(e) => setNoOfSamples(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Data Output Target</label>
                      <input
                        type="text"
                        value={dataOutput}
                        onChange={(e) => setDataOutput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    {/* Fixed: Added Sample Type Box */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Sample Type</label>
                      <input
                        type="text"
                        value={sampleType}
                        onChange={(e) => setSampleType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    {/* Fixed: Added Shipping Condition Box */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Shipping Condition</label>
                      <input
                        type="text"
                        value={shippingCondition}
                        onChange={(e) => setShippingCondition(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Branding Config */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Branding & Headers Settings</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Header Label</label>
                      <input
                        type="text"
                        value={headerText}
                        onChange={(e) => setHeaderText(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Footer Page Indicator</label>
                      <input
                        type="text"
                        value={footerText}
                        onChange={(e) => setFooterText(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Confidential Statement</label>
                      <input
                        type="text"
                        value={confidentialStatement}
                        onChange={(e) => setConfidentialStatement(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Advanced Config */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Advanced Config Settings</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={autoNumberFigures} onChange={(e) => setAutoNumberFigures(e.target.checked)} className="rounded text-sky-600" />
                      <span className="text-xs font-semibold text-slate-700">Auto Number Figures</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={autoGenerateConclusions} onChange={(e) => setAutoGenerateConclusions(e.target.checked)} className="rounded text-sky-600" />
                      <span className="text-xs font-semibold text-slate-700">Auto Generate Conclusions</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={autoInsertHeaderFooter} onChange={(e) => setAutoInsertHeaderFooter(e.target.checked)} className="rounded text-sky-600" />
                      <span className="text-xs font-semibold text-slate-700">Insert Header/Footer</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={confidentialWatermark} onChange={(e) => setConfidentialWatermark(e.target.checked)} className="rounded text-sky-600" />
                      <span className="text-xs font-semibold text-slate-700">Confidential Watermark</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={useClientBranding} onChange={(e) => setUseClientBranding(e.target.checked)} className="rounded text-sky-600" />
                      <span className="text-xs font-semibold text-slate-700">Use Client Branding</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Sample Info */}
            {activeTab === 'samples' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Sample Information Section</h2>
                      <p className="text-xs text-slate-400 mt-1">Manage, add, paste, or import raw RNA quantification tables.</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowPasteModal(true)}
                        className="bg-slate-100 hover:bg-slate-200 active:scale-[0.98] border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      >
                        Paste from Excel
                      </button>
                      <label className="bg-slate-100 hover:bg-slate-200 active:scale-[0.98] border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer">
                        Import CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                      </label>
                      <button
                        onClick={handleExportCSV}
                        className="bg-slate-100 hover:bg-slate-200 active:scale-[0.98] border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      >
                        Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                          <th className="px-4 py-3">Sample ID</th>
                          <th className="px-4 py-3">Concentration (ng/µl)</th>
                          <th className="px-4 py-3">Volume (µl)</th>
                          <th className="px-4 py-3">Yield (µg)</th>
                          <th className="px-4 py-3">Remarks</th>
                          <th className="px-4 py-3">QC Status</th>
                          <th className="px-4 py-3 text-center">Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qubitData.map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={row.sample_id}
                                onChange={(e) => {
                                  const copy = [...qubitData];
                                  copy[idx].sample_id = e.target.value;
                                  setQubitData(copy);
                                }}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-mono focus:border-sky-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={row.conc}
                                onChange={(e) => {
                                  const copy = [...qubitData];
                                  copy[idx].conc = e.target.value;
                                  copy[idx].qc_status = parseFloat(e.target.value) > 20 ? 'PASS' : parseFloat(e.target.value) > 5 ? 'WARN' : 'FAIL';
                                  setQubitData(copy);
                                }}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-xs focus:border-sky-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={row.vol}
                                onChange={(e) => {
                                  const copy = [...qubitData];
                                  copy[idx].vol = e.target.value;
                                  setQubitData(copy);
                                }}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-xs focus:border-sky-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={row.yield}
                                onChange={(e) => {
                                  const copy = [...qubitData];
                                  copy[idx].yield = e.target.value;
                                  setQubitData(copy);
                                }}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-xs focus:border-sky-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={row.remarks}
                                onChange={(e) => {
                                  const copy = [...qubitData];
                                  copy[idx].remarks = e.target.value;
                                  setQubitData(copy);
                                }}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-xs focus:border-sky-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <select
                                value={row.qc_status}
                                onChange={(e) => {
                                  const copy = [...qubitData];
                                  copy[idx].qc_status = e.target.value as any;
                                  setQubitData(copy);
                                }}
                                className={`rounded text-xs font-semibold px-2 py-0.5 border ${
                                  row.qc_status === 'PASS' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                  row.qc_status === 'WARN' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                  'bg-rose-50 border-rose-200 text-rose-700'
                                }`}
                              >
                                <option value="PASS">PASS</option>
                                <option value="WARN">WARN</option>
                                <option value="FAIL">FAIL</option>
                              </select>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <button onClick={() => handleDeleteRow(idx)} className="text-slate-400 hover:text-rose-600 transition font-bold">
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={handleAddRow}
                    className="mt-4 w-full border border-dashed border-slate-300 hover:bg-slate-50 text-slate-600 py-2 rounded-lg text-xs font-bold transition-all"
                  >
                    + Add Sample Row
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: Static Content */}
            {activeTab === 'static' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  
                  {/* Top Bar Header */}
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Static Content & Templates</h2>
                      <p className="text-xs text-slate-400 mt-1">Select a baseline template and fully customize the section titles and narrative text.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-600">Lock to Template Defaults</span>
                      <button
                        onClick={() => handleTemplateToggle(!useStandardTemplate)}
                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                          useStandardTemplate ? 'bg-sky-600' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                            useStandardTemplate ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Template Selection Grid */}
                  <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Select Baseline RNA-Seq Template</h3>
                    <p className="text-[10px] text-slate-400 mb-4">Select a standard prep template to populate defaults. Unlock the fields above to edit the headings or text paragraphs.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {STATIC_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => applyTemplate(tpl.id as 'kapa' | 'bacteria' | 'hmr')}
                          className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-200 ${
                            selectedTemplateId === tpl.id
                              ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/10'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex justify-between items-center w-full mb-1.5">
                            <span className="text-xs font-bold text-slate-800">{tpl.name}</span>
                            {selectedTemplateId === tpl.id && (
                              <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 leading-normal mb-3">{tpl.description}</p>
                          <div className="mt-auto border-t border-slate-100 pt-2.5 text-[9px] text-slate-400">
                            <strong className="text-slate-600">Kit/Method difference:</strong> {tpl.diffExplanation}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Editable Forms */}
                  <div className="space-y-5">
                    
                    {/* Section 1: Extraction & Quantification */}
                    <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4 space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Section 1 Header (Editable)</label>
                        <input
                          type="text"
                          disabled={useStandardTemplate}
                          value={rnaExtractionHeader}
                          onChange={(e) => setRnaExtractionHeader(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-sky-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Section 1 Content</label>
                        <textarea
                          disabled={useStandardTemplate}
                          value={rnaExtractionMethod}
                          onChange={(e) => setRnaExtractionMethod(e.target.value)}
                          rows={3}
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed focus:border-sky-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Section 2: Library Preparation */}
                    <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4 space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Section 2 Header (Editable)</label>
                        <input
                          type="text"
                          disabled={useStandardTemplate}
                          value={libraryPrepHeader}
                          onChange={(e) => setLibraryPrepHeader(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-sky-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Section 2 Content</label>
                        <textarea
                          disabled={useStandardTemplate}
                          value={libraryPrepMethod}
                          onChange={(e) => setLibraryPrepMethod(e.target.value)}
                          rows={5}
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed focus:border-sky-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Section 3: Library QC */}
                    <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4 space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Section 3 Header (Editable)</label>
                        <input
                          type="text"
                          disabled={useStandardTemplate}
                          value={qcDescriptionHeader}
                          onChange={(e) => setQcDescriptionHeader(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-sky-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Section 3 Content</label>
                        <textarea
                          disabled={useStandardTemplate}
                          value={qcDescription}
                          onChange={(e) => setQcDescription(e.target.value)}
                          rows={3}
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed focus:border-sky-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Section 4: Sequencing / Cluster Gen */}
                    <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4 space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Section 4 Header (Editable)</label>
                        <input
                          type="text"
                          disabled={useStandardTemplate}
                          value={sequencingHeader}
                          onChange={(e) => setSequencingHeader(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-sky-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Section 4 Content (Optional - Leave blank to hide in report)</label>
                        <textarea
                          disabled={useStandardTemplate}
                          value={sequencingMethod}
                          onChange={(e) => setSequencingMethod(e.target.value)}
                          rows={4}
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed focus:border-sky-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                          placeholder="Enter sequencing cluster generation methodology details here. Leave blank for KAPA and other templates that do not require a separate section."
                        />
                      </div>
                    </div>

                    {/* Section 5: Conclusions */}
                    <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4 space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Conclusions Header (Editable)</label>
                        <input
                          type="text"
                          disabled={useStandardTemplate}
                          value={conclusionHeader}
                          onChange={(e) => setConclusionHeader(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-sky-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Conclusions Content</label>
                        <textarea
                          disabled={useStandardTemplate}
                          value={conclusionSection}
                          onChange={(e) => setConclusionSection(e.target.value)}
                          rows={4}
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed focus:border-sky-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: QC Images & Mappings */}
            {activeTab === 'qc' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Auto Mapping verification */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Auto Mapping Section</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-lg p-3.5 text-emerald-800 text-xs">
                      <span className="text-lg">✓</span>
                      <div>
                        <div className="font-bold">RNA QC Images assigned</div>
                        <div className="opacity-80">{detectedImages.rnaQc.length || 0} images mapped automatically</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-lg p-3.5 text-emerald-800 text-xs">
                      <span className="text-lg">✓</span>
                      <div>
                        <div className="font-bold">TapeStation profiles matched</div>
                        <div className="opacity-80">{tapestationImages.length || 0} profiles active</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-lg p-3.5 text-emerald-800 text-xs">
                      <span className="text-lg">✓</span>
                      <div>
                        <div className="font-bold">Quantification table detected</div>
                        <div className="opacity-80">{qubitData.length} records bound</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Display total counts */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Scanned QC Image Inventory</h2>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                      <div className="font-bold text-slate-700 text-sm">{detectedImages.rnaQc.length}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">RNA QC Images</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                      <div className="font-bold text-slate-700 text-sm">{detectedImages.tapestation.length}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">TapeStation</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                      <div className="font-bold text-slate-700 text-sm">{detectedImages.bioanalyzer.length}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">Bioanalyzer</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                      <div className="font-bold text-slate-700 text-sm">{detectedImages.gel.length}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">Gel Images</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                      <div className="font-bold text-slate-700 text-sm">{detectedImages.qubit.length}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">Qubit Profiles</div>
                    </div>
                  </div>

                  {/* Thumbnail Previews */}
                  <h3 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">Image Previews</h3>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {scanResult?.imageFiles?.map((f: string, idx: number) => (
                      <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-1 flex flex-col items-center">
                        <img src={`/api/file?path=${encodeURIComponent(f)}`} alt="scanned-qc" className="h-16 w-full object-contain bg-white rounded" />
                        <span className="text-[8px] text-slate-400 font-mono truncate w-full text-center mt-1">
                          {f.split(/[\\/]/).pop()}
                        </span>
                      </div>
                    ))}
                    {(!scanResult?.imageFiles || scanResult?.imageFiles?.length === 0) && (
                      <div className="col-span-full py-6 text-center text-xs text-slate-400">No images found in scanned folder</div>
                    )}
                  </div>
                </div>

                {/* Agarose Gel Image Select */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Agarose Gel Mapping</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Assigned Gel Image</label>
                      <select
                        value={selectedGelImage}
                        onChange={(e) => setSelectedGelImage(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-sky-500 focus:outline-none"
                      >
                        <option value="">-- Choose Gel Image --</option>
                        {(scanResult?.imageFiles || []).map((f: string) => (
                          <option key={f} value={f}>{f.split(/[\\/]/).pop()}</option>
                        ))}
                      </select>
                    </div>
                    {selectedGelImage && (
                      <div className="border border-slate-200 rounded-lg p-2 bg-slate-50 flex items-center justify-center h-48 animate-in zoom-in-95 duration-200">
                        <img src={`/api/file?path=${encodeURIComponent(selectedGelImage)}`} alt="Gel" className="max-h-full max-w-full object-contain" />
                      </div>
                    )}
                  </div>
                </div>

                {/* TapeStation sample assignment */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">TapeStation Sample Assignments</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {qubitData.map((row, idx) => {
                      const assigned = tapestationImages.find(img => img.sample_id === row.sample_id)?.src || '';
                      return (
                        <div key={idx} className="border border-slate-100 rounded-lg p-3 bg-slate-50 flex items-center justify-between gap-4">
                          <span className="font-mono text-xs font-bold text-slate-700">{row.sample_id}</span>
                          <div className="flex-1">
                            <select
                              value={assigned}
                              onChange={(e) => {
                                const filter = tapestationImages.filter(i => i.sample_id !== row.sample_id);
                                if (e.target.value) {
                                  filter.push({ sample_id: row.sample_id, src: e.target.value });
                                }
                                setTapestationImages(filter);
                              }}
                              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-xs focus:border-sky-500 focus:outline-none"
                            >
                              <option value="">-- No Tape Image --</option>
                              {(scanResult?.imageFiles || []).map((f: string) => (
                                <option key={f} value={f}>{f.split(/[\\/]/).pop()}</option>
                              ))}
                            </select>
                          </div>
                          {assigned && (
                            <img src={`/api/file?path=${encodeURIComponent(assigned)}`} alt="Tapestation Profile" className="w-12 h-10 object-cover rounded bg-white animate-in fade-in duration-200" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 5: Outlines & Realtime Preview */}
            {activeTab === 'preview' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Document Page Outline</h3>
                      <button
                        onClick={() => setShowAddPageModal(true)}
                        className="text-sky-600 hover:text-sky-700 text-xs font-bold"
                      >
                        + Add Page
                      </button>
                    </div>

                    <div className="space-y-2">
                      {reportPages.map((page, idx) => (
                        <div key={page.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => togglePageVisibility(page.id)}
                              className={`w-5 h-5 flex items-center justify-center rounded-full border text-[10px] transition-colors ${
                                page.hidden ? 'bg-slate-200 border-slate-300 text-slate-500' : 'bg-sky-100 border-sky-300 text-sky-700'
                              }`}
                            >
                              {page.hidden ? '✕' : '✓'}
                            </button>
                            <span className={`font-semibold ${page.hidden ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                              {page.title}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => movePage(idx, 'up')} className="text-slate-400 hover:text-slate-600 font-bold p-1">▲</button>
                            <button onClick={() => movePage(idx, 'down')} className="text-slate-400 hover:text-slate-600 font-bold p-1">▼</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-8 flex flex-col space-y-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col h-[750px] overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Live EJS Synchronized Preview</span>
                    </div>
                    
                    <iframe
                      title="Live Report"
                      srcDoc={generateLivePreviewHtml()}
                      className="w-full flex-1 border border-slate-100 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: Export interim and full */}
            {activeTab === 'export' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm max-w-xl mx-auto text-center space-y-6">
                  <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                    📁
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Generate Interim Reports</h2>
                    <p className="text-xs text-slate-400 mt-2">Generate PDF, HTML, or DOCX formats automatically in target folder.</p>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    
                    {/* BUTTON 1: Interim PDF */}
                    <button
                      onClick={() => triggerGenerate('interim', 'pdf')}
                      disabled={generatingButton !== null}
                      className={`w-full font-bold py-2.5 rounded-lg text-xs shadow-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97] active:duration-75 ${
                        generatingButton === 'interim' 
                          ? 'bg-sky-500 text-white cursor-wait' 
                          : 'bg-sky-600 hover:bg-sky-700 text-white'
                      }`}
                    >
                      {generatingButton === 'interim' ? (
                        <>
                          {generationSuccess ? (
                            <span className="flex items-center gap-1.5 animate-bounce">
                              ✓ Generated Successfully!
                            </span>
                          ) : (
                            <>
                              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Compiling Interim Report...
                            </>
                          )}
                        </>
                      ) : 'Generate Interim PDF & HTML'}
                    </button>

                    {/* BUTTON 2: Combined Report */}
                    <button
                      onClick={() => triggerGenerate('comprehensive', 'pdf')}
                      disabled={generatingButton !== null}
                      className={`w-full font-bold py-2.5 rounded-lg text-xs shadow-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97] active:duration-75 ${
                        generatingButton === 'comprehensive'
                          ? 'bg-slate-700 text-white cursor-wait'
                          : 'bg-slate-900 hover:bg-black text-white'
                      }`}
                    >
                      {generatingButton === 'comprehensive' ? (
                        <>
                          {generationSuccess ? (
                            <span className="flex items-center gap-1.5 animate-bounce">
                              ✓ Generated Successfully!
                            </span>
                          ) : (
                            <>
                              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Compiling Combined Report...
                            </>
                          )}
                        </>
                      ) : 'Generate Combined/Comprehensive Report'}
                    </button>

                    {/* BUTTON 3: DOCX */}
                    <button
                      onClick={() => triggerGenerate('docx', 'docx')}
                      disabled={generatingButton !== null}
                      className={`w-full font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97] active:duration-75 ${
                        generatingButton === 'docx'
                          ? 'bg-slate-100 text-slate-400 cursor-wait border border-slate-200'
                          : 'border border-slate-300 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {generatingButton === 'docx' ? (
                        <>
                          {generationSuccess ? (
                            <span className="flex items-center gap-1.5 animate-bounce text-emerald-600">
                              ✓ Document Saved!
                            </span>
                          ) : (
                            <>
                              <svg className="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Saving Word DOCX...
                            </>
                          )}
                        </>
                      ) : 'Generate DOCX Format'}
                    </button>

                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Persistent Action Footer Bar with Back / Next Navigation */}
          <footer className="h-16 bg-white border-t border-slate-200 px-8 flex items-center justify-between shrink-0 sticky bottom-0 left-0 right-0 z-20">
            <div>
              {tabsList.indexOf(activeTab) > 0 && (
                <button
                  onClick={handlePrevTab}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-1"
                >
                  ← Back
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400">
                Step {tabsList.indexOf(activeTab) + 1} of {tabsList.length}
              </span>
              {tabsList.indexOf(activeTab) < tabsList.length - 1 ? (
                <button
                  onClick={handleNextTab}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all active:scale-[0.97] shadow-sm flex items-center gap-1"
                >
                  Next Section →
                </button>
              ) : (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Ready to Export
                </span>
              )}
            </div>
          </footer>

        </main>
      </div>

      {/* Excel paste modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Paste Samples from Excel</h3>
              <p className="text-xs text-slate-400 mt-1">Copy and paste rows directly from spreadsheets (e.g. S1, conc, vol, yield).</p>
            </div>
            <textarea
              placeholder="Sample1&#9;45.2&#9;20&#9;0.90"
              rows={8}
              value={excelPasteText}
              onChange={(e) => setExcelPasteText(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-3 text-xs font-mono focus:border-sky-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPasteModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition">
                Cancel
              </button>
              <button onClick={handleExcelPaste} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition">
                Import Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Page Modal */}
      {showAddPageModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Add Custom Report Page</h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Page Title</label>
              <input
                type="text"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Page Content</label>
              <textarea
                rows={6}
                value={newPageContent}
                onChange={(e) => setNewPageContent(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-3 text-xs focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddPageModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition">
                Cancel
              </button>
              <button onClick={handleAddCustomPage} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition">
                Insert Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Browser Modal */}
      {showFolderBrowser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 flex flex-col h-[550px]">
            <div className="flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Select Project Directory</h3>
                <p className="text-xs text-slate-400 mt-1">Navigate to the folder containing your project files.</p>
              </div>
              <button onClick={() => setShowFolderBrowser(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">×</button>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <button 
                disabled={!browserParent}
                onClick={() => fetchDirs(browserParent)}
                className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
              >
                <span>↑ Up</span>
              </button>
              <input
                type="text"
                value={browserPath}
                onChange={(e) => setBrowserPath(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchDirs(browserPath); }}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:border-sky-500 focus:outline-none"
              />
              <button 
                onClick={() => fetchDirs(browserPath)}
                className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
              >
                Go
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500 font-bold">Quick locations:</span>
              <button onClick={() => fetchDirs('.')} className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-mono">Workspace Root</button>
              <button onClick={() => fetchDirs('C:\\')} className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-mono">C:\</button>
              <button onClick={() => fetchDirs('D:\\')} className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-mono">D:\</button>
            </div>

            <div className="flex-1 min-h-0 border border-slate-200 rounded-lg overflow-y-auto bg-slate-50">
              {browserLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-slate-400">
                  <svg className="animate-spin h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading directories...
                </div>
              ) : browserDirs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-slate-400">
                  No subdirectories found.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {browserDirs.map((dir) => (
                    <div
                      key={dir}
                      onClick={() => {
                        const nextPath = browserPath ? (browserPath.endsWith('/') || browserPath.endsWith('\\') ? browserPath + dir : browserPath + (browserPath.includes('\\') ? '\\' : '/') + dir) : dir;
                        fetchDirs(nextPath);
                      }}
                      className="flex items-center gap-2 px-4 py-3 hover:bg-slate-100 cursor-pointer text-xs font-mono text-slate-700 transition"
                    >
                      <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                      </svg>
                      <span className="truncate">{dir}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center shrink-0">
              <span className="text-[11px] text-slate-400 truncate max-w-sm">
                Selected: <span className="font-mono text-slate-600 font-bold">{browserPath}</span>
              </span>
              <div className="flex gap-2">
                <button onClick={() => setShowFolderBrowser(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition">
                  Cancel
                </button>
                <button onClick={handleSelectBrowserFolder} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition">
                  Select Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
