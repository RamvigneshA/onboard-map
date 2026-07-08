/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../../models/types';
import { AppImportGraph } from '../../services/import-graph.service';
import * as path from 'path';

export interface CouplingHotspotResult {
  file: string;
  filename: string;
  fanIn: number;
  fanOut: number;
  score: number;
}

export class CouplingHotspotsCheck implements Check {
  id = 'coupling-hotspots';
  deep = true;

  async run(context: Context): Promise<CheckResult> {
    const graph = context.importGraph as AppImportGraph;

    const hotspots: CouplingHotspotResult[] = graph.files
      .map(file => {
        const fanIn = graph.fanIn(file.path);
        const fanOut = graph.fanOut(file.path);
        return {
          file: file.path,
          filename: path.basename(file.path),
          fanIn,
          fanOut,
          score: fanIn * fanOut,
        };
      })
      .filter(h => h.fanIn >= 3 && h.fanOut >= 8)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const count = hotspots.length;
    const severity = count > 0 ? 'risk' : 'info';
    let summary = 'No high-coupling hotspots detected';
    if (count > 0) {
      summary = `${count} high-coupling hotspot${count === 1 ? '' : 's'} identified (high refactor blast radius)`;
    }

    return {
      id: this.id,
      title: 'Coupling Hotspots',
      severity,
      summary,
      details: {
        hotspots,
      },
    };
  }
}
