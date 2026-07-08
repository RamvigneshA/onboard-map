/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';
import { AppImportGraph } from '../services/import-graph.service';
import * as path from 'path';

export interface HighRiskFileResult {
  file: string;
  filename: string;
  fanIn: number;
  changes90d: number;
  hasTest: boolean;
  riskScore: number;
}

export class HighRiskCheck implements Check {
  id = 'high-risk';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const graph = context.importGraph as AppImportGraph;
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const results: HighRiskFileResult[] = [];

    for (const file of graph.files) {
      const fanIn = graph.fanIn(file.path);
      
      // Calculate churn (commits in the last 90 days)
      const fileCommits = context.gitLog.filter(c => {
        return c.file === file.path && new Date(c.date) >= ninetyDaysAgo;
      });
      const changes90d = fileCommits.length;

      // test absence factor: 2 if no tests, 1 if has tests
      const testAbsenceFactor = file.hasTestFile ? 1 : 2;
      const riskScore = fanIn * changes90d * testAbsenceFactor;

      results.push({
        file: file.path,
        filename: path.basename(file.path),
        fanIn,
        changes90d,
        hasTest: file.hasTestFile,
        riskScore,
      });
    }

    // Sort by risk score descending
    // Filter to only include files with fanIn >= 3, positive churn, and no tests
    const sortedRisks = results
      .filter(r => r.fanIn >= 3 && r.changes90d > 0 && !r.hasTest)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5); // top 5 high risk files

    const riskCount = sortedRisks.length;
    const severity = riskCount > 0 ? 'risk' : 'info';
    
    let summary = 'No high-risk files identified';
    if (riskCount > 0) {
      summary = `${riskCount} file${riskCount === 1 ? '' : 's'} with high fan-in, high churn, and no tests`;
    }

    return {
      id: this.id,
      title: 'High Risk',
      severity,
      summary,
      details: {
        files: sortedRisks,
      },
    };
  }
}
