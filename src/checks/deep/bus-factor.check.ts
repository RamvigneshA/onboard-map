/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../../models/types';
import { AppImportGraph } from '../../services/import-graph.service';
import * as path from 'path';

export interface BusFactorResult {
  file: string;
  filename: string;
  topAuthor: string;
  percentage: number;
  totalCommits: number;
  commitCount: number;
}

export class BusFactorCheck implements Check {
  id = 'bus-factor';
  deep = true;

  async run(context: Context): Promise<CheckResult> {
    const graph = context.importGraph as AppImportGraph;
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const risks: BusFactorResult[] = [];

    for (const file of graph.files) {
      // Find all commits in the last 12 months for this file
      const fileCommits = context.gitLog.filter(c => {
        return c.file === file.path && new Date(c.date) >= oneYearAgo;
      });

      const totalCommits = fileCommits.length;
      if (totalCommits < 5) continue; // skip files with too few commits to establish bus factor

      // Count by author
      const authorMap = new Map<string, number>();
      for (const commit of fileCommits) {
        authorMap.set(commit.author, (authorMap.get(commit.author) || 0) + 1);
      }

      // Find top author
      let topAuthor = 'Unknown';
      let maxCommits = 0;
      for (const [author, count] of authorMap.entries()) {
        if (count > maxCommits) {
          maxCommits = count;
          topAuthor = author;
        }
      }

      const percentage = Math.round((maxCommits / totalCommits) * 100);

      // Flag if top author holds 75% or more of commits
      if (percentage >= 75) {
        risks.push({
          file: file.path,
          filename: path.basename(file.path),
          topAuthor,
          percentage,
          totalCommits,
          commitCount: maxCommits,
        });
      }
    }

    // Sort by percentage descending, then total commits descending
    risks.sort((a, b) => b.percentage - a.percentage || b.totalCommits - a.totalCommits);

    const count = risks.length;
    const severity = count > 0 ? 'risk' : 'info';
    let summary = 'Codebase knowledge is well-distributed';
    if (count > 0) {
      summary = `${count} high-impact file${count === 1 ? '' : 's'} with high bus-factor risk (knowledge silos)`;
    }

    return {
      id: this.id,
      title: 'Bus Factor Risk',
      severity,
      summary,
      details: {
        files: risks,
      },
    };
  }
}
