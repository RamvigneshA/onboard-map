/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';
import { AppImportGraph } from '../services/import-graph.service';

export class CircularDepsCheck implements Check {
  id = 'circular-deps';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const graph = context.importGraph as AppImportGraph;
    const cycles = graph.findCycles();

    const count = cycles.length;
    // Circular imports represent high architectural risk, flag as risk if any exist
    const severity = count > 0 ? 'risk' : 'info';
    const summary = count === 0
      ? 'No value-level circular imports found'
      : `${count} value-level circular import${count === 1 ? '' : 's'} found`;

    return {
      id: this.id,
      title: 'Circular Dependencies',
      severity,
      summary,
      details: {
        cycles,
      },
    };
  }
}
