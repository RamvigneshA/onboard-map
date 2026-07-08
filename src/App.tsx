/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderIcon, 
  Terminal, 
  Map, 
  Cpu, 
  FileText, 
  AlertTriangle, 
  ShieldCheck, 
  Users, 
  Zap, 
  RefreshCw, 
  Search, 
  Upload, 
  Eye, 
  Maximize2, 
  Activity, 
  Share2, 
  Workflow, 
  Network,
  HelpCircle,
  FileCode,
  Sparkles
} from 'lucide-react';

// Interfaces matching backend structures
interface FileNode {
  path: string;
  loc: number;
  hasTestFile: boolean;
}

interface ImportEdge {
  from: string;
  to: string;
  isTypeOnly: boolean;
}

interface GraphData {
  files: FileNode[];
  edges: ImportEdge[];
}

interface CheckResult {
  id: string;
  title: string;
  severity: 'info' | 'warn' | 'risk';
  summary: string;
  details: any;
}

interface AnalysisMeta {
  projectName: string;
  filesScanned: number;
  edgeCount: number;
  durationMs: number;
  isRealGit: boolean;
  projectMeta?: {
    framework: string;
    packageManager: string;
    workspaceType: string;
    projectType: string;
    workspacePackages: { name: string; path: string }[];
    entryPoints: string[];
    aliases: Record<string, string[]>;
  };
}

interface AnalysisData {
  meta: AnalysisMeta;
  results: CheckResult[];
  terminalOutput: string;
  graph: GraphData;
  gitLogSummary: any[];
}

// Simple force-directed graph node structure
interface SimulatedNode {
  id: string;
  name: string;
  path: string;
  loc: number;
  hasTest: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fanIn: number;
  fanOut: number;
}

