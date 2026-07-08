/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';
import { AppImportGraph } from '../services/import-graph.service';
import * as path from 'path';

export class EntryPathCheck implements Check {
  id = 'entry-path';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const graph = context.importGraph as AppImportGraph;
    
    // Identify entry point candidates dynamically from project metadata
    const candidates = context.projectMeta.entryPoints;

    let entryPoint = '';
    for (const cand of candidates) {
      if (graph.files.some(f => f.path === cand)) {
        entryPoint = cand;
        break;
      }
    }

    if (!entryPoint && graph.files.length > 0) {
      // Fallback: pick the one with 0 fan-in and highest fan-out
      const roots = graph.files.filter(f => graph.fanIn(f.path) === 0);
      if (roots.length > 0) {
        roots.sort((a, b) => graph.fanOut(b.path) - graph.fanOut(a.path));
        entryPoint = roots[0].path;
      } else {
        // Just pick the first file
        entryPoint = graph.files[0].path;
      }
    }

    const pathChain: string[] = [];
    if (entryPoint) {
      pathChain.push(entryPoint);
      let current = entryPoint;
      const visited = new Set<string>([current]);

      // Walk up to 5 steps following the highest fan-out child to build a typical flow
      for (let i = 0; i < 4; i++) {
        const edges = graph.getEdgesFrom(current);
        if (edges.length === 0) break;

        // Sort children by fan-out descending to pick the most significant path
        const nextEdges = [...edges]
          .filter(e => !visited.has(e.to))
          .sort((a, b) => graph.fanOut(b.to) - graph.fanOut(a.to));

        if (nextEdges.length === 0) break;
        current = nextEdges[0].to;
        visited.add(current);
        pathChain.push(current);
      }
    }

    const summary = pathChain.length > 0
      ? `Main entry path identified: ${pathChain.map(p => path.basename(p)).join(' → ')}`
      : 'No entry path identified';

    return {
      id: this.id,
      title: 'Start Here',
      severity: 'info',
      summary,
      details: {
        entryPoint,
        chain: pathChain,
      },
    };
  }
}
