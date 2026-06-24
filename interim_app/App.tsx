import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';

// Helper functions for client-side Excel parsing
function normCol(c: string): string {
  return c
    .toLowerCase()
    .replace(/%/g, 'pct')
    .replace(/[^a-z0-9]+/g, '');
}

function pickColumn(row: Record<string, unknown>, aliases: string[]): unknown {
  if (!row || aliases.length === 0) return undefined;
  const normMap: Record<string, string> = {};
  for (const col of Object.keys(row)) {
    normMap[normCol(col)] = col;
  }
  for (const alias of aliases) {
    const key = normMap[normCol(alias)];
    if (key !== undefined && row[key] !== undefined && row[key] !== '') {
      return row[key];
    }
  }
  for (const alias of aliases) {
    const nc = normCol(alias);
    const matchedKey = Object.keys(row).find((c) => normCol(c).includes(nc));
    if (matchedKey !== undefined && row[matchedKey] !== undefined && row[matchedKey] !== '') {
      return row[matchedKey];
    }
  }
  return undefined;
}

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
    conclusionContent: '- The libraries were prepared from the samples by NEBNext® Ultra™ RNA Library Prep Kit for Illumina. (NEB #E7770).\n- The average size of libraries is 479bp, 503bp, 487bp, 539bp, 377bp, 424bp, 469bp, 456bp, 413bp and 405bp for 01460HNTB, 01462HNTB, 01464HNTB, 01469HNTB, 01470HNTB, 01471HNTB, 01473HNTB and 01474HNTB.\n- The libraries were sequenced on Illumina Novaseq X Plus platform using 2-x 150 bp chemistry to generate ~08-9GB/Sample.'
  },
  {
    id: 'hmr',
    name: 'KAPA RNA HyperPrep with RiboErase (HMR)',
    description: 'Bacterial/Human/Mouse/Rat (HMR) ribodepletion workflow using the KAPA RNA HyperPrep Kit with RiboErase (HMR) (Cat no: KK8561) and QIAGEN RNeasy isolation.',
    diffExplanation: 'Uses KAPA RNA HyperPrep Kit with RiboErase (HMR) (100 ng input), QIAGEN RNeasy isolation, and Novaseq X Plus sequencing. Has separate Cluster Gen section.',
    rnaExtractionHeader: 'Isolation and Quantitative analysis of RNA:',
    rnaExtractionContent: 'RNA sample was extracted from tissue sample using QIAGEN RNeasy mini kit (CAT.NO:74106). RNA quantity was measured using Qubit® 4.0 fluorometer and quality were analyzed by using 1% agarose gel.',
    libraryPrepHeader: 'Preparation of library:',
    libraryPrepContent: 'The paired-end sequencing library was prepared using NEBNext® Ultra™ RNA Library Prep Kit for Illumina. (NEB #E7770). The library preparation process was initiated with 100 ng input. Ribosomal RNA was removed using depletion was carried out using ribodepletion kit KAPA RNA HyperPrep Kit with RiboErase (HMR), Cat no: KK8561) as per user manual. Ribo-depleted RNA was subjected to fragmentation, first & second-strand cDNA synthesis, end-repair, 3´ adapter ligation, selective enrichment of adapter-ligated DNA fragments through PCR amplification, followed by validation of Library on Agilent 4150 tape station. The final library was pooled with other samples, denatured & loaded on to flow cell. On the flowcell, cluster generation & sequencing was performed using Illumina Novaseq X plus platform to generate 2×150bp paired-end (PE) reads.',
    sequencingHeader: 'Cluster Generation and Sequencing:',
    sequencingContent: 'After obtaining the Qubit concentration for the library and the mean peak size from Tape Station profile, library will be loaded onto Illumina Novaseq X Plus for cluster generation and sequencing. Paired-End sequencing allows the template fragments to be sequenced in both the forward and reverse directions. The library molecules will bind to complementary adapter oligos on paired-end flow cell. The adapters are designed to allow selective cleavage of the forward strands after re-synthesis of the reverse strand during sequencing. The copied reverse strand is then used to sequence from the opposite end of the fragment.',
    qcDescriptionHeader: 'Quantity and quality check (QC) of library on Agilent Tape Station 4150:',
    qcDescriptionContent: 'The amplified library analyzed on TapeStation 4150 (Agilent Technologies) using High Sensitivity D1000 ScreenTape® as per manufacturer\'s instructions.',
    conclusionHeader: 'Conclusions:',
    conclusionContent: '- The library was prepared from the samples using KAPA RNA HyperPrep Kit with RiboErase (HMR), Cat no: KK8561.\n- The average size of library is 342bp.\n- The library will be sequenced on Illumina Novaseq X plus platform using 2x150 bp PE chemistry.'
  },
  {
    id: '16s',
    name: '16s V3-V4 Metagenome',
    description: '16s V3-V4 Metagenome Sequencing & Analysis on Illumina Platform.',
    diffExplanation: 'Uses Nextera XT Indices kit, Alexgen Soil DNA Kit, and PE300 kit on Miseq platform.',
    rnaExtractionHeader: 'Isolation and Quantitative analysis of DNA:',
    rnaExtractionContent: 'DNA was extracted from Soil Samples using Alexgen Soil DNA Kit. (Cat. No. 1008). DNA quantity was measured using Qubit® 4.0 fluorometer and DNA sample was amplified using 16s primer set and analyzed by gel electrophoresis.',
    libraryPrepHeader: 'Preparation of library:',
    libraryPrepContent: 'The V3-V4 (Product size ~459bp) region of 16s RNA gene was amplified using specific primers. PCR amplified product will be re-amplified using specific V3-F and V4-R primers with overhang adapter via PCR.\n\nV3-F =16S Amplicon PCR Forward Primer \nTCGTCGGCAGCGTCAGATGTGTATAAGAGACAGCCTACGGGNGGCWGCAG\n\nV4-R =16S Amplicon PCR Reverse Primer \nGTCTCGTGGGCTCGGAGATGTGTATAAGAGACAGGACTACHVGGGTATCTAATCC. \n\nAfterwards, PCR products were purified by using Ampure XP beads. The purified amplicons were subjected to index PCR using Nextera XT indices kit. The resulting indexed amplicons were purified using AmPure XP beads and checked on Agilent tapestation. Libraries were quantified using Qubit HS and qPCR mix pooled together for sequencing',
    sequencingHeader: 'Cluster Generation and Sequencing:',
    sequencingContent: 'The pooled PCR products (library) were loaded on sequencer for cluster generation by hybridization onto the oligonucleotide-coated surface of the flowcell. Immobilized DNA template copies were amplified by bridge amplification to generate clonal DNA clusters. Sequencing was performed using PE300 kit for sequencing of 16S sequencing on Miseq platform.',
    qcDescriptionHeader: 'Quantity and quality check (QC) of library on Agilent Tape Station 4150:',
    qcDescriptionContent: 'The amplified library analyzed on TapeStation 4150 (Agilent Technologies) using High Sensitivity D1000 ScreenTape® as per manufacturer\'s instructions.',
    conclusionHeader: 'Conclusions:',
    conclusionContent: '- The library was prepared from the samples by using Nextera XT Indices kit.\n- The average size of library is 617bp.\n- The library was sequenced on Illumina Miseq platform (2 x 300 bp chemistry) to generate ~0.1 M reads /sample.'
  }
];

// ─── File Classification Helpers ─────────────────────────────────────────────
// These run on the CLIENT side (browser-uploaded files or path-string arrays
// returned from the server scan API).  The same logic mirrors src/api.ts so
// that behaviour is identical whether you are using the web tunnel or the
// local desktop path browser.

/** Returns the bare lowercase stem of a filename (no extension, no path). */
function fileStem(name: string): string {
  return name.split(/[/\\]/).pop()!.toLowerCase().replace(/\.(xlsx|xls|csv|png|jpg|jpeg)$/i, '');
}

/** Returns the bare lowercase basename WITH extension. */
function fileBase(name: string): string {
  return name.split(/[/\\]/).pop()!.toLowerCase();
}

/** True if the file looks like a qubit / quantification spreadsheet. */
function isQubitFilename(name: string): boolean {
  const stem = fileStem(name);
  return stem === 'qubit' || stem.startsWith('qubit') || stem.includes('qubit') || stem.includes('quant');
}

/** True if the file looks like a lane-mapping spreadsheet. */
function isLaneFilename(name: string): boolean {
  const stem = fileStem(name);
  return stem === 'lane' || stem.startsWith('lane') || stem.includes('lane');
}

/** Pick the best qubit file from an array of filenames.
 *  Prefers an exact-named "qubit.*" file; falls back to any file whose stem
 *  contains 'qubit' or 'quant'. */
function pickQubitFile(files: string[]): string[] {
  const exact = files.filter(f => fileStem(f) === 'qubit');
  return exact.length > 0 ? exact : files.filter(isQubitFilename);
}

