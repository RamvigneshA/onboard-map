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

    const entryCandidates = context.projectMeta.entryPoints;

    const deadEnds = graph.files.filter(f => {
      // Must have 0 inbound imports (fan-in is 0)
      const hasNoInbound = graph.fanIn(f.path) === 0;
      
      // Must not be an entry point candidate
      const isEntry = entryCandidates.includes(f.path);
      if (isEntry) return false;

      // Must not be a test file or inside test/spec directories
      const lowercasePath = f.path.toLowerCase();
      const isTestFile = lowercasePath.includes('.test.') || 
                         lowercasePath.includes('.spec.') || 
                         lowercasePath.split('/').some(part => ['test', 'tests', 'spec', 'specs', '__tests__'].includes(part));
      if (isTestFile) return false;

      // Must not be a config file (e.g. vite.config.ts, tailwind.config.js, etc.)
      const isConfig = lowercasePath.includes('.config.');
      if (isConfig) return false;

      return hasNoInbound;
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
