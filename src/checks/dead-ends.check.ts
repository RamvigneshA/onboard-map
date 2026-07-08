/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';
import { AppImportGraph } from '../services/import-graph.service';
import * as path from 'path';

export class DeadEndsCheck implements Check {
  id = 'dead-ends';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const graph = context.importGraph as AppImportGraph;

    const entryCandidates = [
      'src/main.tsx',
      'src/main.ts',
      'src/index.tsx',
      'src/index.ts',
      'index.html',
      'src/App.tsx',
    ];

    const deadEnds = graph.files.filter(f => {
      // Must have 0 inbound imports (fan-in is 0)
      const hasNoInbound = graph.fanIn(f.path) === 0;
      // Must not be an entry point candidate
      const isEntry = entryCandidates.includes(f.path);
      return hasNoInbound && !isEntry;
    });

    const count = deadEnds.length;
    // Dead ends are warnings because they represent clutter, but not immediately critical failures
    const severity = count > 0 ? 'warn' : 'info';
    const summary = count === 0
      ? 'No unused files detected'
      : `${count} unused file${count === 1 ? '' : 's'} with 0 inbound imports`;

    return {
      id: this.id,
      title: 'Unused Files',
      severity,
      summary,
      details: {
        files: deadEnds.map(f => ({
          path: f.path,
          filename: path.basename(f.path),
          loc: f.loc,
        })),
      },
    };
  }
}
