/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckResult, Reporter } from '../models/types';

export class JsonReporter implements Reporter {
  render(
    results: CheckResult[],
    meta: { filesScanned: number; edgeCount: number; durationMs: number; projectName: string; projectMeta?: any; isDeep?: boolean }
  ): string {
    const output = {
      meta: {
        project: meta.projectName,
        filesScanned: meta.filesScanned,
        importEdges: meta.edgeCount,
        durationMs: meta.durationMs,
        projectMeta: meta.projectMeta,
      },
      results: results.map(res => ({
        id: res.id,
        title: res.title,
        severity: res.severity,
        summary: res.summary,
        details: res.details,
      })),
    };

    return JSON.stringify(output, null, 2);
  }
}
