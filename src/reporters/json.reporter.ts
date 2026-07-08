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
    const getDetails = (id: string) => results.find(r => r.id === id)?.details || {};

    const frameworkInfo = getDetails('framework').frameworks || [];
    const primaryFramework = frameworkInfo.find((f: any) =>
      ['React', 'Next.js', 'Angular', 'Vue', 'Svelte', 'Astro', 'Remix'].includes(f.name)
    ) || frameworkInfo[0];
    const framework = primaryFramework?.name || 'Unknown';
    const frameworkVersion = primaryFramework?.version || 'Unknown';

    const tsCheck = getDetails('typescript');
    const language = tsCheck.isInstalled ? 'TypeScript' : 'JavaScript';
    const tsFramework = frameworkInfo.find((f: any) => f.name === 'TypeScript');
    const languageVersion = tsFramework?.version || 'Unknown';

    const scoreCheck = getDetails('health-score').scoreBreakdown || {};
    const categories: Record<string, number> = {};
    if (scoreCheck.categories) {
      for (const cat of scoreCheck.categories) {
        categories[cat.name.toLowerCase()] = cat.score;
      }
    }
    const score = scoreCheck.overall !== undefined ? scoreCheck.overall : 0;

    const recsCheck = getDetails('recommendations').recommendations || [];
    const recommendations = recsCheck.map((rec: any) => {
      const severity = rec.severity === 'risk' ? 'Critical' : rec.severity === 'warn' ? 'Warning' : 'Suggestion';
      return {
        severity,
        title: rec.title,
        why: rec.why,
      };
    });

    const output = {
      scannedFiles: meta.filesScanned,
      projectName: meta.projectName,
      score,
      framework,
      frameworkVersion,
      language,
      languageVersion,
      categories,
      recommendations,
    };

    return JSON.stringify(output, null, 2);
  }
}