export default function App() {
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lens, setLens] = useState<'new-hire' | 'staff'>('new-hire');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'graph' | 'terminal'>('dashboard');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isDeepScan, setIsDeepScan] = useState<boolean>(true);
  
  // Graph simulation state
  const [nodes, setNodes] = useState<SimulatedNode[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const graphContainerRef = useRef<SVGSVGElement | null>(null);
  const dragNodeRef = useRef<string | null>(null);

  // Fetch local workspace scan on mount
  useEffect(() => {
    triggerScan();
  }, []);

  const triggerScan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analyze?deep=${isDeepScan}`);
      if (!res.ok) {
        throw new Error(`Failed with status ${res.status}`);
      }
      const json: AnalysisData = await res.json();
      setData(json);
      initGraphSimulation(json.graph);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const res = await fetch('/api/upload-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
          'X-Filename': file.name,
        },
        body: arrayBuffer,
      });

      if (!res.ok) {
        throw new Error(`Failed to upload: ${res.statusText}`);
      }

      const json: AnalysisData = await res.json();
      setData(json);
      initGraphSimulation(json.graph);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Run a simple lightweight force-directed physical simulation on the client
  const initGraphSimulation = (graph: GraphData) => {
    if (!graph.files || graph.files.length === 0) return;

    // Calculate fan-in/fan-out
    const fanInMap = new Map<string, number>();
    const fanOutMap = new Map<string, number>();
    for (const file of graph.files) {
      fanInMap.set(file.path, 0);
      fanOutMap.set(file.path, 0);
    }
    for (const edge of graph.edges) {
      fanOutMap.set(edge.from, (fanOutMap.get(edge.from) || 0) + 1);
      fanInMap.set(edge.to, (fanInMap.get(edge.to) || 0) + 1);
    }

    const width = 800;
    const height = 500;

    // Seed nodes in a circle
    const simNodes: SimulatedNode[] = graph.files.map((file, i) => {
      const angle = (i / graph.files.length) * Math.PI * 2;
      const radius = 100 + Math.random() * 150;
      return {
        id: file.path,
        name: file.path.split('/').pop() || file.path,
        path: file.path,
        loc: file.loc,
        hasTest: file.hasTestFile,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        fanIn: fanInMap.get(file.path) || 0,
        fanOut: fanOutMap.get(file.path) || 0,
      };
    });

    // Run simple spring simulation steps
    const kAttract = 0.05;
    const kRepel = 1200;
    const friction = 0.85;
    const gravity = 0.02;

    for (let step = 0; step < 120; step++) {
      // 1. Repulsion between all pairs
      for (let i = 0; i < simNodes.length; i++) {
        const n1 = simNodes[i];
        for (let j = i + 1; j < simNodes.length; j++) {
          const n2 = simNodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy + 0.1;
          const dist = Math.sqrt(distSq);
          if (dist < 280) {
            const force = kRepel / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            n1.vx -= fx;
            n1.vy -= fy;
            n2.vx += fx;
            n2.vy += fy;
          }
        }
      }

      // 2. Attraction along edges
      for (const edge of graph.edges) {
        const n1 = simNodes.find(n => n.path === edge.from);
        const n2 = simNodes.find(n => n.path === edge.to);
        if (n1 && n2) {
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = kAttract * (dist - 100);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          n1.vx += fx;
          n1.vy += fy;
          n2.vx -= fx;
          n2.vy -= fy;
        }
      }

      // 3. Gravity pulling toward center and friction application
      for (const node of simNodes) {
        const dx = width / 2 - node.x;
        const dy = height / 2 - node.y;
        node.vx += dx * gravity;
        node.vy += dy * gravity;

        node.x += node.vx;
        node.y += node.vy;
        node.vx *= friction;
        node.vy *= friction;

        // Constraint boundary
        node.x = Math.max(40, Math.min(width - 40, node.x));
        node.y = Math.max(40, Math.min(height - 40, node.y));
      }
    }

    setNodes(simNodes);
  };

  // Safe mouse drag mechanics for node movement in SVGs
  const handleGraphMouseDown = (nodeId: string) => {
    dragNodeRef.current = nodeId;
  };

  const handleGraphMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragNodeRef.current || !graphContainerRef.current) return;
    
    const svgRect = graphContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - svgRect.left) / svgRect.width) * 800;
    const y = ((e.clientY - svgRect.top) / svgRect.height) * 500;

    setNodes(prev => prev.map(n => {
      if (n.path === dragNodeRef.current) {
        return { ...n, x, y };
      }
      return n;
    }));
  };

  const handleGraphMouseUp = () => {
    dragNodeRef.current = null;
  };

  // Convert ANSI terminal colors into responsive styled HTML spans
  const renderAnsi = (text: string) => {
    if (!text) return null;
    
    // Simple ANSI state machine to convert terminal characters to colored segments
    const parts = text.split(/(\x1b\[\d+m)/);
    let keyIdx = 0;
    let isBold = false;
    let isDim = false;
    let colorClass = '';

    return parts.map(part => {
      if (part.startsWith('\x1b[')) {
        const code = part.slice(2, -1);
        if (code === '0') {
          isBold = false;
          isDim = false;
          colorClass = '';
        } else if (code === '1') {
          isBold = true;
        } else if (code === '2') {
          isDim = true;
        } else if (code === '31') {
          colorClass = 'text-red-400';
        } else if (code === '32') {
          colorClass = 'text-emerald-400';
        } else if (code === '33') {
          colorClass = 'text-amber-400';
        } else if (code === '34') {
          colorClass = 'text-blue-400';
        } else if (code === '35') {
          colorClass = 'text-fuchsia-400';
        } else if (code === '36') {
          colorClass = 'text-cyan-400';
        } else if (code === '90') {
          colorClass = 'text-zinc-500';
        }
        return null;
      }

      if (!part) return null;

      const classes = [
        isBold ? 'font-semibold' : '',
        isDim ? 'opacity-50' : '',
        colorClass,
      ].filter(Boolean).join(' ');

      return (
        <span key={keyIdx++} className={classes}>
          {part}
        </span>
      );
    });
  };

  // Extract individual checks from the server results
  const getCheck = (id: string): CheckResult | undefined => {
    return data?.results.find(r => r.id === id);
  };

  // Helper colors for severities
  const getSeverityBadge = (severity: 'info' | 'warn' | 'risk') => {
    switch (severity) {
      case 'risk':
        return <span className="px-2 py-0.5 rounded text-xs bg-red-950/40 text-red-400 border border-red-900/60 font-medium">Risk Factor</span>;
      case 'warn':
        return <span className="px-2 py-0.5 rounded text-xs bg-amber-950/40 text-amber-400 border border-amber-900/60 font-medium">Arch Warning</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-medium">Metric Info</span>;
    }
  };

  // Filtered nodes for the interactive graph
  const filteredNodes = nodes.filter(node => 
    node.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="applet-viewport" className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-cyan-500/20 selection:text-cyan-200">
      
      {/* Top Header Rail */}
      <header id="header-rail" className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Map className="h-5 w-5 text-zinc-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white font-mono">onboard-map</h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-cyan-400 font-mono border border-zinc-800">v1.0.0</span>
              </div>
              <p className="text-xs text-zinc-400">Offline codebase import graph & git churn diagnostic diagnostic</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Deep Scan Toggle */}
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer bg-zinc-900 hover:bg-zinc-800/80 px-3 py-1.5 rounded-lg border border-zinc-800 transition">
              <input 
                type="checkbox" 
                checked={isDeepScan} 
                onChange={(e) => setIsDeepScan(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-800 text-cyan-500 focus:ring-0 focus:ring-offset-0"
              />
              <span>Include `--deep` checks</span>
            </label>

            <button 
              id="btn-workspace-sync"
              onClick={triggerScan}
              disabled={loading}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 px-3.5 py-1.5 rounded-lg border border-zinc-800 font-medium text-xs transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              Scan Workspace
            </button>

            <label className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 text-zinc-950 px-3.5 py-1.5 rounded-lg font-bold text-xs transition active:scale-95 cursor-pointer shadow-lg shadow-cyan-500/5">
              <Upload className="h-3.5 w-3.5 stroke-[2.5]" />
              Upload Repo ZIP
              <input 
                type="file" 
                accept=".zip" 
                onChange={handleZipUpload} 
                className="hidden" 
              />
            </label>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* Loading / Error Banners */}
        {error && (
          <div id="error-banner" className="mb-6 p-4 rounded-xl bg-red-950/20 border border-red-900/60 text-red-400 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">Analysis Execution Failed</h4>
              <p className="text-xs text-red-500/90 mt-1">{error}</p>
              <button onClick={triggerScan} className="mt-2 text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1">
                Retry scan on current workspace
              </button>
            </div>
          </div>
        )}

        {/* Project Meta Rail */}
        {data && (
          <div id="project-meta-rail" className="mb-6 p-4 rounded-xl bg-zinc-900/50 border border-zinc-900 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <FolderIcon className="h-5 w-5 text-cyan-400" />
                <div>
                  <span className="text-xs text-zinc-500">Inspecting Codebase</span>
                  <h2 className="text-sm font-bold text-white font-mono">{data.meta.projectName}</h2>
                </div>
              </div>
              
              {data.meta.projectMeta && (
                <div className="flex flex-wrap gap-2 sm:ml-4">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-zinc-800 text-cyan-400 border border-zinc-700/50 font-mono uppercase tracking-wide">
                    {data.meta.projectMeta.framework}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-zinc-800 text-indigo-400 border border-zinc-700/50 font-mono uppercase tracking-wide">
                    {data.meta.projectMeta.packageManager}
                  </span>
                  {data.meta.projectMeta.workspaceType !== 'none' && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-purple-950/40 text-purple-400 border border-purple-900/40 font-mono uppercase tracking-wide">
                      MONOREPO ({data.meta.projectMeta.workspaceType})
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-zinc-800 text-emerald-400 border border-zinc-700/50 font-mono uppercase tracking-wide">
                    {data.meta.projectMeta.projectType}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center sm:text-left">
                <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Parsed Files</span>
                <span className="text-sm font-bold font-mono text-cyan-400">{data.meta.filesScanned}</span>
              </div>
              <div className="h-6 w-[1px] bg-zinc-800" />
              <div className="text-center sm:text-left">
                <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Import Edges</span>
                <span className="text-sm font-bold font-mono text-indigo-400">{data.meta.edgeCount}</span>
              </div>
              <div className="h-6 w-[1px] bg-zinc-800" />
              <div className="text-center sm:text-left">
                <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Execution Speed</span>
                <span className="text-sm font-bold font-mono text-emerald-400">{(data.meta.durationMs / 1000).toFixed(2)}s</span>
              </div>
              <div className="h-6 w-[1px] bg-zinc-800" />
              <div className="text-center sm:text-left">
                <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Git Engine</span>
                <span className="text-sm font-bold font-mono text-amber-400">{data.meta.isRealGit ? 'Local Git' : 'Simulated'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Left Controls/Navigation Panel */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* View Selector Card */}
            <div className="bg-zinc-900 border border-zinc-900 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">View Modes</h3>
              
              <button 
                id="tab-dashboard"
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'dashboard' 
                    ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-900/60 shadow-lg shadow-cyan-950/20' 
                    : 'text-zinc-400 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="h-4 w-4" />
                  <span>Report Dashboard</span>
                </div>
              </button>

              <button 
                id="tab-graph"
                onClick={() => setActiveTab('graph')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'graph' 
                    ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-900/60 shadow-lg shadow-cyan-950/20' 
                    : 'text-zinc-400 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Network className="h-4 w-4" />
                  <span>Interactive Graph</span>
                </div>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">live</span>
              </button>

              <button 
                id="tab-terminal"
                onClick={() => setActiveTab('terminal')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'terminal' 
                    ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-900/60 shadow-lg shadow-cyan-950/20' 
                    : 'text-zinc-400 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Terminal className="h-4 w-4" />
                  <span>CLI Terminal View</span>
                </div>
              </button>
            </div>

            {/* Lens Switcher Card (Only applicable on dashboard) */}
            {activeTab === 'dashboard' && (
              <div className="bg-zinc-900 border border-zinc-900 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Diagnostic Lenses</h3>
                </div>
                
                <p className="text-xs text-zinc-500">Same data, analyzed from two entirely different viewpoints:</p>

                <div className="grid grid-cols-1 gap-2 pt-1">
                  <button
                    id="lens-new-hire"
                    onClick={() => setLens('new-hire')}
                    className={`flex flex-col items-start p-3 rounded-lg border text-left transition ${
                      lens === 'new-hire'
                        ? 'bg-cyan-950/20 border-cyan-900/60 text-cyan-400 shadow shadow-cyan-950/10'
                        : 'bg-zinc-950/40 border-transparent text-zinc-400 hover:bg-zinc-800/30 hover:border-zinc-800'
                    }`}
                  >
                    <span className="text-sm font-bold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                      Day 1 New Hire
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-1 font-light leading-relaxed">"Where do I start reading? What components are safe and stable to write code in?"</span>
                  </button>

                  <button
                    id="lens-staff"
                    onClick={() => setLens('staff')}
                    className={`flex flex-col items-start p-3 rounded-lg border text-left transition ${
                      lens === 'staff'
                        ? 'bg-indigo-950/20 border-indigo-900/60 text-indigo-400 shadow shadow-indigo-950/10'
                        : 'bg-zinc-950/40 border-transparent text-zinc-400 hover:bg-zinc-800/30 hover:border-zinc-800'
                    }`}
                  >
                    <span className="text-sm font-bold flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                      Staff Architect
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-1 font-light leading-relaxed">"Where is architectural boundary leak concentrated? Where are risk silos and circular chains?"</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Overview Stats Card */}
            {data && (
              <div className="bg-zinc-900 border border-zinc-900 rounded-xl p-4 space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Health Core</h3>
                
                <div className="space-y-3.5">
                  <div>
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Tested files ratio</span>
                      <span className="font-semibold text-zinc-300">
                        {Math.round((data.graph.files.filter(f => f.hasTestFile).length / data.graph.files.length) * 100) || 0}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full" 
                        style={{ width: `${(data.graph.files.filter(f => f.hasTestFile).length / data.graph.files.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Circular import cycles</span>
                      <span className={`font-semibold ${getCheck('circular-deps')?.details.cycles.length > 0 ? 'text-red-400 font-mono' : 'text-zinc-400'}`}>
                        {getCheck('circular-deps')?.details.cycles.length || 0}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Unused Dead ends</span>
                      <span className={`font-semibold ${getCheck('dead-ends')?.details.files.length > 0 ? 'text-amber-400 font-mono' : 'text-zinc-400'}`}>
                        {getCheck('dead-ends')?.details.files.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Right Workspace Panel */}
          <div className="lg:col-span-3 space-y-6">

            {/* Loading Indicator */}
            {loading && (
              <div className="p-12 text-center rounded-2xl bg-zinc-900 border border-zinc-900 flex flex-col items-center justify-center gap-4">
                <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin stroke-[2.5]" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-white">Performing Contextual Code Map Analysis</h3>
                  <p className="text-xs text-zinc-500 max-w-sm">Walking files, analyzing import paths with ts-morph, and parsing local Git commit logs...</p>
                </div>
              </div>
            )}

            {/* Dashboard View */}
            {!loading && data && activeTab === 'dashboard' && (
              <div className="space-y-6">

                {/* Day 1 New Hire Lens View */}
                {lens === 'new-hire' && (
                  <div className="space-y-6">

                    {/* Start Here - Critical Path */}
                    {getCheck('entry-path') && (
                      <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 h-40 w-40 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                        
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="p-1 bg-cyan-500/10 text-cyan-400 rounded-lg">
                                <Workflow className="h-4 w-4" />
                              </span>
                              <h3 className="text-base font-bold text-white font-mono">📍 {getCheck('entry-path')?.title}</h3>
                            </div>
                            <p className="text-xs text-zinc-400">Day-1 recommendation: Follow this critical execution path to understand the entry workflow</p>
                          </div>
                          {getSeverityBadge(getCheck('entry-path')!.severity)}
                        </div>

                        {/* Chain visualization */}
                        <div className="mt-6 flex flex-wrap items-center gap-3 bg-zinc-950 p-4 rounded-xl border border-zinc-950">
                          {getCheck('entry-path')?.details.chain.map((file: string, i: number) => (
                            <React.Fragment key={file}>
                              {i > 0 && <span className="text-zinc-600 font-mono text-sm">→</span>}
                              <div className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono font-semibold text-cyan-300 hover:border-cyan-500/30 transition cursor-help" title={file}>
                                {file.split('/').pop()}
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Feature Folder Paths */}
                    {getCheck('reading-path-by-feature') && (
                      <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6">
                        <div className="flex items-start justify-between gap-4 mb-5">
                          <div className="space-y-1">
                            <h3 className="text-base font-bold text-white font-mono">🗺️ {getCheck('reading-path-by-feature')?.title}</h3>
                            <p className="text-xs text-zinc-400">Feature directories mapped with their primary entry import chains</p>
                          </div>
                          {getSeverityBadge(getCheck('reading-path-by-feature')!.severity)}
                        </div>

                        <div className="grid grid-cols-1 gap-3.5">
                          {getCheck('reading-path-by-feature')?.details.features.map((feat: any) => (
                            <div key={feat.folder} className="bg-zinc-950 p-4 rounded-xl border border-zinc-950/80 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-zinc-800 transition">
                              <div className="flex items-center gap-3">
                                <FolderIcon className="h-4.5 w-4.5 text-cyan-500" />
                                <span className="font-mono text-sm font-semibold text-zinc-100">{feat.folder}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-400 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-900">
                                {feat.chain.map((file: string, idx: number) => (
                                  <React.Fragment key={idx}>
                                    {idx > 0 && <span className="text-zinc-600">→</span>}
                                    <span className={idx === feat.chain.length - 1 ? 'text-cyan-400 font-semibold' : 'text-zinc-300'}>{file}</span>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Safe Components and Ownership Map */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                      {/* Safe to practice */}
                      {getCheck('safe-to-practice') && (
                        <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="space-y-1">
                              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                                <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
                                {getCheck('safe-to-practice')?.title}
                              </h3>
                              <p className="text-xs text-zinc-400">Stable, tested components with minimal dependencies</p>
                            </div>
                            {getSeverityBadge(getCheck('safe-to-practice')!.severity)}
                          </div>

                          <div className="space-y-3">
                            {getCheck('safe-to-practice')?.details.files.map((f: any) => (
                              <div key={f.file} className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-950 hover:border-zinc-800 transition flex items-center justify-between">
                                <div className="space-y-1">
                                  <span className="block text-xs font-mono font-semibold text-zinc-100">{f.filename}</span>
                                  <span className="block text-[10px] text-zinc-500 font-mono truncate max-w-xs">{f.file}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/20 text-emerald-400 border border-emerald-900/40">Tested</span>
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-900 text-zinc-400">{f.fanIn} import</span>
                                </div>
                              </div>
                            ))}
                            {getCheck('safe-to-practice')?.details.files.length === 0 && (
                              <p className="text-xs text-zinc-500 italic py-4 text-center">No highly isolated components with tests discovered</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Who knows this code */}
                      {getCheck('ownership') && (
                        <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="space-y-1">
                              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                                <Users className="h-4.5 w-4.5 text-cyan-400" />
                                {getCheck('ownership')?.title}
                              </h3>
                              <p className="text-xs text-zinc-400">Primary author of git commits per folder (trailing 90 days)</p>
                            </div>
                            {getSeverityBadge(getCheck('ownership')!.severity)}
                          </div>

                          <div className="space-y-3.5">
                            {getCheck('ownership')?.details.folders.map((f: any) => (
                              <div key={f.folder} className="space-y-1.5">
                                <div className="flex justify-between text-xs font-mono">
                                  <span className="text-zinc-300 font-semibold">{f.folder}</span>
                                  <span className="text-cyan-400">{f.topAuthor} <span className="text-zinc-500">({f.percentage}%)</span></span>
                                </div>
                                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-cyan-500 rounded-full" 
                                    style={{ width: `${f.percentage}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                            {getCheck('ownership')?.details.folders.length === 0 && (
                              <p className="text-xs text-zinc-500 italic py-4 text-center">No active git commits tracked inside top modules in 90 days</p>
                            )}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Setup auditing warnings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Env mismatch */}
                      {getCheck('env-mismatch') && (
                        <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-sm font-bold text-white font-mono">🔧 {getCheck('env-mismatch')?.title}</h3>
                            {getSeverityBadge(getCheck('env-mismatch')!.severity)}
                          </div>
                          
                          <p className="text-xs text-zinc-400 mb-4">{getCheck('env-mismatch')?.summary}</p>
                          
                          {getCheck('env-mismatch')?.details.missingVars.length > 0 ? (
                            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-950/60 font-mono text-xs text-amber-400 space-y-1.5">
                              {getCheck('env-mismatch')?.details.missingVars.map((v: string) => (
                                <div key={v} className="flex items-center gap-2">
                                  <span className="h-1 w-1 bg-amber-400 rounded-full" />
                                  <span>{v}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 bg-emerald-950/10 border border-emerald-900/30 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4" />
                              <span>Ecosystem configurations perfectly matched in .env.example!</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Readme staleness */}
                      {getCheck('readme-staleness') && (
                        <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-sm font-bold text-white font-mono">📄 {getCheck('readme-staleness')?.title}</h3>
                            {getSeverityBadge(getCheck('readme-staleness')!.severity)}
                          </div>

                          <p className="text-xs text-zinc-400 mb-4">{getCheck('readme-staleness')?.summary}</p>

                          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-950 text-xs space-y-2 text-zinc-400 font-light leading-relaxed">
                            <div className="flex justify-between">
                              <span>README Node version:</span>
                              <span className="font-mono text-white font-semibold">{getCheck('readme-staleness')?.details.readmeNodeVersion || 'Not stated'}</span>
                            </div>
                            <div className="flex justify-between border-t border-zinc-900 pt-2">
                              <span>Actual Project Node version:</span>
                              <span className="font-mono text-white font-semibold">{getCheck('readme-staleness')?.details.actualNodeVersion || 'Not declared'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>

                  </div>
                )}

                {/* Day 1 Staff Architect Lens View */}
                {lens === 'staff' && (
                  <div className="space-y-6">

                    {/* High Risk Modules */}
                    {getCheck('high-risk') && (
                      <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="space-y-1">
                            <h3 className="text-base font-bold text-white font-mono flex items-center gap-1.5">
                              <AlertTriangle className="h-5 w-5 text-red-500" />
                              ⚠️ {getCheck('high-risk')?.title}
                            </h3>
                            <p className="text-xs text-zinc-400">Priority code refactoring spots: `fan-in × churn(90d) × lack-of-tests` score</p>
                          </div>
                          {getSeverityBadge(getCheck('high-risk')!.severity)}
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-800 text-[10px] uppercase text-zinc-500 tracking-wider font-mono">
                                <th className="pb-3 pl-1">File Target</th>
                                <th className="pb-3 text-center">Fan-In Imports</th>
                                <th className="pb-3 text-center">Changes (90d)</th>
                                <th className="pb-3 text-center">Coverage</th>
                                <th className="pb-3 text-right pr-1">Risk Power</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-850/50">
                              {getCheck('high-risk')?.details.files.map((row: any) => (
                                <tr key={row.file} className="hover:bg-zinc-950/20 transition group">
                                  <td className="py-3.5 pl-1">
                                    <span className="block text-xs font-mono font-bold text-zinc-100 group-hover:text-cyan-400 transition">{row.filename}</span>
                                    <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">{row.file}</span>
                                  </td>
                                  <td className="py-3.5 text-center font-mono text-xs text-zinc-300">{row.fanIn}</td>
                                  <td className="py-3.5 text-center font-mono text-xs text-zinc-300">{row.changes90d}</td>
                                  <td className="py-3.5 text-center">
                                    {row.hasTest ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/10 text-emerald-400 border border-emerald-900/30">Has Test</span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] bg-red-950/10 text-red-400 border border-red-900/30">Untested</span>
                                    )}
                                  </td>
                                  <td className="py-3.5 text-right pr-1 font-mono text-xs font-bold text-red-400">
                                    {row.riskScore}
                                  </td>
                                </tr>
                              ))}
                              {getCheck('high-risk')?.details.files.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="py-8 text-center text-xs text-zinc-500 italic">No modules matching high-risk factors detected</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Coupling Hotspots and Circular Dependencies */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                      {/* Coupling hotspots */}
                      {getCheck('coupling-hotspots') && (
                        <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                              <Workflow className="h-4.5 w-4.5 text-indigo-400" />
                              🧩 {getCheck('coupling-hotspots')?.title}
                            </h3>
                            {getSeverityBadge(getCheck('coupling-hotspots')!.severity)}
                          </div>
                          
                          <p className="text-xs text-zinc-400 mb-4">{getCheck('coupling-hotspots')?.summary}</p>

                          <div className="space-y-3.5">
                            {getCheck('coupling-hotspots')?.details.hotspots.map((h: any) => (
                              <div key={h.file} className="bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-950 hover:border-zinc-800 transition">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-mono font-semibold text-white">{h.filename}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/20 text-indigo-400 border border-indigo-900/30 font-bold font-mono">Factor: {h.score}</span>
                                </div>
                                <div className="flex justify-between items-center mt-3 text-[11px] text-zinc-500 font-mono">
                                  <span>Imports: <span className="text-zinc-300 font-bold">{h.fanOut}</span></span>
                                  <span>Imported by: <span className="text-zinc-300 font-bold">{h.fanIn}</span></span>
                                </div>
                              </div>
                            ))}
                            {(!getCheck('coupling-hotspots') || getCheck('coupling-hotspots')?.details.hotspots.length === 0) && (
                              <p className="text-xs text-zinc-500 italic py-4 text-center">No coupling bottlenecks found</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Circular dependencies */}
                      {getCheck('circular-deps') && (
                        <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                              <RefreshCw className="h-4.5 w-4.5 text-red-400" />
                              🔁 {getCheck('circular-deps')?.title}
                            </h3>
                            {getSeverityBadge(getCheck('circular-deps')!.severity)}
                          </div>

                          <p className="text-xs text-zinc-400 mb-4">{getCheck('circular-deps')?.summary}</p>

                          <div className="space-y-3">
                            {getCheck('circular-deps')?.details.cycles.map((cycle: string[], idx: number) => (
                              <div key={idx} className="bg-red-950/5 border border-red-900/30 p-3 rounded-xl font-mono text-[10px] text-red-300 leading-relaxed space-y-1 hover:bg-red-950/10 transition">
                                <div className="font-bold text-xs flex items-center gap-1 text-red-400 mb-1.5">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>Circular Import Chain #{idx + 1}</span>
                                </div>
                                {cycle.map((node: string, index: number) => (
                                  <div key={index} className="flex items-center gap-2 pl-2">
                                    <span className="text-zinc-600 font-mono">↳</span>
                                    <span className={index === 0 || index === cycle.length - 1 ? 'font-bold text-red-400' : 'text-zinc-300'}>{node.split('/').pop()}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                            {getCheck('circular-deps')?.details.cycles.length === 0 && (
                              <div className="p-4 bg-emerald-950/10 border border-emerald-900/30 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                                <ShieldCheck className="h-4.5 w-4.5" />
                                <span>Excellent: Zero value-level circular dependency loops found!</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Boundary Violations & Bus Factor */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                      {/* Boundary violations */}
                      {getCheck('boundary-violations') && (
                        <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                              <Workflow className="h-4.5 w-4.5 text-amber-500" />
                              🚧 {getCheck('boundary-violations')?.title}
                            </h3>
                            {getSeverityBadge(getCheck('boundary-violations')!.severity)}
                          </div>

                          <p className="text-xs text-zinc-400 mb-4">{getCheck('boundary-violations')?.summary}</p>

                          <div className="space-y-3.5 max-h-80 overflow-y-auto">
                            {getCheck('boundary-violations')?.details.violations.map((v: any, idx: number) => (
                              <div key={idx} className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-950 text-xs">
                                <span className="block font-bold text-[10px] uppercase text-zinc-500 mb-1.5 font-mono">{v.type === 'shared-imports-feature' ? 'Shared → Domain Leak' : 'Direct Internal Cross-Import'}</span>
                                <div className="space-y-1.5 font-mono text-[11px] text-zinc-300">
                                  <div className="text-red-400 truncate" title={v.from}>from: {v.from}</div>
                                  <div className="text-zinc-500 pl-4">↳ imports</div>
                                  <div className="text-indigo-400 truncate" title={v.to}>to: {v.to}</div>
                                </div>
                              </div>
                            ))}
                            {(!getCheck('boundary-violations') || getCheck('boundary-violations')?.details.violations.length === 0) && (
                              <div className="p-4 bg-emerald-950/10 border border-emerald-900/30 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                                <ShieldCheck className="h-4.5 w-4.5" />
                                <span>Zero boundary violations: Clean separation of shared components and domain states!</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Bus factor */}
                      {getCheck('bus-factor') && (
                        <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                              <Users className="h-4.5 w-4.5 text-red-500" />
                              🚌 {getCheck('bus-factor')?.title}
                            </h3>
                            {getSeverityBadge(getCheck('bus-factor')!.severity)}
                          </div>

                          <p className="text-xs text-zinc-400 mb-4">{getCheck('bus-factor')?.summary}</p>

                          <div className="space-y-3">
                            {getCheck('bus-factor')?.details.files.map((f: any) => (
                              <div key={f.file} className="bg-zinc-950 p-4 rounded-xl border border-zinc-950 space-y-2">
                                <div className="flex justify-between font-mono text-xs">
                                  <span className="text-zinc-100 font-semibold truncate max-w-[180px]" title={f.file}>{f.filename}</span>
                                  <span className="text-red-400 font-bold">{f.percentage}% author share</span>
                                </div>
                                <p className="text-[10px] text-zinc-500">Knowledge siloed in <span className="text-zinc-300 font-semibold">{f.topAuthor}</span> ({f.commitCount} of {f.totalCommits} commits, 12mo)</p>
                                <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${f.percentage}%` }} />
                                </div>
                              </div>
                            ))}
                            {(!getCheck('bus-factor') || getCheck('bus-factor')?.details.files.length === 0) && (
                              <div className="p-4 bg-emerald-950/10 border border-emerald-900/30 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                                <ShieldCheck className="h-4.5 w-4.5" />
                                <span>Codebase commits are safely distributed among team members!</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Knowledge Gaps, Accelerating Churn, Barrel file bloat */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                      {/* Knowledge Gaps */}
                      {getCheck('knowledge-gap') && (
                        <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6 space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                              <Users className="h-4 w-4 text-amber-500" />
                              👻 Knowledge Gaps
                            </h3>
                            {getSeverityBadge(getCheck('knowledge-gap')!.severity)}
                          </div>

                          <div className="space-y-3">
                            {getCheck('knowledge-gap')?.details.gaps.slice(0, 3).map((g: any) => (
                              <div key={g.file} className="bg-zinc-950 p-3 rounded-lg text-xs leading-relaxed border border-zinc-950">
                                <span className="block font-semibold text-zinc-100 font-mono truncate">{g.filename}</span>
                                <p className="text-[10px] text-zinc-500 mt-1">Domain lead <span className="text-zinc-300 font-semibold">{g.primaryAuthor}</span> has made 0 commits repo-wide in last {g.daysSinceLastRepoCommit} days</p>
                              </div>
                            ))}
                            {(!getCheck('knowledge-gap') || getCheck('knowledge-gap')?.details.gaps.length === 0) && (
                              <p className="text-xs text-zinc-500 italic text-center py-4">No cold domains tracked with missing authors</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Accelerating Instability */}
                      {getCheck('accelerating-churn') && (
                        <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6 space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                              <Activity className="h-4 w-4 text-red-500" />
                              📈 Churn Instability
                            </h3>
                            {getSeverityBadge(getCheck('accelerating-churn')!.severity)}
                          </div>

                          <div className="space-y-3">
                            {getCheck('accelerating-churn')?.details.files.slice(0, 3).map((f: any) => (
                              <div key={f.file} className="bg-zinc-950 p-3 rounded-lg text-xs border border-zinc-950">
                                <span className="block font-semibold text-zinc-100 font-mono truncate">{f.filename}</span>
                                <div className="flex justify-between items-center text-[10px] text-zinc-500 mt-2">
                                  <span>Last 30d: <span className="text-red-400 font-bold">{f.commits30d} edits</span></span>
                                  <span>Prior 60d: <span className="text-zinc-400">{f.commitsPrior60d} edits</span></span>
                                </div>
                              </div>
                            ))}
                            {(!getCheck('accelerating-churn') || getCheck('accelerating-churn')?.details.files.length === 0) && (
                              <p className="text-xs text-zinc-500 italic text-center py-4">No active files are experiencing exploding churn speeds</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Barrel bloat */}
                      {getCheck('barrel-bloat') && (
                        <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6 space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                              <FileCode className="h-4 w-4 text-amber-500" />
                              📦 Barrel Bloat
                            </h3>
                            {getSeverityBadge(getCheck('barrel-bloat')!.severity)}
                          </div>

                          <div className="space-y-3">
                            {getCheck('barrel-bloat')?.details.files.slice(0, 3).map((f: any) => (
                              <div key={f.file} className="bg-zinc-950 p-3 rounded-lg text-xs border border-zinc-950 flex justify-between items-center">
                                <span className="font-semibold text-zinc-100 font-mono truncate max-w-[120px]" title={f.file}>{f.file}</span>
                                <span className="text-[10px] bg-amber-950/20 text-amber-400 border border-amber-900/30 px-2 py-0.5 rounded font-bold font-mono">{f.fanOut} exports</span>
                              </div>
                            ))}
                            {(!getCheck('barrel-bloat') || getCheck('barrel-bloat')?.details.files.length === 0) && (
                              <p className="text-xs text-zinc-500 italic text-center py-4">All module index/barrel files are tidy and compact</p>
                            )}
                          </div>
                        </div>
                      )}

                    </div>

                  </div>
                )}

              </div>
            )}

            {/* Interactive Graph View */}
            {!loading && data && activeTab === 'graph' && (
              <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6 space-y-6">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white font-mono flex items-center gap-1.5">
                      <Network className="h-5 w-5 text-cyan-400" />
                      Interactive Import Graph Map
                    </h3>
                    <p className="text-xs text-zinc-400">Force-directed network of codebase import links. Search nodes, hover details, and drag files to arrange.</p>
                  </div>

                  {/* Search Graph */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input 
                      type="text"
                      placeholder="Search file node..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full md:w-60 pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 text-xs rounded-xl focus:outline-none focus:border-cyan-500 text-zinc-100 placeholder-zinc-500"
                    />
                  </div>
                </div>

                {/* Graph Stage Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                  
                  {/* The SVG Canvas Box */}
                  <div className="xl:col-span-3 bg-zinc-950 rounded-xl border border-zinc-950 relative overflow-hidden h-[500px]">
                    <svg
                      ref={graphContainerRef}
                      className="w-full h-full cursor-grab active:cursor-grabbing"
                      viewBox="0 0 800 500"
                      onMouseMove={handleGraphMouseMove}
                      onMouseUp={handleGraphMouseUp}
                      onMouseLeave={handleGraphMouseUp}
                    >
                      {/* Arrow marker definitions */}
                      <defs>
                        <marker
                          id="arrow"
                          viewBox="0 0 10 10"
                          refX="24"
                          refY="5"
                          markerWidth="6"
                          markerHeight="6"
                          orient="auto-start-reverse"
                        >
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="#3f3f46" />
                        </marker>
                        <marker
                          id="arrow-hover"
                          viewBox="0 0 10 10"
                          refX="24"
                          refY="5"
                          markerWidth="6"
                          markerHeight="6"
                          orient="auto-start-reverse"
                        >
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
                        </marker>
                      </defs>

                      {/* Directed Edge lines */}
                      {data.graph.edges.map((edge, idx) => {
                        const fromNode = nodes.find(n => n.path === edge.from);
                        const toNode = nodes.find(n => n.path === edge.to);

                        if (!fromNode || !toNode) return null;

                        const isFocused = hoveredNode === edge.from || hoveredNode === edge.to || selectedFile === edge.from || selectedFile === edge.to;
                        const strokeColor = isFocused ? '#06b6d4' : '#27272a';
                        const strokeWidth = isFocused ? 2 : 1.2;
                        const strokeDash = edge.isTypeOnly ? '4' : '0';

                        // Draw clean path curved lines
                        const dx = toNode.x - fromNode.x;
                        const dy = toNode.y - fromNode.y;
                        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5; // curvature multiplier

                        return (
                          <path
                            key={idx}
                            d={`M${fromNode.x},${fromNode.y} A${dr},${dr} 0 0,1 ${toNode.x},${toNode.y}`}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            strokeDasharray={strokeDash}
                            markerEnd={isFocused ? 'url(#arrow-hover)' : 'url(#arrow)'}
                            className="transition-all duration-300"
                          />
                        );
                      })}

                      {/* File Nodes */}
                      {filteredNodes.map(node => {
                        const isHovered = hoveredNode === node.path;
                        const isSelected = selectedFile === node.path;
                        const isCycle = getCheck('circular-deps')?.details.cycles.some((c: string[]) => c.includes(node.path));

                        let circleColor = '#18181b'; // zinc-900
                        let strokeColor = '#3f3f46'; // zinc-700
                        let r = 8 + Math.min(node.fanIn * 1.5, 12); // size node by inbound dependencies

                        if (isCycle) {
                          circleColor = '#450a0a'; // red-950
                          strokeColor = '#ef4444'; // red-500
                        } else if (node.hasTest) {
                          circleColor = '#064e3b'; // green-950
                          strokeColor = '#10b981'; // green-500
                        }

                        if (isHovered || isSelected) {
                          strokeColor = '#06b6d4'; // cyan-500
                        }

                        return (
                          <g 
                            key={node.path}
                            className="cursor-pointer select-none"
                            onMouseEnter={() => setHoveredNode(node.path)}
                            onMouseLeave={() => setHoveredNode(null)}
                            onMouseDown={() => handleGraphMouseDown(node.path)}
                            onClick={() => setSelectedFile(node.path === selectedFile ? null : node.path)}
                          >
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={r}
                              fill={circleColor}
                              stroke={strokeColor}
                              strokeWidth={isHovered || isSelected ? 2.5 : 1.5}
                              className="transition-colors duration-200"
                            />
                            {/* Short, elegant filename text centered below node */}
                            <text
                              x={node.x}
                              y={node.y + r + 13}
                              textAnchor="middle"
                              fill={isHovered || isSelected ? '#ffffff' : '#a1a1aa'}
                              fontSize="9.5"
                              fontWeight={isHovered || isSelected ? '600' : '400'}
                              fontFamily="monospace"
                              className="pointer-events-none drop-shadow"
                            >
                              {node.name}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    {/* Stage legends bottom-left */}
                    <div className="absolute bottom-4 left-4 p-3 rounded-lg bg-zinc-900/95 border border-zinc-800 text-[10px] space-y-2 font-mono text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-950 border border-emerald-500" />
                        <span>Stable & Tested File</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-950 border border-red-500" />
                        <span>Part of Circular Cycle</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-zinc-900 border border-zinc-700" />
                        <span>Untested / Standard Module</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-[1px] bg-zinc-500 border-dashed" />
                        <span>Type-Only Import (`import type`)</span>
                      </div>
                    </div>
                  </div>

                  {/* Selected Node Inspector Sidebar */}
                  <div className="xl:col-span-1 bg-zinc-950 rounded-xl border border-zinc-950 p-4 space-y-4 max-h-[500px] overflow-y-auto">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Node Inspector</h4>

                    {selectedFile ? (() => {
                      const node = nodes.find(n => n.path === selectedFile);
                      if (!node) return <p className="text-xs text-zinc-500 italic">Select a file node on the canvas to inspect dependencies.</p>;

                      const isCycle = getCheck('circular-deps')?.details.cycles.some((c: string[]) => c.includes(node.path));
                      const imports = data.graph.edges.filter(e => e.from === node.path);
                      const importedBy = data.graph.edges.filter(e => e.to === node.path);

                      return (
                        <div className="space-y-4">
                          <div>
                            <span className="block text-[10px] uppercase text-zinc-500 font-mono">Filename</span>
                            <h5 className="text-sm font-mono font-bold text-cyan-400 truncate">{node.name}</h5>
                            <span className="block text-[10px] text-zinc-500 font-mono truncate mt-0.5" title={node.path}>{node.path}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 border-t border-b border-zinc-900 py-3 text-center">
                            <div>
                              <span className="block text-[10px] text-zinc-500 font-mono">Lines of Code</span>
                              <span className="text-sm font-mono font-bold text-white">{node.loc}</span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-zinc-500 font-mono">Coverage</span>
                              <span className={`text-xs font-bold font-mono ${node.hasTest ? 'text-emerald-400' : 'text-red-400'}`}>
                                {node.hasTest ? 'Tested' : 'Untested'}
                              </span>
                            </div>
                          </div>

                          {/* Inbound / Outbound counts */}
                          <div className="space-y-3">
                            <div>
                              <span className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-2">Imports ({imports.length})</span>
                              <div className="space-y-1 max-h-24 overflow-y-auto font-mono text-[10px] text-zinc-400 bg-zinc-900/40 p-2 rounded border border-zinc-900">
                                {imports.map((imp, idx) => (
                                  <div key={idx} className="truncate" title={imp.to}>↳ {imp.to.split('/').pop()}</div>
                                ))}
                                {imports.length === 0 && <span className="italic text-zinc-600">Zero imports</span>}
                              </div>
                            </div>

                            <div>
                              <span className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-2">Imported By ({importedBy.length})</span>
                              <div className="space-y-1 max-h-24 overflow-y-auto font-mono text-[10px] text-zinc-400 bg-zinc-900/40 p-2 rounded border border-zinc-900">
                                {importedBy.map((imp, idx) => (
                                  <div key={idx} className="truncate" title={imp.from}>↳ {imp.from.split('/').pop()}</div>
                                ))}
                                {importedBy.length === 0 && <span className="italic text-zinc-600">Zero inbound connections</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="py-12 text-center text-xs text-zinc-600 space-y-2">
                        <HelpCircle className="h-8 w-8 text-zinc-800 mx-auto" />
                        <p className="italic">Click on any file node on the map to inspect its import and export metrics.</p>
                      </div>
                    )}

                  </div>

                </div>

              </div>
            )}

            {/* CLI Terminal Emulator View */}
            {!loading && data && activeTab === 'terminal' && (
              <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white font-mono flex items-center gap-1.5">
                      <Terminal className="h-5 w-5 text-cyan-400" />
                      STANDALONE CLI TERMINAL OUTPUT
                    </h3>
                    <p className="text-xs text-zinc-400">Authentic ANSI shell emulator output computed by `onboard-map` locally</p>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(data.terminalOutput);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-300 transition"
                  >
                    Copy Output
                  </button>
                </div>

                {/* Simulated Terminal Screen */}
                <div className="bg-zinc-950 rounded-xl border border-zinc-950 p-5 font-mono text-xs leading-relaxed overflow-x-auto h-[550px] shadow-inner select-all">
                  <div className="text-zinc-500 mb-4">$ npx onboard-map {isDeepScan ? '--deep' : ''}</div>
                  <pre className="text-zinc-200">
                    {renderAnsi(data.terminalOutput)}
                  </pre>
                </div>
              </div>
            )}

          </div>

        </div>

      </main>

      {/* Subtle Footer */}
      <footer className="mt-16 border-t border-zinc-900/50 py-8 text-center text-zinc-600 text-xs font-mono">
        <p>© 2026 onboard-map · Built as a professional full-stack developer developer utility</p>
      </footer>

    </div>
  );
}
