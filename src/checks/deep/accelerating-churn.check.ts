/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../../models/types';
import { AppImportGraph } from '../../services/import-graph.service';
import * as path from 'path';

export interface AcceleratingChurnResult {
  file: string;
  filename: string;
  commits30d: number;
  commitsPrior60d: number;
  recentRate: number;      // commits per day in last 30 days
  priorRate: number;       // commits per day in prior 60 days
  increaseRatio: number;   // ratio of recent vs. prior
}

export class AcceleratingChurnCheck implements Check {
  id = 'accelerating-churn';
  deep = true;

  async run(context: Context): Promise<CheckResult> {
    const graph = context.importGraph as AppImportGraph;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const activeFiles: AcceleratingChurnResult[] = [];

    for (const file of graph.files) {
      const commits30d = context.gitLog.filter(c => {
        return c.file === file.path && new Date(c.date) >= thirtyDaysAgo;
      }).length;

      const commitsPrior60d = context.gitLog.filter(c => {
        const d = new Date(c.date);
        return c.file === file.path && d >= ninetyDaysAgo && d < thirtyDaysAgo;
      }).length;

      // Establish rates (commits per day)
      const recentRate = commits30d / 30;
      const priorRate = commitsPrior60d / 60;

      // Filter noise: must have at least some minimal recent activity (e.g., >= 3 commits in the last 30 days)
      if (commits30d >= 3 && recentRate > priorRate) {
        const increaseRatio = priorRate === 0 ? commits30d : Math.round((recentRate / priorRate) * 10) / 10;
        
        activeFiles.push({
          file: file.path,
          filename: path.basename(file.path),
          commits30d,
          commitsPrior60d,
          recentRate: Math.round(recentRate * 100) / 100,
          priorRate: Math.round(priorRate * 100) / 100,
          increaseRatio,
        });
      }
    }

    // Sort by increase ratio descending
    activeFiles.sort((a, b) => b.increaseRatio - a.increaseRatio);

    const count = activeFiles.length;
    const severity = count > 0 ? 'warn' : 'info';
    let summary = 'Code modification frequencies are stable';
    if (count > 0) {
      summary = `${count} file${count === 1 ? '' : 's'} experiencing accelerating modification rates (potential instabilty)`;
    }

    return {
      id: this.id,
      title: 'Accelerating Instability',
      severity,
      summary,
      details: {
        files: activeFiles,
      },
    };
  }
}