/** Pick the best lane-map file from an array of filenames. */
function pickLaneFile(files: string[]): string[] {
  const exact = files.filter(f => fileStem(f) === 'lane');
  return exact.length > 0 ? exact : files.filter(isLaneFilename);
}

/** Classify an array of image path strings and return them in canonical order:
 *  1. Agarose gel images  (A-Z)
 *  2. TapeStation images   (A-Z)
 *  3. Everything else      (A-Z)
 */
function classifyAndOrderImages(images: string[]): {
  gel: string[];
  tapestation: string[];
  rnaQc: string[];
  bioanalyzer: string[];
  qubit: string[];
  ordered: string[];
} {
  const byBase = (a: string, b: string) => fileBase(a).localeCompare(fileBase(b));
  const sorted = [...images].sort(byBase);

  const gel = sorted.length > 0 ? [sorted[0]] : [];
  const tapestation = sorted.length > 1 ? sorted.slice(1) : [];

  const rnaQc = images.filter(f => /rna.*qc|qc.*rna/i.test(fileBase(f)));
  const bioanalyzer = images.filter(f => /bioanalyzer|rin|ladder/i.test(fileBase(f)));
  const qubit = images.filter(f => /qubit|quant/i.test(fileBase(f)));

  return { gel, tapestation, rnaQc, bioanalyzer, qubit, ordered: sorted };
}
// ─────────────────────────────────────────────────────────────────────────────

function getImageLabel(src: string): string {
  if (!src) return '';
  if (src.startsWith('data:')) {
    return `Uploaded Custom Image (${src.substring(0, 30)}...)`;
  }
  return src.split(/[/\\]/).pop() || src;
}

