/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../../models/types';
import { AppImportGraph } from '../../services/import-graph.service';
import * as path from 'path';

export interface DeepImportChainResult {
  file: string;
  filename: string;
  depth: number;
}

export class DeepImportChainsCheck implements Check {
  id = 'deep-import-chains';
  deep = true;

  async run(context: Context): Promise<CheckResult> {
    const graph = context.importGraph as AppImportGraph;
    const maxAllowedDepth = 5; // flag files with depth >= 5

    // Find entry point candidates
    const candidates = [
      'src/main.tsx',
      'src/main.ts',
      'src/index.tsx',
      'src/index.ts',
      'src/App.tsx',
    ];
    const entryPoints = candidates.filter(c => graph.files.some(f => f.path === c));

    if (entryPoints.length === 0 && graph.files.length > 0) {
      // Pick first root
      const roots = graph.files.filter(f => graph.fanIn(f.path) === 0);
      if (roots.length > 0) {
        entryPoints.push(roots[0].path);
      } else {
        entryPoints.push(graph.files[0].path);
      }
    }

    // Get BFS levels with higher max depth for tracking
    const depths = graph.getBfsLevels(entryPoints, 15);
    const deepChains: DeepImportChainResult[] = [];

    for (const [file, depth] of depths.entries()) {
      if (depth >= maxAllowedDepth) {
        deepChains.push({
          file,
          filename: path.basename(file),
          depth,
        });
      }
    }

    // Sort by depth descending
    deepChains.sort((a, b) => b.depth - a.depth);

    const count = deepChains.length;
    const severity = count > 0 ? 'warn' : 'info';
    let summary = 'Code nesting is well-structured and shallow';
    if (count > 0) {
      summary = `${count} file${count === 1 ? '' : 's'} are deeply nested (${maxAllowedDepth}+ hops from entry point)`;
    }

    return {
      id: this.id,
      title: 'Deep Import Chains',
      severity,
      summary,
      details: {
        files: deepChains,
        threshold: maxAllowedDepth,
      },
    };
  }
}
