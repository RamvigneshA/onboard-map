/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../../models/types';
import { AppImportGraph } from '../../services/import-graph.service';
import * as path from 'path';

export interface BarrelBloatResult {
  file: string;
  filename: string;
  fanOut: number;
}

export class BarrelBloatCheck implements Check {
  id = 'barrel-bloat';
  deep = true;

  async run(context: Context): Promise<CheckResult> {
    const graph = context.importGraph as AppImportGraph;
    const bloatThreshold = 10; // flag index files with >= 10 outbound edges

    const bloatedBarrels: BarrelBloatResult[] = [];

    for (const file of graph.files) {
      const isIndexFile = path.basename(file.path).startsWith('index.');
      if (!isIndexFile) continue;

      const fanOut = graph.fanOut(file.path);
      if (fanOut >= bloatThreshold) {
        bloatedBarrels.push({
          file: file.path,
          filename: path.basename(file.path),
          fanOut,
        });
      }
    }

    // Sort by fan-out descending
    bloatedBarrels.sort((a, b) => b.fanOut - a.fanOut);

    const count = bloatedBarrels.length;
    const severity = count > 0 ? 'warn' : 'info';
    let summary = 'No bloated barrel files detected';
    if (count > 0) {
      summary = `${count} index/barrel file${count === 1 ? '' : 's'} re-exporting more than ${bloatThreshold} modules`;
    }

    return {
      id: this.id,
      title: 'Barrel File Bloat',
      severity,
      summary,
      details: {
        files: bloatedBarrels,
        threshold: bloatThreshold,
      },
    };
  }
}
