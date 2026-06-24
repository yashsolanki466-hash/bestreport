/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UploadCloud, CheckCircle2 } from 'lucide-react';

export default function App() {
  return (
    <div className="flex h-screen w-full bg-[#F9FAFB] text-[#111827] font-sans overflow-hidden">
      {/* Left Sidebar Navigation */}
      <nav className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">G</span>
            </div>
            <span className="font-semibold tracking-tight text-lg">NGS Pro</span>
          </div>
        </div>
        <div className="flex-1 py-4">
          <ul className="space-y-1 px-3">
            <li><a href="#" className="flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 transition-colors"><span className="w-5 h-5 mr-2 opacity-70 italic font-mono">01</span>Project Information</a></li>
            <li><a href="#" className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"><span className="w-5 h-5 mr-2 opacity-70 italic font-mono">02</span>Sample Information</a></li>
            <li><a href="#" className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"><span className="w-5 h-5 mr-2 opacity-70 italic font-mono">03</span>Static Content</a></li>
            <li><a href="#" className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"><span className="w-5 h-5 mr-2 opacity-70 italic font-mono">04</span>QC Images</a></li>
            <li><a href="#" className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"><span className="w-5 h-5 mr-2 opacity-70 italic font-mono">05</span>Report Preview</a></li>
            <li><a href="#" className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"><span className="w-5 h-5 mr-2 opacity-70 italic font-mono">06</span>Export Report</a></li>
          </ul>
        </div>
        <div className="p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">System Status</span>
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
          </div>
          <p className="text-[11px] text-gray-500 leading-tight">Local LIMS node connected: v4.2.1-stable</p>
        </div>
      </nav>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col h-full">
        {/* Header Controls */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Projects</span>
            <span className="text-sm text-gray-300">/</span>
            <span className="text-sm font-medium">PRJ-2024-X4520</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors tracking-wide">Save Template</button>
            <button className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 transition-colors tracking-wide">Generate Interim Report</button>
          </div>
        </header>

        {/* Content Area Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Input Section */}
          <div className="w-1/2 flex flex-col border-r border-gray-200 bg-[#F9FAFB]">
            <div className="p-6 space-y-6 overflow-y-auto min-h-0 custom-scrollbar">
              
              {/* Project Details Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Project Details</h2>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase">Project ID</label>
                    <input type="text" className="mt-1 w-full text-sm font-medium text-gray-800 bg-gray-50 border-none rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 transition-shadow" defaultValue="PRJ-2024-X4520" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase">Service Type</label>
                    <select className="mt-1 w-full text-sm font-medium text-gray-800 bg-gray-50 border-none rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 transition-shadow">
                      <option>RNA-Seq (Poly-A)</option>
                      <option>DNA-Seq (Whole Exome)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase">Platform</label>
                    <input type="text" className="mt-1 w-full text-sm font-medium text-gray-800 bg-gray-50 border-none rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 transition-shadow" defaultValue="Illumina NovaSeq 6000" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase">Submitted To</label>
                    <input type="text" className="mt-1 w-full text-sm font-medium text-gray-800 bg-gray-50 border-none rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 transition-shadow" defaultValue="Dr. Elena Vance" />
                  </div>
                </div>
              </div>

              {/* Sample Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sample Information</h2>
                  <div className="flex gap-2">
                    <button className="text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-wider">+ Add Row</button>
                    <button className="text-[10px] font-bold text-gray-500 hover:text-gray-700 transition-colors uppercase tracking-wider">Import CSV</button>
                  </div>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-gray-100">
                      <th className="px-5 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">ID</th>
                      <th className="px-5 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conc.</th>
                      <th className="px-5 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Yield</th>
                      <th className="px-5 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">QC</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">S001_T0</td>
                      <td className="px-5 py-3 text-gray-600">42.5 ng/µL</td>
                      <td className="px-5 py-3 text-gray-500">1.2 µg</td>
                      <td className="px-5 py-3"><span className="text-[10px] px-2 py-1 rounded-full bg-green-50 text-green-700 font-bold tracking-wider">PASS</span></td>
                    </tr>
                    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">S002_T1</td>
                      <td className="px-5 py-3 text-gray-600">38.2 ng/µL</td>
                      <td className="px-5 py-3 text-gray-500">0.9 µg</td>
                      <td className="px-5 py-3"><span className="text-[10px] px-2 py-1 rounded-full bg-green-50 text-green-700 font-bold tracking-wider">PASS</span></td>
                    </tr>
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-red-600">S003_T0</td>
                      <td className="px-5 py-3 text-gray-600">2.1 ng/µL</td>
                      <td className="px-5 py-3 text-gray-500">0.04 µg</td>
                      <td className="px-5 py-3"><span className="text-[10px] px-2 py-1 rounded-full bg-red-50 text-red-700 font-bold tracking-wider">FAIL</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Drop Zone */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center bg-white cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                  <UploadCloud className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-sm font-medium text-gray-800">Drop QC Image Folder Here</p>
                <p className="text-xs text-gray-400 mt-1.5">TapeStation, Bioanalyzer, Qubit</p>
              </div>
            </div>
          </div>

          {/* Report Preview Section */}
          <div className="w-1/2 flex flex-col bg-gray-100 p-6 min-h-0 border-l border-gray-200/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Report Live Preview</h3>
              <div className="flex gap-1.5">
                 <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                 <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                 <div className="w-2 h-2 rounded-full bg-gray-300"></div>
              </div>
            </div>
            
            <div className="flex-1 bg-white shadow-xl shadow-gray-200/50 rounded-lg overflow-hidden flex flex-col ring-1 ring-gray-900/5">
              {/* Mini Page Content */}
              <div className="p-10 lg:p-12 space-y-8 flex-1 overflow-y-auto">
                <div className="flex justify-between items-start">
                  <div className="w-24 h-8 bg-gray-50 rounded border border-gray-100"></div>
                  <div className="text-right text-[10px] text-gray-400 font-bold tracking-widest">STRICTLY CONFIDENTIAL</div>
                </div>
                <div className="h-0.5 bg-blue-600 w-full rounded-full"></div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-serif text-gray-900 tracking-tight">NGS Interim Report</h1>
                  <p className="text-xs text-gray-500 font-medium">Project: PRJ-2024-X4520 &bull; Nov 12, 2023</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <h4 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider">1. RNA Extraction & QC Summary</h4>
                    <p className="text-[11px] text-gray-600 leading-relaxed font-medium">Total RNA was extracted using the RNeasy Mini Kit. Quality assessment was performed via Agilent 4200 TapeStation. All samples except S003_T0 exhibited high integrity (RIN &gt; 8.0).</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 py-4">
                    <div className="aspect-video bg-gray-50 border border-gray-100 rounded flex items-center justify-center text-[9px] font-medium text-gray-400 uppercase tracking-tighter">Gel Profile_S001</div>
                    <div className="aspect-video bg-gray-50 border border-gray-100 rounded flex items-center justify-center text-[9px] font-medium text-gray-400 uppercase tracking-tighter">Gel Profile_S002</div>
                    <div className="aspect-video bg-gray-50 border border-gray-100 rounded flex items-center justify-center text-[9px] font-medium text-gray-400 uppercase tracking-tighter text-center">RIN Data<br/>Chart</div>
                  </div>
                </div>
              </div>
              <div className="h-12 border-t border-gray-100 px-8 flex items-center justify-between text-[10px] font-medium text-gray-400 flex-shrink-0 bg-gray-50/50">
                <span>GenomX Labs Interim Draft v1.0</span>
                <span>Page 1 of 4</span>
              </div>
            </div>
            
            {/* Bottom Mapping Ticker */}
            <div className="mt-4 p-3 bg-white border border-gray-200/60 rounded-xl flex items-center gap-5 flex-shrink-0 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-green-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                </div>
                <span className="text-[11px] font-bold text-gray-600 tracking-wide">12 RNA QC MAPPED</span>
              </div>
              <div className="w-px h-4 bg-gray-200"></div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-green-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                </div>
                <span className="text-[11px] font-bold text-gray-600 tracking-wide">3 PROFILES AUTO-DETECTED</span>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Footer Bar */}
        <footer className="h-12 bg-white border-t border-gray-200 px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex gap-6">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-8 h-4.5 bg-blue-600 rounded-full relative shadow-inner">
                <div className="absolute left-[18px] top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all group-hover:scale-105"></div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-700 transition-colors">Auto Number Figures</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-8 h-4.5 bg-blue-600 rounded-full relative shadow-inner">
                <div className="absolute left-[18px] top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all group-hover:scale-105"></div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-700 transition-colors">Standard Templates</span>
            </label>
          </div>
          <div className="text-[10px] font-mono font-medium text-gray-400 tracking-wide uppercase">NGS-GEN-8.2 / Ready to Compile</div>
        </footer>
      </main>
    </div>
  );
}
