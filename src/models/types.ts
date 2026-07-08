/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FileNode {
  path: string;          // relative to project root
  loc: number;
  hasTestFile: boolean;
}

export interface ImportEdge {
  from: string;
  to: string;
  isTypeOnly: boolean;   // distinguish type-only imports — they don't count as real circular risk
}

export interface ImportGraph {
  files: FileNode[];
  edges: ImportEdge[];
  fanIn(file: string): number;
  fanOut(file: string): number;
}

export interface GitCommit {
  file: string;
  author: string;
  date: string;
  message: string;
}

export interface Context {
  rootDir: string;
  importGraph: ImportGraph;
  gitLog: GitCommit[];
  packageJson: Record<string, unknown> | null;
  readmeContent: string | null;
  envExampleKeys: string[];
}

export type Severity = 'info' | 'warn' | 'risk';

export interface CheckResult {
  id: string;                          // e.g. 'circular-deps'
  title: string;                       // e.g. 'Circular Dependencies'
  severity: Severity;
  summary: string;                     // one-line human summary
  details: Record<string, any>;        // check-specific payload
}

export interface Check {
  id: string;
  deep: boolean;                       // true = only runs with --deep
  run(context: Context): Promise<CheckResult>;
}

export interface Reporter {
  render(results: CheckResult[], meta: { filesScanned: number; edgeCount: number; durationMs: number }): string;
}
