/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';
import { AppImportGraph } from '../services/import-graph.service';
import * as path from 'path';

export interface SafeToPracticeResult {
  file: string;
  filename: string;
  fanIn: number;
  changes90d: number;
  hasTest: boolean;
}

export class SafeToPracticeCheck implements Check {
  id = 'safe-to-practice';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const graph = context.importGraph as AppImportGraph;
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const safeFiles: SafeToPracticeResult[] = [];

    for (const file of graph.files) {
      // Must have test file to be safe
      if (!file.hasTestFile) continue;

      const fanIn = graph.fanIn(file.path);
      // Low blast radius constraint: fanIn must be low
      if (fanIn > 2) continue;

      // Calculate churn
      const changes90d = context.gitLog.filter(c => {
        return c.file === file.path && new Date(c.date) >= ninetyDaysAgo;
      }).length;

      // Low churn constraint: stable
      if (changes90d > 3) continue;

      safeFiles.push({
        file: file.path,
        filename: path.basename(file.path),
        fanIn,
        changes90d,
        hasTest: true,
      });
    }

    // Sort by fan-in ascending, then changes90d ascending
    const sortedSafe = safeFiles
      .sort((a, b) => {
        if (a.fanIn !== b.fanIn) return a.fanIn - b.fanIn;
        return a.changes90d - b.changes90d;
      })
      .slice(0, 5); // top 5 safe components

    const count = sortedSafe.length;
    const summary = count > 0
      ? `Found ${count} stable, tested component${count === 1 ? '' : 's'} with low blast radius`
      : 'No highly isolated and tested files identified';

    return {
      id: this.id,
      title: 'Safe to Practice On',
      severity: 'info',
      summary,
      details: {
        files: sortedSafe,
      },
    };
  }
}