export default function App() {

  const tabsList = ['project', 'samples', 'static', 'qc', 'preview', 'export'] as const;
  type TabType = typeof tabsList[number];

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Navigation active tab
  const [activeTab, setActiveTab] = useState<TabType>('project');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Directory setup
  const [projectPath, setProjectPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Generation status tracking for visual feedback
  const [generatingButton, setGeneratingButton] = useState<'interim' | 'comprehensive' | 'interim_docx' | 'comprehensive_docx' | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<boolean>(false);
  // Download links returned by the server when running via web/cloudflare tunnel
  const [downloadableFiles, setDownloadableFiles] = useState<Array<{ path: string; size: number; downloadUrl: string | null }>>([]);

  // 1. Project Details
  const [projectId, setProjectId] = useState('');
  const [submittedTo, setSubmittedTo] = useState('Dr. Amit Gupta');
  const [refGenomeLink, setRefGenomeLink] = useState('https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/405/GCF_000001405.40_GRCh38.p14/');
  const [institution, setInstitution] = useState('Unigenome Bioinformatics Lab');
  const [reportDate, setReportDate] = useState(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
  const [serviceType, setServiceType] = useState('Transcriptome Sequencing');
  const [platform, setPlatform] = useState('Illumina Novaseq X Plus');
  const [readLength, setReadLength] = useState('2 X 150 PE');
  const [noOfSamples, setNoOfSamples] = useState('0');
  const [noOfLibrariesPrepared, setNoOfLibrariesPrepared] = useState('0');
  const [dataOutput, setDataOutput] = useState('~06GB / Sample');
  const [sampleType, setSampleType] = useState('Leaf');
  const [shippingCondition, setShippingCondition] = useState('Dry Ice');

  // 2. Samples Information Table
  const [qubitData, setQubitData] = useState<QubitRow[]>([]);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [excelPasteText, setExcelPasteText] = useState('');

  // 3. Static Content (using exact text from wet_lab_notes.txt)
  const [useStandardTemplate, setUseStandardTemplate] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<'kapa' | 'bacteria' | 'hmr' | '16s'>('kapa');

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

  const applyTemplate = (tplId: 'kapa' | 'bacteria' | 'hmr' | '16s') => {
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

      if (tplId === '16s') {
        setServiceType('16s V3-V4 Metagenome Sequencing & Analysis');
        setPlatform('Illumina Miseq');
        setReadLength('2 X 300 bp PE');
        setDataOutput('~0.1 M reads / sample');
        setSampleType('Soil');
      } else if (tplId === 'kapa') {
        setServiceType('Transcriptome Sequencing');
        setPlatform('Illumina Novaseq 6000');
        setReadLength('2 X 150 bp PE');
        setDataOutput('~8-10GB / Sample');
        setSampleType('Leaf');
      } else if (tplId === 'bacteria') {
        setServiceType('Transcriptome Sequencing');
        setPlatform('Illumina Novaseq 6000');
        setReadLength('2 X 150 bp PE');
        setDataOutput('~06-08GB / Sample');
        setSampleType('Bacteria');
      } else if (tplId === 'hmr') {
        setServiceType('Transcriptome Sequencing');
        setPlatform('Illumina Novaseq X Plus');
        setReadLength('2 X 150 bp PE');
        setDataOutput('~08-09GB / Sample');
        setSampleType('Tissue');
      }
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

  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mappingData, setMappingData] = useState<string[][]>([]);
  const [mappingHeaders, setMappingHeaders] = useState<string[]>([]);
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [sampleIdIndex, setSampleIdIndex] = useState<number>(-1);
  const [concIndex, setConcIndex] = useState<number>(-1);
  const [volIndex, setVolIndex] = useState<number>(-1);
  const [yieldIndex, setYieldIndex] = useState<number>(-1);
  const [remarksIndex, setRemarksIndex] = useState<number>(-1);

  const [isWebMode, setIsWebMode] = useState(false);

  useEffect(() => {
    const checkApi = async () => {
      setIsWebMode(false);
    };
    checkApi();
  }, []);

  const availableImages = Array.from(new Set([
    ...(scanResult?.imageFiles || []),
    ...(detectedImages.gel || []),
    ...(detectedImages.tapestation || []),
    ...tapestationImages.map(img => img.src),
    ...(selectedGelImage ? [selectedGelImage] : [])
  ])).filter(Boolean);

  const resolveImageSrc = (src: string) => {
    if (!src) return '';
    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')) {
      return src;
    }
    return `/api/file?path=${encodeURIComponent(src)}`;
  };

  const prepareMapping = (rowsGrid: string[][]) => {
    if (rowsGrid.length === 0) {
      showToast('No data found to import', 'error');
      return;
    }
    const cleanedGrid = rowsGrid.filter(row => row && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''));
    if (cleanedGrid.length === 0) {
      showToast('No data rows found', 'error');
      return;
    }

    const headers = firstRowIsHeader
      ? cleanedGrid[0].map((h, i) => String(h || '').trim() || `Column ${i + 1}`)
      : cleanedGrid[0].map((_, i) => `Column ${i + 1}`);

    setMappingHeaders(headers);
    setMappingData(cleanedGrid);

    let sIdx = -1;
    let cIdx = -1;
    let vIdx = -1;
    let yIdx = -1;
    let rIdx = -1;

    headers.forEach((h, idx) => {
      const norm = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (['sample', 'sampleid', 'id', 'name', 'samplename', 'pool', 'poolid'].some(kw => norm.includes(kw))) {
        if (sIdx === -1) sIdx = idx;
      }
      else if (['conc', 'concentration', 'ngul', 'qubit', 'quant', 'value'].some(kw => norm.includes(kw))) {
        if (cIdx === -1) cIdx = idx;
      }
      else if (['vol', 'volume', 'ul'].some(kw => norm.includes(kw))) {
        if (vIdx === -1) vIdx = idx;
      }
      else if (['yield', 'ug', 'yieldval'].some(kw => norm.includes(kw))) {
        if (yIdx === -1) yIdx = idx;
      }
      else if (['remark', 'remarks', 'note', 'notes', 'comment', 'comments', 'qc'].some(kw => norm.includes(kw))) {
        if (rIdx === -1) rIdx = idx;
      }
    });

    if (sIdx === -1 && headers.length > 0) sIdx = 0;
    if (cIdx === -1 && headers.length > 1) cIdx = 1;
    if (vIdx === -1 && headers.length > 2) vIdx = 2;
    if (yIdx === -1 && headers.length > 3) yIdx = 3;
    if (rIdx === -1 && headers.length > 4) rIdx = 4;

    setSampleIdIndex(sIdx);
    setConcIndex(cIdx);
    setVolIndex(vIdx);
    setYieldIndex(yIdx);
    setRemarksIndex(rIdx);

    setShowMappingModal(true);
  };

  const confirmMapping = () => {
    const dataRows = firstRowIsHeader ? mappingData.slice(1) : mappingData;

    const parsed: QubitRow[] = dataRows.map((row) => {
      const sample_id = sampleIdIndex !== -1 && row[sampleIdIndex] ? String(row[sampleIdIndex]).trim() : 'Unknown';
      const conc = concIndex !== -1 && row[concIndex] ? String(row[concIndex]).trim() : '0';
      const vol = volIndex !== -1 && row[volIndex] ? String(row[volIndex]).trim() : '0';
      const yieldVal = yieldIndex !== -1 && row[yieldIndex] ? String(row[yieldIndex]).trim() : '0';
      const remarks = remarksIndex !== -1 && row[remarksIndex] ? String(row[remarksIndex]).trim() : '';
      const qc_status = parseFloat(conc) > 20 ? 'PASS' : parseFloat(conc) > 5 ? 'WARN' : 'FAIL';

      return {
        sample_id,
        conc,
        vol,
        yield: yieldVal,
        remarks,
        qc_status
      };
    }).filter(r => r.sample_id && r.sample_id !== 'Unknown');

    if (parsed.length > 0) {
      setQubitData(parsed);
      setLibrarySizes(parsed.map(() => 350));
      showToast(`Successfully imported ${parsed.length} samples with custom mapping!`, 'success');
      setShowMappingModal(false);
      setShowPasteModal(false);
    } else {
      showToast('No valid samples could be imported with the current mapping', 'error');
    }
  };

  const parseQubitExcelClient = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
        prepareMapping(rawRows);
      } catch (err: any) {
        showToast('Error parsing Excel: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const parseLaneMapExcelClient = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

        const parsedLanes: LaneRow[] = [];
        for (const row of rawRows) {
          const keys = Object.keys(row);
          const laneKeys = keys.filter(k => k.toLowerCase().includes('lane')).sort();
          const sampleKeys = keys.filter(k => k.toLowerCase().includes('sample') || k.toLowerCase().includes('name')).sort();

          const pairsCount = Math.min(laneKeys.length, sampleKeys.length);
          for (let i = 0; i < pairsCount; i++) {
            const laneVal = row[laneKeys[i]];
            const sampleVal = row[sampleKeys[i]];
            if (laneVal !== undefined && laneVal !== null && laneVal !== '') {
              parsedLanes.push({
                lane: String(laneVal).trim(),
                sample: sampleVal ? String(sampleVal).trim() : ''
              });
            }
          }
        }

        parsedLanes.sort((a, b) => {
          const na = parseInt(a.lane, 10);
          const nb = parseInt(b.lane, 10);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a.lane.localeCompare(b.lane);
        });

        if (parsedLanes.length > 0) {
          setLanes(parsedLanes);
          showToast(`Parsed ${parsedLanes.length} lanes from mapping Excel!`, 'success');
        } else {
          showToast('No lanes found in mapping file', 'error');
        }
      } catch (err: any) {
        showToast('Error parsing Lane Map: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleGelImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setSelectedGelImage(dataUrl);
      setDetectedImages(prev => ({
        ...prev,
        gel: [...prev.gel.filter(x => !x.startsWith('data:')), dataUrl]
      }));
      showToast('Gel Image uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleTapeStationImagesUpload = (files: FileList) => {
    const fileArray = Array.from(files);
    let loadedCount = 0;
    const newImages: TapeStationImage[] = [];
    const imagePaths: string[] = [];

    fileArray.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        imagePaths.push(dataUrl);

        const sampleId = qubitData[idx]?.sample_id || `Sample_${idx + 1}`;
        newImages.push({
          sample_id: sampleId,
          src: dataUrl
        });

        loadedCount++;
        if (loadedCount === fileArray.length) {
          setTapestationImages(prev => {
            const existing = [...prev];
            newImages.forEach(newImg => {
              const index = existing.findIndex(e => e.sample_id === newImg.sample_id);
              if (index > -1) {
                existing[index] = newImg;
              } else {
                existing.push(newImg);
              }
            });
            return existing;
          });

          setDetectedImages(prev => ({
            ...prev,
            tapestation: [...prev.tapestation.filter(x => !x.startsWith('data:')), ...imagePaths]
          }));
          showToast(`Uploaded ${loadedCount} TapeStation images!`, 'success');
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = (file: File, type: 'logo' | 'unipath') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (type === 'logo') {
        setLogoPath(dataUrl);
      } else {
        setUnipathLogoPath(dataUrl);
      }
      showToast('Logo uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const initializeWebEmptyProject = () => {
    setProjectId('NGS-WEB-PROJECT');
    setSubmittedTo('Dr. Amit Gupta');
    setInstitution('Unigenome Web Lab');
    setReportDate(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));

    setQubitData([
      { sample_id: 'S1', conc: '25.4', vol: '15', yield: '0.38', remarks: 'Good Quality', qc_status: 'PASS' },
      { sample_id: 'S2', conc: '18.1', vol: '15', yield: '0.27', remarks: 'Low Conc', qc_status: 'WARN' },
      { sample_id: 'S3', conc: '32.0', vol: '15', yield: '0.48', remarks: 'Good Quality', qc_status: 'PASS' }
    ]);

    setLanes([
      { lane: '1', sample: 'S1' },
      { lane: '2', sample: 'S2' },
      { lane: '3', sample: 'S3' }
    ]);

    setScanResult({
      success: true,
      imageFiles: []
    });

    showToast('Workspace initialized!', 'success');
  };

  const loadWebDemoData = () => {
    setProjectId('NGS-COMP-2026');
    setSubmittedTo('Dr. Sarah Jenkins');
    setInstitution('Institute of Genomics & Biotech');
    setReportDate(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
    setServiceType('Transcriptome Sequencing');
    setPlatform('Illumina Novaseq X Plus');
    setReadLength('2 X 150 PE');
    setDataOutput('~06GB / Sample');
    setSampleType('Leaf / Arabidopsis');
    setShippingCondition('Dry Ice');

    setQubitData([
      { sample_id: 'WT_Rep1', conc: '45.2', vol: '20', yield: '0.90', remarks: 'High Quality', qc_status: 'PASS' },
      { sample_id: 'WT_Rep2', conc: '38.8', vol: '20', yield: '0.78', remarks: 'High Quality', qc_status: 'PASS' },
      { sample_id: 'KO_Rep1', conc: '22.4', vol: '20', yield: '0.45', remarks: 'Acceptable', qc_status: 'PASS' },
      { sample_id: 'KO_Rep2', conc: '14.5', vol: '20', yield: '0.29', remarks: 'Low Concentration', qc_status: 'WARN' },
      { sample_id: 'KO_Rep3', conc: '4.8', vol: '20', yield: '0.10', remarks: 'Failed QC', qc_status: 'FAIL' }
    ]);

    setLanes([
      { lane: '1', sample: 'WT_Rep1' },
      { lane: '2', sample: 'WT_Rep2' },
      { lane: '3', sample: 'KO_Rep1' },
      { lane: '4', sample: 'KO_Rep2' },
      { lane: '5', sample: 'KO_Rep3' }
    ]);

    const mockGelSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><rect width="100%" height="100%" fill="%23111"/><text x="20" y="30" fill="%23fff" font-family="monospace" font-size="12">M  1  2  3  4  5</text><line x1="20" y1="50" x2="380" y2="50" stroke="%23333" stroke-width="2"/><line x1="25" y1="60" x2="35" y2="60" stroke="%2388f" stroke-width="4" opacity="0.8"/><line x1="55" y1="80" x2="65" y2="80" stroke="%238f8" stroke-width="6"/><line x1="85" y1="83" x2="95" y2="83" stroke="%238f8" stroke-width="6"/><line x1="115" y1="90" x2="125" y2="90" stroke="%238f8" stroke-width="4"/><line x1="145" y1="100" x2="155" y2="100" stroke="%238f8" stroke-width="4"/><line x1="175" y1="130" x2="185" y2="130" stroke="%23f88" stroke-width="2"/></svg>';
    const mockTS1 = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150"><rect width="100%" height="100%" fill="%23fff" stroke="%23ccc"/><path d="M10 130 Q 80 130 150 50 T 290 130" fill="none" stroke="%231e3a8a" stroke-width="3"/><text x="110" y="30" fill="%231e3a8a" font-family="sans-serif" font-size="12" font-weight="bold">Peak: 450 bp</text></svg>';

    setSelectedGelImage(mockGelSvg);
    setTapestationImages([
      { sample_id: 'WT_Rep1', src: mockTS1 },
      { sample_id: 'WT_Rep2', src: mockTS1 },
      { sample_id: 'KO_Rep1', src: mockTS1 }
    ]);

    setDetectedImages({
      rnaQc: [],
      tapestation: [mockTS1],
      bioanalyzer: [],
      gel: [mockGelSvg],
      qubit: []
    });

    setScanResult({
      success: true,
      imageFiles: [mockGelSvg, mockTS1]
    });

    showToast('Loaded demo project data successfully!', 'success');
  };

  const handleBrowserPrint = () => {
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      showToast('Could not find report preview iframe to print', 'error');
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('ngs_project_path');
    if (saved) {
      setProjectPath(saved);
    }
  }, []);

  useEffect(() => {
    // Auto-fill sample count from qubit data rows, but only if we actually have rows
    if (qubitData.length > 0) {
      setNoOfSamples(String(qubitData.length));
      setNoOfLibrariesPrepared(String(qubitData.length));

      // Automatically align tapestation images with qubitData sample IDs in sequence
      setTapestationImages(prev => {
        const hasExistingValid = prev.some(p => qubitData.some(q => q.sample_id === p.sample_id));
        if (hasExistingValid) {
          // Re-map to match the current qubitData order, preserving manual selections if they exist.
          return qubitData.map((row, idx) => {
            const existing = prev.find(p => p.sample_id === row.sample_id);
            if (existing) return existing;
            // Otherwise fallback to detected image at this index
            const src = detectedImages.tapestation[idx] || '';
            return { sample_id: row.sample_id, src };
          });
        }

        if (detectedImages.tapestation && detectedImages.tapestation.length > 0) {
          return qubitData.map((row, idx) => ({
            sample_id: row.sample_id,
            src: detectedImages.tapestation[idx] || ''
          }));
        }
        return prev;
      });
    }
  }, [qubitData, detectedImages.tapestation]);

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

  const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });

  const getFilesFromEntry = async (entry: any): Promise<File[]> => {
    const files: File[] = [];
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
      (file as any).customRelativePath = entry.fullPath.substring(1);
      files.push(file);
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readAllEntries = async (): Promise<any[]> => {
        const allEntries: any[] = [];
        const read = async () => {
          const batch = await new Promise<any[]>((resolve, reject) => dirReader.readEntries(resolve, reject));
          if (batch.length > 0) {
            allEntries.push(...batch);
            await read();
          }
        };
        await read();
        return allEntries;
      };
      const entries = await readAllEntries();
      for (const childEntry of entries) {
        const childFiles = await getFilesFromEntry(childEntry);
        files.push(...childFiles);
      }
    }
    return files;
  };

  const uploadAndProcessFiles = async (files: File[]) => {
    setLoading(true);
    try {
      const ALLOWED_EXT = /\.(xlsx|xls|csv|png|jpg|jpeg|docx|txt|json)$/i;
      const relevantFiles = files.filter(f => ALLOWED_EXT.test(f.name) && f.size < 15 * 1024 * 1024);

      if (relevantFiles.length === 0) {
        showToast('No relevant QC, Excel, or Notes files found in selected folder', 'error');
        setLoading(false);
        return;
      }

      const payloadFiles = await Promise.all(relevantFiles.map(async f => {
        const content = await toBase64(f);
        return {
          name: f.name,
          path: (f as any).customRelativePath || f.webkitRelativePath || f.name,
          content
        };
      }));

      const response = await fetch('/api/upload-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: payloadFiles })
      });
      const res = await response.json();
      if (res.success) {
        setProjectPath(res.projectPath);
        setScanResult(res.scanResult);
        setLogoPath(res.scanResult.logoPath || '');
        setUnipathLogoPath(res.scanResult.unipathLogoPath || '');

        // Populate metadata
        const data = res.scanResult.wetLabData.project_id ? res.scanResult.wetLabData : res.scanResult.metadata;
        setProjectId(data.project_id || res.scanResult.metadata.project_id || 'Project');
        setSubmittedTo(data.submitted_to || 'Dr. Amit Gupta');
        setRefGenomeLink(data.ref_genome_link || res.scanResult.metadata.ref_genome_link || 'https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/405/GCF_000001405.40_GRCh38.p14/');
        setInstitution(data.client_org || res.scanResult.metadata.client_org || data.institution || 'Unigenome Bioinformatics Lab');
        setReportDate(data.report_date || reportDate);
        setServiceType(data.service_type || serviceType);
        setPlatform(data.platform || platform);
        setReadLength(data.read_length || readLength);
        setDataOutput(data.data_throughput || dataOutput);
        setSampleType(data.sample_type || 'Leaf');
        setShippingCondition(data.shipping_condition || 'Dry Ice');

        const resolvedSamplesVal = data.no_of_samples || String(data.sample_count || '0');
        if (resolvedSamplesVal !== '0') {
          setNoOfSamples(resolvedSamplesVal);
        }
        const resolvedLibsVal = data.no_of_libraries_prepared || data.no_of_samples || String(data.sample_count || '0');
        if (resolvedLibsVal !== '0') {
          setNoOfLibrariesPrepared(resolvedLibsVal);
        }

        // Auto-classify images using shared helper (gel first A-Z, then tape A-Z)
        const allImages = res.scanResult.imageFiles || [];
        const classified = classifyAndOrderImages(allImages);
        setDetectedImages({
          rnaQc: classified.rnaQc,
          tapestation: classified.tapestation,
          bioanalyzer: classified.bioanalyzer,
          gel: classified.gel,
          qubit: classified.qubit
        });

        // Parse Qubit — prefer exact-named qubit file from server, then client-side pick
        const allExcel = res.scanResult.excelFiles || [];
        const bestQubitFiles = res.scanResult.qubitFiles?.length > 0
          ? res.scanResult.qubitFiles
          : pickQubitFile(allExcel);
        if (bestQubitFiles.length > 0) {
          parseQubitExcel(bestQubitFiles[0]);
        } else if (data.qubit_data && data.qubit_data.length > 0) {
          setQubitData(data.qubit_data);
        }

        // Parse Lane Map — prefer exact-named lane file from server, then client-side pick
        const bestLaneFiles = res.scanResult.laneMapFiles?.length > 0
          ? res.scanResult.laneMapFiles
          : pickLaneFile(allExcel);
        if (data.lane_mapping && data.lane_mapping.rows && data.lane_mapping.rows.length > 0) {
          const rows = data.lane_mapping.rows || [];
          const flattedLanes: LaneRow[] = [];
          rows.forEach((r: string[]) => { for (let i = 0; i < r.length; i += 2) { if (r[i]) flattedLanes.push({ lane: r[i], sample: r[i + 1] || '' }); } });
          setLanes(flattedLanes);
        } else if (bestLaneFiles.length > 0) {
          parseLaneMapExcel(bestLaneFiles[0]);
        }

        // Auto Gel Image (first gel image, already A-Z sorted)
        const serverGel = res.scanResult.gelImages;
        if (serverGel && serverGel.length > 0) {
          setSelectedGelImage(serverGel[0]);
        } else if (classified.gel.length > 0) {
          setSelectedGelImage(classified.gel[0]);
        }

        // TapeStation images (A-Z sorted)
        if (data.tapestation_images) {
          setTapestationImages(data.tapestation_images);
        } else {
          const tapeSrcs = (res.scanResult.tapestationImages && res.scanResult.tapestationImages.length > 0)
            ? res.scanResult.tapestationImages
            : classified.tapestation;
          if (tapeSrcs.length > 0) {
            const samples = data.samples || [];
            setTapestationImages(tapeSrcs.map((src: string, i: number) => ({
              sample_id: samples[i] || `Sample_${i + 1}`,
              src
            })));
          }
        }

        showToast('Project folder uploaded and parsed successfully!', 'success');
      } else {
        showToast(res.error || 'Failed to upload folder', 'error');
      }
    } catch (err: any) {
      showToast('Upload error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const ALLOWED_EXT = /\.(xlsx|xls|csv|png|jpg|jpeg|docx|txt|json)$/i;
      const relevantFiles = files.filter(f => ALLOWED_EXT.test(f.name) && f.size < 15 * 1024 * 1024);

      if (relevantFiles.length === 0) {
        showToast('No relevant QC, Excel, or Notes files found in selected folder', 'error');
        return;
      }
      setSelectedFiles(relevantFiles);
      const firstFile = relevantFiles[0];
      const pathPart = firstFile.webkitRelativePath || firstFile.name;
      const folderName = pathPart.split(/[\\/]/)[0] || 'Selected Folder';
      setProjectPath(folderName);
    }
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleSelectBrowserFolder = () => {
    setProjectPath(browserPath);
    setShowFolderBrowser(false);
    handleScanFromPath(browserPath);
  };

  const handleScan = async () => {
    if (selectedFiles.length > 0) {
      await uploadAndProcessFiles(selectedFiles);
    } else {
      if (!projectPath.trim()) {
        showToast('Please specify a project folder path or select a folder first', 'error');
        return;
      }
      await handleScanFromPath(projectPath.trim());
    }
  };

  const handleScanFromPath = async (path: string) => {
    setLoading(true);

    // Reset all project-specific states to default values before scanning new folder
    setProjectId('');
    setSubmittedTo('Dr. Amit Gupta');
    setRefGenomeLink('https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/405/GCF_000001405.40_GRCh38.p14/');
    setInstitution('Unigenome Bioinformatics Lab');
    setReportDate(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
    setServiceType('Transcriptome Sequencing');
    setPlatform('Illumina Novaseq X Plus');
    setReadLength('2 X 150 PE');
    setNoOfSamples('0');
    setNoOfLibrariesPrepared('0');
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
      setSubmittedTo(data.submitted_to || 'Dr. Amit Gupta');
      setRefGenomeLink(data.ref_genome_link || res.metadata.ref_genome_link || 'https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/405/GCF_000001405.40_GRCh38.p14/');

      // Fixed: Support client_org mapping to Institution form field
      setInstitution(data.client_org || res.metadata.client_org || data.institution || 'Unigenome Bioinformatics Lab');

      setReportDate(data.report_date || reportDate);
      setServiceType(data.service_type || serviceType);
      setPlatform(data.platform || platform);
      setReadLength(data.read_length || readLength);
      setDataOutput(data.data_throughput || dataOutput);
      setSampleType(data.sample_type || 'Leaf');
      setShippingCondition(data.shipping_condition || 'Dry Ice');

      const resolvedSamplesVal = data.no_of_samples || String(data.sample_count || '0');
      if (resolvedSamplesVal !== '0') {
        setNoOfSamples(resolvedSamplesVal);
      }
      const resolvedLibsVal = data.no_of_libraries_prepared || data.no_of_samples || String(data.sample_count || '0');
      if (resolvedLibsVal !== '0') {
        setNoOfLibrariesPrepared(resolvedLibsVal);
      }

      // Auto-classify all found images using shared helper (gel first A-Z, then tape A-Z)
      const allImages = res.imageFiles || [];
      const classified = classifyAndOrderImages(allImages);
      setDetectedImages({
        rnaQc: classified.rnaQc,
        tapestation: classified.tapestation,
        bioanalyzer: classified.bioanalyzer,
        gel: classified.gel,
        qubit: classified.qubit
      });

      // Parse Qubit — prefer exact-named qubit file, then client-side pick
      const allExcel = res.excelFiles || [];
      const bestQubitFiles = res.qubitFiles?.length > 0 ? res.qubitFiles : pickQubitFile(allExcel);
      if (bestQubitFiles.length > 0) {
        parseQubitExcel(bestQubitFiles[0]);
      } else if (data.qubit_data && data.qubit_data.length > 0) {
        setQubitData(data.qubit_data);
      }

      // Parse Lane Map — prefer exact-named lane file, then client-side pick
      const bestLaneFiles = res.laneMapFiles?.length > 0 ? res.laneMapFiles : pickLaneFile(allExcel);
      if (data.lane_mapping && data.lane_mapping.rows && data.lane_mapping.rows.length > 0) {
        const rows = data.lane_mapping.rows || [];
        const flattedLanes: LaneRow[] = [];
        rows.forEach((r: string[]) => { for (let i = 0; i < r.length; i += 2) { if (r[i]) flattedLanes.push({ lane: r[i], sample: r[i + 1] || '' }); } });
        setLanes(flattedLanes);
      } else if (bestLaneFiles.length > 0) {
        parseLaneMapExcel(bestLaneFiles[0]);
      }

      // Auto Gel Image (first gel image, already A-Z sorted)
      if (res.gelImages && res.gelImages.length > 0) {
        setSelectedGelImage(res.gelImages[0]);
      } else if (classified.gel.length > 0) {
        setSelectedGelImage(classified.gel[0]);
      }

      // TapeStation images (A-Z sorted)
      if (data.tapestation_images) {
        setTapestationImages(data.tapestation_images);
      } else {
        const tapeSrcs = (res.tapestationImages && res.tapestationImages.length > 0)
          ? res.tapestationImages
          : classified.tapestation;
        if (tapeSrcs.length > 0) {
          const samples = data.samples || [];
          setTapestationImages(tapeSrcs.map((src: string, i: number) => ({
            sample_id: samples[i] || `Sample_${i + 1}`,
            src
          })));
        }
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) {
          const entryFiles = await getFilesFromEntry(entry);
          files.push(...entryFiles);
        }
      }
      if (files.length > 0) {
        const ALLOWED_EXT = /\.(xlsx|xls|csv|png|jpg|jpeg|docx|txt|json)$/i;
        const relevantFiles = files.filter(f => ALLOWED_EXT.test(f.name) && f.size < 15 * 1024 * 1024);

        if (relevantFiles.length === 0) {
          showToast('No relevant QC, Excel, or Notes files found in selected folder', 'error');
          return;
        }
        setSelectedFiles(relevantFiles);
        const firstFile = relevantFiles[0];
        const pathPart = (firstFile as any).customRelativePath || firstFile.webkitRelativePath || firstFile.name;
        const folderName = pathPart.split(/[\\/]/)[0] || 'Selected Folder';
        setProjectPath(folderName);
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

  const handleAddLaneRow = () => {
    setLanes([...lanes, { lane: String(lanes.length + 1), sample: '' }]);
  };

  const handleUpdateLaneRow = (idx: number, field: keyof LaneRow, value: string) => {
    const updated = [...lanes];
    updated[idx] = { ...updated[idx], [field]: value };
    setLanes(updated);
  };

  const handleRemoveLaneRow = (idx: number) => {
    setLanes(lanes.filter((_, i) => i !== idx));
  };

  const handleExcelPaste = () => {
    if (!excelPasteText.trim()) return;
    const lines = excelPasteText.trim().split('\n');
    const grid = lines.map(line => line.split('\t').map(cell => cell.trim()));
    prepareMapping(grid);
  };

  // CSV Import / Export
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      const grid = lines.map(line => {
        return line.split(',').map(cell => cell.replace(/^["']|["']$/g, '').trim());
      });
      prepareMapping(grid);
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
  const triggerGenerate = async (type: 'interim' | 'comprehensive', format: 'pdf' | 'docx' | 'html') => {
    if (!projectPath) {
      showToast('Please scan or select a project directory first', 'error');
      return;
    }

    const buttonKey = format === 'docx'
      ? (type === 'interim' ? 'interim_docx' : 'comprehensive_docx')
      : type;
    setGeneratingButton(buttonKey);
    setGenerationSuccess(false);

    try {
      const payload = {
        project_id: projectId,
        report_date: reportDate,
        client_name: submittedTo,
        submitted_to: submittedTo,
        ref_genome_link: refGenomeLink,
        client_org: institution, // Maps to client_org in EJS and parsed json backend
        service_type: serviceType,
        platform: platform,
        read_length: readLength,
        no_of_samples: noOfSamples,
        no_of_libraries_prepared: noOfLibrariesPrepared,
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
          reportType: finalType,
          formats: format === 'docx' ? ['docx'] : ['html', 'pdf']
        })
      });
      const res = await response.json();
      if (res.success) {
        setGenerationSuccess(true);
        // Store downloadable file links for web-upload mode
        if (res.isWebUpload && res.files) {
          setDownloadableFiles(res.files);
        } else {
          setDownloadableFiles([]);
        }
        if (!res.isWebUpload) {
          showToast(`Successfully generated report in deliverables directory!`, 'success');
        } else {
          showToast(`Report ready — click the download buttons below!`, 'success');
        }
        setTimeout(() => {
          setGenerationSuccess(false);
          setGeneratingButton(null);
          // Keep downloadableFiles visible so user can still download
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

  const downloadWetLabJson = () => {
    const payload = {
      project_id: projectId,
      report_date: reportDate,
      client_name: submittedTo,
      submitted_to: submittedTo,
      ref_genome_link: refGenomeLink,
      client_org: institution,
      service_type: serviceType,
      platform: platform,
      read_length: readLength,
      no_of_samples: noOfSamples,
      no_of_libraries_prepared: noOfLibrariesPrepared,
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
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${projectId || 'project'}_wet_lab_data.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Downloaded wet_lab_data.json successfully!', 'success');
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
            <img src="${logoPath ? resolveImageSrc(logoPath) : ''}" style="max-height: 45px; max-width: 180px; object-fit: contain;" />
            <img src="${unipathLogoPath ? resolveImageSrc(unipathLogoPath) : ''}" style="max-height: 45px; max-width: 180px; object-fit: contain;" />
          </div>
          <div style="text-align: center; padding-top: 40px;">
            <div style="font-size: 14px; text-transform: uppercase; font-weight: bold; color: #64748b; tracking: 0.1em;">Interim Quality Control & Sequencing Report</div>
            <div class="title">${projectId || 'NGS PROJECT REPORT'}</div>
            <div class="subtitle">${serviceType}</div>
            
            <div style="margin-top: 80px; font-size: 14px; line-height: 1.8;">
              <div><strong>Submitted To:</strong> ${submittedTo || 'N/A'}</div>
              <div><strong>Institution:</strong> ${institution || 'N/A'}</div>
              <div><strong>Date:</strong> ${reportDate}</div>
              <div><strong>Platform:</strong> ${platform}</div>
            </div>

            <div style="margin-top: 120px; font-size: 12px; color: #64748b;">
              Submitted by: Unigenome Biotech
            </div>
          </div>
        `;
      } else if (page.type === 'project') {
        html += `
          <h2>1. Project Specifications</h2>
          <table style="margin-top: 24px;">
            <tr><td><strong>Project ID</strong></td><td>${projectId || 'N/A'}</td></tr>
            <tr><td><strong>Submitted To</strong></td><td>${submittedTo || 'N/A'}</td></tr>
            <tr><td><strong>Institution</strong></td><td>${institution || 'N/A'}</td></tr>
            <tr><td><strong>Service Type</strong></td><td>${serviceType}</td></tr>
            <tr><td><strong>Platform</strong></td><td>${platform}</td></tr>
            <tr><td><strong>Read Length</strong></td><td>${readLength}</td></tr>
            <tr><td><strong>No. of Samples</strong></td><td>${noOfSamples}</td></tr>
            <tr><td><strong>No. of Libraries Prepared</strong></td><td>${noOfLibrariesPrepared}</td></tr>
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
            `<img src="${resolveImageSrc(selectedGelImage)}" style="max-height: 100%; max-width: 100%; object-fit: contain;"/>` :
            `<span style="color: #94a3b8; font-size: 12px;">[ Agarose Gel QC Image Not Loaded ]</span>`
          }
          </div>
          <div style="font-size: 11px; text-align: center; font-style: italic; color: #64748b; margin-bottom: 20px;">Figure 3.1: 1% Agarose Gel profile of experimental RNA samples.</div>
          ${lanes && lanes.length > 0 ? `
          <div style="margin-top: 20px; overflow-x: auto;">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 8px; color: #1e3a8a;">Lane ID to Sample Name Mapping</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead>
                <tr>
                  <th>Lane id</th><th>Sample name</th>
                  <th>Lane id</th><th>Sample name</th>
                  <th>Lane id</th><th>Sample name</th>
                </tr>
              </thead>
              <tbody>
                ${Array.from({ length: Math.ceil(lanes.length / 3) }).map((_, rIdx) => {
            let rowHtml = '<tr>';
            for (let i = 0; i < 3; i++) {
              const item = lanes[rIdx * 3 + i];
              rowHtml += `<td>${item ? item.lane : ''}</td><td>${item ? item.sample : ''}</td>`;
            }
            rowHtml += '</tr>';
            return rowHtml;
          }).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
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
                  <img src="${resolveImageSrc(img.src)}" style="max-height: 100%; max-width: 100%; object-fit: contain;"/>
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
            <div className={`px-4 py-3 rounded-lg shadow-lg border text-sm font-semibold flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                  'bg-sky-50 border-sky-200 text-sky-800'
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
            {isWebMode ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Web Mode Active
              </div>
            ) : (
              <p className="text-xs text-slate-400">Select a project deliverables folder containing raw QC and quantification files.</p>
            )}
          </div>

          {isWebMode ? (
            <div className="space-y-4 pt-2">
              <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-4 text-center space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  You are running in <strong>Web Mode</strong> (standalone deployment). You can initialize an empty report workspace or load pre-built demo data instantly to test the application.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={initializeWebEmptyProject}
                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    Start Empty Project
                  </button>
                  <button
                    onClick={loadWebDemoData}
                    className="bg-sky-50 hover:bg-sky-100 border border-sky-100 text-sky-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    Load Demo Data
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Or Upload Qubit Excel Sheet</label>
                <label className="border border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition">
                  <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4"></path></svg>
                  <span className="text-xs font-semibold text-slate-600">Select Qubit Excel file</span>
                  <span className="text-[10px] text-slate-400 mt-1">Direct client-side spreadsheet parse</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setProjectId(file.name.replace(/\.[^/.]+$/, ''));
                        initializeWebEmptyProject();
                        parseQubitExcelClient(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          ) : (
            <>
              {/* Large Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition text-center min-h-[16rem] ${dragOver ? 'border-sky-500 bg-sky-50/50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                  } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="file"
                  webkitdirectory="true"
                  directory="true"
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  ref={fileInputRef}
                  onChange={handleDirectorySelect}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  disabled={loading}
                  title=""
                />

                {selectedFiles.length > 0 ? (
                  <div className="space-y-3 pointer-events-none">
                    <svg className="w-12 h-12 text-emerald-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 01-18 0z" />
                    </svg>
                    <span className="block text-sm font-bold text-slate-800">Folder Selected Successfully</span>
                    <span className="block text-xs text-slate-500 font-mono bg-slate-100 border border-slate-200 px-2 py-1.5 rounded-lg inline-block">
                      {projectPath}
                    </span>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      {selectedFiles.length} files matched ({selectedFiles.filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')).length} spreadsheets, {selectedFiles.filter(f => f.name.match(/\.(png|jpg|jpeg)$/i)).length} images)
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setSelectedFiles([]);
                        setProjectPath('');
                      }}
                      className="pointer-events-auto text-xs text-red-500 hover:text-red-700 font-bold hover:underline"
                    >
                      Clear Selection
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 pointer-events-none">
                    <svg className="w-12 h-12 text-sky-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="block text-sm font-bold text-slate-800">Drag & Drop Project Folder Here or Click to Browse</span>
                    <span className="block text-xs text-slate-400">Select the deliverables folder containing raw QC and quantification files</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Or Paste Path Manually</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. C:\Users\Lab\Deliverables_260046"
                      value={selectedFiles.length > 0 ? '' : projectPath}
                      disabled={selectedFiles.length > 0 || loading}
                      onChange={(e) => setProjectPath(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-sky-500 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={handleBrowse}
                      disabled={loading}
                      className="bg-slate-100 hover:bg-slate-200 active:scale-[0.98] border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 disabled:opacity-50"
                    >
                      Browse Folder
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleScan}
                  disabled={loading || (!projectPath.trim() && selectedFiles.length === 0)}
                  className="w-full bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white font-bold py-2.5 rounded-lg text-xs transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {selectedFiles.length > 0 ? 'Uploading & Processing Folder...' : 'Scanning & Auto-Mapping...'}
                    </>
                  ) : selectedFiles.length > 0 ? 'Upload & Initialize Workspace' : 'Initialize Workspace'}
                </button>
              </div>
            </>
          )}
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
          <div className={`px-4 py-3 rounded-lg shadow-lg border text-sm font-semibold flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
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
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 transform transition-transform duration-300 md:translate-x-0 md:static ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
          <div className="p-6 border-b border-slate-100 flex items-center justify-between relative">
            <div className="flex items-center justify-center w-full">
              <img
                src={logoPath ? resolveImageSrc(logoPath) : ''}
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
                  className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold transition-all border-l-4 ${activeTab === tab
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
                Active Project: <span className="font-mono text-slate-800">{projectId || (isWebMode ? 'Web Workspace' : 'None')}</span>
              </span>
            </div>
            <div className="flex gap-2">
              {isWebMode ? (
                <label className="bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer shadow-sm">
                  📂 Import Qubit Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) parseQubitExcelClient(file);
                    }}
                  />
                </label>
              ) : (
                <button
                  onClick={handleScan}
                  className="bg-slate-100 hover:bg-slate-200 active:scale-[0.98] border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  Refresh Scan
                </button>
              )}
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
                      <label className="block text-xs font-bold text-slate-500 mb-1">Submitted To</label>
                      <input
                        type="text"
                        value={submittedTo}
                        onChange={(e) => setSubmittedTo(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Reference Genome Link</label>
                      <input
                        type="text"
                        value={refGenomeLink}
                        onChange={(e) => setRefGenomeLink(e.target.value)}
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
                      <label className="block text-xs font-bold text-slate-500 mb-1">Number of Libraries Prepared</label>
                      <input
                        type="text"
                        value={noOfLibrariesPrepared}
                        onChange={(e) => setNoOfLibrariesPrepared(e.target.value)}
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
                    {isWebMode && (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Company/Primary Logo</label>
                          <label className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-center cursor-pointer block">
                            Upload Logo Image
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleLogoUpload(file, 'logo');
                              }}
                            />
                          </label>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Client/Secondary Logo</label>
                          <label className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-center cursor-pointer block">
                            Upload Logo Image
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleLogoUpload(file, 'unipath');
                              }}
                            />
                          </label>
                        </div>
                      </>
                    )}
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
                                className={`rounded text-xs font-semibold px-2 py-0.5 border ${row.qc_status === 'PASS' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
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
                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${useStandardTemplate ? 'bg-sky-600' : 'bg-slate-300'
                          }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${useStandardTemplate ? 'translate-x-6' : 'translate-x-0'
                            }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Template Selection Grid */}
                  <div className="mb-6 bg-slate-50/50 border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200/60 pb-4 mb-5">
                      <div>
                        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">Baseline Template Configurations</h3>
                        <p className="text-[10.5px] text-slate-400 mt-1">Select a workflow standard below to auto-populate report sections.</p>
                      </div>
                      <div className="mt-2 md:mt-0 flex gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                          {STATIC_TEMPLATES.length} Protocols Available
                        </span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* RNA-SEQ SECTION */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">🧬 RNA-Seq Workflows</span>
                          <div className="h-[1px] flex-1 bg-slate-200/60"></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {STATIC_TEMPLATES.filter(t => t.id !== '16s').map((tpl) => (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => applyTemplate(tpl.id as 'kapa' | 'bacteria' | 'hmr' | '16s')}
                              className={`group flex flex-col text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden ${selectedTemplateId === tpl.id
                                  ? 'bg-sky-50/60 border-sky-500 shadow-sm ring-1 ring-sky-500'
                                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                                }`}
                            >
                              {selectedTemplateId === tpl.id && (
                                <div className="absolute top-0 right-0 w-8 h-8 bg-sky-500 text-white rounded-bl-xl flex items-center justify-center text-[10px] font-bold">
                                  ✓
                                </div>
                              )}
                              <div className="flex flex-col mb-2 pr-4">
                                <span className={`text-xs font-bold transition-colors ${selectedTemplateId === tpl.id ? 'text-sky-900' : 'text-slate-800'}`}>
                                  {tpl.name}
                                </span>
                                <span className="inline-block w-max mt-1 px-1.5 py-0.5 rounded bg-sky-100/60 text-sky-700 font-semibold text-[8px] uppercase tracking-wide">
                                  RNA-Seq
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-relaxed mb-4 flex-1">
                                {tpl.description}
                              </p>
                              <div className="border-t border-slate-100/80 pt-3 text-[9px] text-slate-400">
                                <span className="font-bold text-slate-500 block mb-0.5">Kit & Sequencing Specifics:</span>
                                {tpl.diffExplanation}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 16S METAGENOME SECTION */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">🔬 Metagenome Workflows</span>
                          <div className="h-[1px] flex-1 bg-slate-200/60"></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {STATIC_TEMPLATES.filter(t => t.id === '16s').map((tpl) => (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => applyTemplate(tpl.id as 'kapa' | 'bacteria' | 'hmr' | '16s')}
                              className={`group flex flex-col text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden ${selectedTemplateId === tpl.id
                                  ? 'bg-amber-50/60 border-amber-500 shadow-sm ring-1 ring-amber-500'
                                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                                }`}
                            >
                              {selectedTemplateId === tpl.id && (
                                <div className="absolute top-0 right-0 w-8 h-8 bg-amber-500 text-white rounded-bl-xl flex items-center justify-center text-[10px] font-bold">
                                  ✓
                                </div>
                              )}
                              <div className="flex flex-col mb-2 pr-4">
                                <span className={`text-xs font-bold transition-colors ${selectedTemplateId === tpl.id ? 'text-amber-900' : 'text-slate-800'}`}>
                                  {tpl.name}
                                </span>
                                <span className="inline-block w-max mt-1 px-1.5 py-0.5 rounded bg-amber-100/60 text-amber-700 font-semibold text-[8px] uppercase tracking-wide">
                                  16S Metagenome
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-relaxed mb-4 flex-1">
                                {tpl.description}
                              </p>
                              <div className="border-t border-slate-100/80 pt-3 text-[9px] text-slate-400">
                                <span className="font-bold text-slate-500 block mb-0.5">Kit & Sequencing Specifics:</span>
                                {tpl.diffExplanation}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
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
                        <img src={resolveImageSrc(f)} alt="scanned-qc" className="h-16 w-full object-contain bg-white rounded" />
                        <span className="text-[8px] text-slate-400 font-mono truncate w-full text-center mt-1">
                          {f.split(/[\\/]/).pop()?.startsWith('data:') ? `Upload_${idx + 1}` : f.split(/[\\/]/).pop()}
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
                      <div className="flex flex-col gap-2">
                        <select
                          value={selectedGelImage}
                          onChange={(e) => setSelectedGelImage(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-sky-500 focus:outline-none"
                        >
                          <option value="">-- Choose Gel Image --</option>
                          {availableImages.map((f: string) => (
                            <option key={f} value={f}>{getImageLabel(f)}</option>
                          ))}
                        </select>
                        <label className="bg-slate-100 hover:bg-slate-200 active:scale-[0.98] border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-center cursor-pointer block">
                          Upload Custom Gel Image
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleGelImageUpload(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    {selectedGelImage && (
                      <div className="border border-slate-200 rounded-lg p-2 bg-slate-50 flex items-center justify-center h-48 animate-in zoom-in-95 duration-200">
                        <img src={resolveImageSrc(selectedGelImage)} alt="Gel" className="max-h-full max-w-full object-contain" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Gel Lane Mapping Grid */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-in fade-in duration-300">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        RNA Agarose Gel Lane Mapping Grid
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">Associate gel lanes with corresponding experimental samples.</p>
                    </div>
                    <div className="flex gap-2">
                      {isWebMode && (
                        <label className="bg-slate-100 hover:bg-slate-200 active:scale-[0.98] border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer">
                          Import Lane Map Excel
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) parseLaneMapExcelClient(file);
                            }}
                          />
                        </label>
                      )}
                      <button
                        onClick={handleAddLaneRow}
                        className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95"
                      >
                        + Add Lane
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[250px] overflow-y-auto p-1">
                    {lanes.map((lane, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex gap-2 items-center justify-between">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={lane.lane}
                            onChange={(e) => handleUpdateLaneRow(idx, 'lane', e.target.value)}
                            placeholder="Lane"
                            className="bg-white border border-slate-200 text-slate-800 rounded px-2 py-1 text-xs w-10 text-center font-bold"
                          />
                          <input
                            type="text"
                            value={lane.sample}
                            onChange={(e) => handleUpdateLaneRow(idx, 'sample', e.target.value)}
                            placeholder="Sample ID"
                            className="bg-white border border-slate-200 text-slate-800 rounded px-2 py-1 text-xs w-24 font-mono"
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveLaneRow(idx)}
                          className="text-rose-600 hover:text-rose-700 text-xs font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {lanes.length === 0 && (
                      <div className="col-span-full py-4 text-center text-xs text-slate-400">
                        No lane mapping rows defined. Click "+ Add Lane" or upload a mapping file.
                      </div>
                    )}
                  </div>
                </div>

                {/* TapeStation sample assignment */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">TapeStation Sample Assignments</h2>

                  {isWebMode && (
                    <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center shrink-0">
                      <div>
                        <h4 className="text-xs font-bold text-slate-700">Bulk Upload TapeStation Profiles</h4>
                        <p className="text-[10px] text-slate-400">Select multiple profile images. They will be mapped to samples sequentially.</p>
                      </div>
                      <label className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer">
                        Upload Profiles
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files) handleTapeStationImagesUpload(e.target.files);
                          }}
                        />
                      </label>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {qubitData.map((row, idx) => {
                      const assigned = tapestationImages.find(img => img.sample_id === row.sample_id)?.src || '';
                      return (
                        <div key={idx} className="border border-slate-100 rounded-lg p-3 bg-slate-50 flex items-center justify-between gap-4">
                          <span className="font-mono text-xs font-bold text-slate-700">{row.sample_id}</span>
                          <div className="flex-1 flex flex-col gap-1.5">
                            <select
                              value={assigned}
                              onChange={(e) => {
                                setTapestationImages(prev => {
                                  const filter = prev.filter(i => i.sample_id !== row.sample_id);
                                  if (e.target.value) {
                                    filter.push({ sample_id: row.sample_id, src: e.target.value });
                                  }
                                  return filter;
                                });
                              }}
                              className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:border-sky-500 focus:outline-none font-mono"
                            >
                              <option value="">-- No Tape Image --</option>
                              {availableImages.map((f: string) => (
                                <option key={f} value={f}>{getImageLabel(f)}</option>
                              ))}
                            </select>
                            
                            <label className="bg-white hover:bg-slate-100 active:scale-[0.98] border border-slate-200 rounded px-2.5 py-1 text-[10px] font-semibold cursor-pointer text-center block text-slate-600 transition-all">
                              Upload Custom Image
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      const dataUrl = ev.target?.result as string;
                                      setTapestationImages(prev => {
                                        const filter = prev.filter(i => i.sample_id !== row.sample_id);
                                        filter.push({ sample_id: row.sample_id, src: dataUrl });
                                        return filter;
                                      });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                          {assigned && (
                            <img src={resolveImageSrc(assigned)} alt="Tapestation Profile" className="w-12 h-10 object-cover rounded bg-white animate-in fade-in duration-200" />
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
                              className={`w-5 h-5 flex items-center justify-center rounded-full border text-[10px] transition-colors ${page.hidden ? 'bg-slate-200 border-slate-300 text-slate-500' : 'bg-sky-100 border-sky-300 text-sky-700'
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
                <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm max-w-3xl mx-auto text-center space-y-6">
                  <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                    📁
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Generate NGS Reports</h2>
                    <p className="text-xs text-slate-400 mt-2">Generate PDF, HTML, or DOCX formats automatically in target folder.</p>
                  </div>

                  <div className="pt-6 border-t border-slate-100">

                    {isWebMode ? (
                      <div className="space-y-3 max-w-md mx-auto">
                        <button
                          onClick={handleBrowserPrint}
                          className="w-full font-bold py-3 rounded-lg text-xs shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97]"
                        >
                          🖨️ Print / Save Report as PDF
                        </button>
                        <button
                          onClick={() => triggerGenerate('interim', 'docx')}
                          disabled={generatingButton !== null}
                          className={`w-full font-bold py-3 rounded-lg text-xs flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97] ${generatingButton === 'interim_docx'
                              ? 'bg-indigo-400 text-white cursor-wait'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                        >
                          {generatingButton === 'interim_docx' ? (
                            <>
                              {generationSuccess ? (
                                <span className="flex items-center gap-1.5 animate-bounce">✓ DOCX Ready — check downloads below!</span>
                              ) : (
                                <>
                                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  Generating Word DOCX...
                                </>
                              )}
                            </>
                          ) : '📝 Generate & Download DOCX'}
                        </button>
                        <button
                          onClick={downloadWetLabJson}
                          className="w-full font-bold py-3 rounded-lg text-xs shadow-sm bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97]"
                        >
                          📦 Download Wet Lab JSON (for Bioinfo)
                        </button>
                        <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                          Note: Since you are running in Web Mode, PDF report compiling is done directly in your browser. Selecting the print option opens your browser's print utility, allowing you to select "Save as PDF" to download it. DOCX will be available for direct download after generation.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        {/* CARD 1: Interim Report (Wet Lab) */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-6">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xl">🧪</span>
                              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Interim Report (Wet Lab)</h3>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                              Focuses solely on wet lab notes: DNA isolation, library preparation, gel results, Qubit data, and TapeStation library QC charts.
                            </p>
                          </div>

                          <div className="space-y-2">
                            {/* BUTTON 1: Interim PDF */}
                            <button
                              onClick={() => triggerGenerate('interim', 'pdf')}
                              disabled={generatingButton !== null}
                              className={`w-full font-bold py-2.5 rounded-lg text-xs shadow-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97] active:duration-75 ${generatingButton === 'interim'
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
                                      Compiling PDF & HTML...
                                    </>
                                  )}
                                </>
                              ) : 'Generate PDF & HTML'}
                            </button>

                            {/* BUTTON 2: Interim DOCX */}
                            <button
                              onClick={() => triggerGenerate('interim', 'docx')}
                              disabled={generatingButton !== null}
                              className={`w-full font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97] active:duration-75 ${generatingButton === 'interim_docx'
                                  ? 'bg-slate-100 text-slate-400 cursor-wait border border-slate-200'
                                  : 'border border-slate-300 hover:bg-slate-50 text-slate-700 bg-white'
                                }`}
                            >
                              {generatingButton === 'interim_docx' ? (
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
                              ) : 'Generate Word DOCX'}
                            </button>

                            {/* BUTTON 3: Download Wet Lab JSON */}
                            <button
                              onClick={downloadWetLabJson}
                              className="w-full font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97] border border-slate-300 hover:bg-slate-50 text-slate-700 bg-white"
                            >
                              📦 Download JSON (for Bioinfo)
                            </button>
                          </div>
                        </div>

                        {/* CARD 2: Combined/Comprehensive Report */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-6">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xl">📊</span>
                              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Comprehensive Report</h3>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                              Combines the wet lab results with bioinformatic analysis, including raw read sequencing/mapping statistics, pathway enrichment, and differential expression results.
                            </p>
                          </div>

                          <div className="space-y-2">
                            {/* BUTTON 3: Comprehensive PDF */}
                            <button
                              onClick={() => triggerGenerate('comprehensive', 'pdf')}
                              disabled={generatingButton !== null}
                              className={`w-full font-bold py-2.5 rounded-lg text-xs shadow-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97] active:duration-75 ${generatingButton === 'comprehensive'
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
                                      Compiling PDF & HTML...
                                    </>
                                  )}
                                </>
                              ) : 'Generate PDF & HTML'}
                            </button>

                            {/* BUTTON 4: Comprehensive DOCX */}
                            <button
                              onClick={() => triggerGenerate('comprehensive', 'docx')}
                              disabled={generatingButton !== null}
                              className={`w-full font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97] active:duration-75 ${generatingButton === 'comprehensive_docx'
                                  ? 'bg-slate-100 text-slate-400 cursor-wait border border-slate-200'
                                  : 'border border-slate-300 hover:bg-slate-50 text-slate-700 bg-white'
                                }`}
                            >
                              {generatingButton === 'comprehensive_docx' ? (
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
                              ) : 'Generate Word DOCX'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Download panel — shown after generation when running via web/cloudflare tunnel */}
                    {downloadableFiles.length > 0 && downloadableFiles.some(f => f.downloadUrl) && (
                      <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-left max-w-2xl mx-auto">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-emerald-600 text-lg">✅</span>
                          <h3 className="text-sm font-bold text-emerald-800">Report Generated — Download Your Files</h3>
                        </div>
                        <p className="text-[11px] text-emerald-700 mb-4 leading-relaxed">
                          Since you uploaded your folder via the web, the generated files are ready for download. Click each button to save the file to your computer.
                        </p>
                        <div className="space-y-2">
                          {downloadableFiles.filter(f => f.downloadUrl).map((f, idx) => {
                            const ext = f.path.split('.').pop()?.toUpperCase() || 'FILE';
                            const fileName = f.path.split(/[/\\]/).pop() || `report.${ext.toLowerCase()}`;
                            const sizeKb = (f.size / 1024).toFixed(0);
                            const isPdf = ext === 'PDF';
                            const isDocx = ext === 'DOCX';
                            return (
                              <a
                                key={idx}
                                href={f.downloadUrl!}
                                download={fileName}
                                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 hover:opacity-90 active:scale-[0.98] ${isPdf ? 'bg-sky-600 hover:bg-sky-700 text-white' :
                                    isDocx ? 'bg-indigo-600 hover:bg-indigo-700 text-white' :
                                      'bg-slate-700 hover:bg-slate-800 text-white'
                                  }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span>{isPdf ? '📄' : isDocx ? '📝' : '🗂️'}</span>
                                  <span>Download {ext} — {fileName}</span>
                                </span>
                                <span className="text-[10px] opacity-70">{sizeKb} KB ↓</span>
                              </a>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setDownloadableFiles([])}
                          className="mt-3 text-[10px] text-emerald-600 hover:text-emerald-800 underline"
                        >
                          Clear downloads
                        </button>
                      </div>
                    )}

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

      {/* Column Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-6 flex flex-col max-h-[90vh]">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Map Columns from Imported Table</h3>
              <p className="text-xs text-slate-400 mt-1">
                Select which column from your imported sheet corresponds to each required field.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-sky-50 text-sky-800 text-xs px-3.5 py-2.5 rounded-lg border border-sky-100 shrink-0">
              <input
                type="checkbox"
                id="firstRowHeader"
                checked={firstRowIsHeader}
                onChange={(e) => {
                  setFirstRowIsHeader(e.target.checked);
                  setTimeout(() => prepareMapping(mappingData), 0);
                }}
                className="rounded text-sky-600"
              />
              <label htmlFor="firstRowHeader" className="font-semibold cursor-pointer select-none">
                First row contains header labels (e.g. "Sample Name", "Concentration")
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-4 shrink-0">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Sample ID / Name Column *</label>
                <select
                  value={sampleIdIndex}
                  onChange={(e) => setSampleIdIndex(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                >
                  <option value="-1">-- Do Not Map --</option>
                  {mappingHeaders.map((h, i) => (
                    <option key={i} value={i}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Concentration Column *</label>
                <select
                  value={concIndex}
                  onChange={(e) => setConcIndex(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                >
                  <option value="-1">-- Do Not Map --</option>
                  {mappingHeaders.map((h, i) => (
                    <option key={i} value={i}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Volume Column</label>
                <select
                  value={volIndex}
                  onChange={(e) => setVolIndex(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                >
                  <option value="-1">-- Do Not Map (Use default) --</option>
                  {mappingHeaders.map((h, i) => (
                    <option key={i} value={i}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Yield Column</label>
                <select
                  value={yieldIndex}
                  onChange={(e) => setYieldIndex(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                >
                  <option value="-1">-- Do Not Map (Use default) --</option>
                  {mappingHeaders.map((h, i) => (
                    <option key={i} value={i}>{h}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-1">Remarks Column</label>
                <select
                  value={remarksIndex}
                  onChange={(e) => setRemarksIndex(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                >
                  <option value="-1">-- Do Not Map (None) --</option>
                  {mappingHeaders.map((h, i) => (
                    <option key={i} value={i}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Preview Table */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Import Preview (First 3 rows)</h4>
              <div className="border border-slate-100 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-3 py-2">Sample ID</th>
                      <th className="px-3 py-2">Concentration</th>
                      <th className="px-3 py-2">Volume</th>
                      <th className="px-3 py-2">Yield</th>
                      <th className="px-3 py-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(firstRowIsHeader ? mappingData.slice(1, 4) : mappingData.slice(0, 3)).map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 font-semibold text-slate-700">{sampleIdIndex !== -1 ? row[sampleIdIndex] || '-' : '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{concIndex !== -1 ? row[concIndex] || '-' : '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{volIndex !== -1 ? row[volIndex] || '-' : '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{yieldIndex !== -1 ? row[yieldIndex] || '-' : '-'}</td>
                        <td className="px-3 py-2 text-slate-500 truncate max-w-[150px]">{remarksIndex !== -1 ? row[remarksIndex] || '-' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 shrink-0 border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowMappingModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmMapping}
                className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm"
              >
                Confirm & Import
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
