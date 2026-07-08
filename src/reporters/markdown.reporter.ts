/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckResult, Reporter } from '../models/types';

export class MarkdownReporter implements Reporter {
  render(
    results: CheckResult[],
    meta: { filesScanned: number; edgeCount: number; durationMs: number; projectName: string; isRealGit: boolean; projectMeta?: any; isDeep?: boolean }
  ): string {
    const lines: string[] = [];
    const getDetails = (id: string) => results.find(r => r.id === id)?.details || {};

    const healthScoreResult = results.find(r => r.id === 'health-score');
    const breakdown = healthScoreResult?.details.scoreBreakdown || { overall: 0, categories: [] };

    // 1 Overview
    lines.push(`# Frontend Health Report: ${meta.projectName}`);
    lines.push('');
    lines.push(`## 1 Overview`);
    lines.push(`- **Project Name:** ${meta.projectName}`);
    lines.push(`- **Overall Health Score:** **${breakdown.overall} / 100**`);
    lines.push(`- **Files Scanned:** ${meta.filesScanned}`);
    lines.push(`- **Import Edges:** ${meta.edgeCount}`);
    lines.push(`- **Scan Duration:** ${(meta.durationMs / 1000).toFixed(1)}s`);
    lines.push('');

    // 2 Architecture
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

    lines.push(`## 2 Architecture`);
    lines.push(`- **Framework:** ${framework}`);
    lines.push(`- **Framework Version:** ${frameworkVersion}`);
    lines.push(`- **Language:** ${language}`);
    lines.push(`- **Language Version:** ${languageVersion}`);
    lines.push('');

    // 3 Tooling
    const buildTool = results.find(r => r.id === 'build-tool')?.summary || 'Unknown';
    const qualityInfo = getDetails('code-quality');
    const testingInfo = getDetails('testing-stack');
    const unitTools = testingInfo.unitTools || [];
    const e2eTools = testingInfo.e2eTools || [];

    lines.push(`## 3 Tooling`);
    lines.push(`- **Build Tool:** ${buildTool}`);
    lines.push(`- **Linting & Formatting:** ESLint (${qualityInfo.hasESLint ? 'Configured' : 'Missing'}), Prettier (${qualityInfo.hasPrettier ? 'Configured' : 'Missing'})`);
    lines.push(`- **Testing Setup:** Unit: ${unitTools.length > 0 ? unitTools.join(', ') : 'None detected'} | E2E: ${e2eTools.length > 0 ? e2eTools.join(', ') : 'None detected'}`);
    lines.push('');

    // 4 Quality
    lines.push(`## 4 Quality`);
    lines.push(`- **TypeScript Strict Mode:** ${tsCheck.strict ? 'Enabled' : 'Disabled'}`);
    lines.push(`- **TypeScript noImplicitAny:** ${tsCheck.noImplicitAny ? 'Enabled' : 'Disabled'}`);
    lines.push(`- **Linter Status:** ESLint configured: ${qualityInfo.hasESLint ? 'Yes' : 'No'}`);
    lines.push(`- **Formatter Status:** Prettier configured: ${qualityInfo.hasPrettier ? 'Yes' : 'No'}`);
    lines.push(`- **Git Hooks (Husky/Lint-Staged):** ${qualityInfo.hasHusky || qualityInfo.hasLintStaged || qualityInfo.hasCommitlint ? 'Configured' : 'Not configured'}`);
    lines.push('');

    // 5 Risks
    const depInfo = getDetails('dependency');
    const securityInfo = getDetails('security');

    lines.push(`## 5 Risks`);
    lines.push(`- **Duplicate Packages:** ${depInfo.duplicateDeps && depInfo.duplicateDeps.length > 0 ? `Detected (${depInfo.duplicateDeps.length} packages)` : 'None detected'}`);
    lines.push(`- **Security Issues:**`);
    lines.push(`  - \`.gitignore\` configured: ${securityInfo.hasGitignore ? 'Yes' : 'No'}`);
    lines.push(`  - \`.env\` files ignored: ${securityInfo.hasEnvIgnored ? 'Yes' : 'No'}`);
    lines.push(`  - Automated security audit: ${securityInfo.hasSecurityConfig ? 'Yes' : 'No'}`);
    lines.push('');

    // 6 Recommendations
    const recsCheck = getDetails('recommendations').recommendations || [];
    lines.push(`## 6 Recommendations`);
    if (recsCheck.length > 0) {
      const criticals = recsCheck.filter((r: any) => r.severity === 'risk');
      const warnings = recsCheck.filter((r: any) => r.severity === 'warn');
      const suggestions = recsCheck.filter((r: any) => r.severity === 'info');

      if (criticals.length > 0) {
        lines.push(`### 🔴 Critical`);
        for (const rec of criticals) {
          lines.push(`- **${rec.title}:** ${rec.why}`);
        }
      }
      if (warnings.length > 0) {
        lines.push(`### 🟡 Warning`);
        for (const rec of warnings) {
          lines.push(`- **${rec.title}:** ${rec.why}`);
        }
      }
      if (suggestions.length > 0) {
        lines.push(`### 🔵 Suggestion`);
        for (const rec of suggestions) {
          lines.push(`- **${rec.title}:** ${rec.why}`);
        }
      }
    } else {
      lines.push(`- No recommendations! Your codebase has perfect health practices.`);
    }
    lines.push('');

    // 7 Score Breakdown
    lines.push(`## 7 Score Breakdown`);
    lines.push('');
    lines.push(`| Category | Score / 10 | Status |`);
    lines.push(`| :--- | :---: | :--- |`);
    if (breakdown.categories) {
      for (const cat of breakdown.categories) {
        const bar = '■'.repeat(Math.round((cat.score / cat.max) * 10)) + '░'.repeat(10 - Math.round((cat.score / cat.max) * 10));
        lines.push(`| ${cat.name} | **${cat.score} / ${cat.max}** | \`${bar}\` |`);
      }
    }
    lines.push('');

    return lines.join('\n');
  }
}
