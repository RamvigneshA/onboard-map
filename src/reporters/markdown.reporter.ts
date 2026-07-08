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

    lines.push(`# Onboard Map Health Report: ${meta.projectName}`);
    lines.push('');
    lines.push(`## Analysis Metadata`);
    lines.push(`- **Files Scanned:** ${meta.filesScanned}`);
    lines.push(`- **Import Edges:** ${meta.edgeCount}`);
    lines.push(`- **Duration:** ${(meta.durationMs / 1000).toFixed(1)}s`);
    lines.push(`- **Deep Analysis:** ${meta.isDeep ? 'Enabled' : 'Disabled'}`);
    lines.push(`- **Git Repository:** ${meta.isRealGit ? 'Present' : 'Absent (using simulated history)'}`);
    lines.push('');

    // Render health score first if present
    const healthScoreResult = results.find(r => r.id === 'health-score');
    if (healthScoreResult) {
      const breakdown = healthScoreResult.details.scoreBreakdown;
      lines.push(`## Frontend Health Score: **${breakdown.overall} / 100**`);
      lines.push('');
      lines.push(`| Category | Score | Visual |`);
      lines.push(`| :--- | :---: | :--- |`);
      for (const cat of breakdown.categories) {
        const bar = '■'.repeat(Math.round((cat.score / cat.max) * 10)) + '░'.repeat(10 - Math.round((cat.score / cat.max) * 10));
        lines.push(`| ${cat.name} | **${cat.score} / ${cat.max}** | \`${bar}\` |`);
      }
      lines.push('');
    }

    // Render recommendations if present
    const recsResult = results.find(r => r.id === 'recommendations');
    if (recsResult) {
      const recommendations = recsResult.details.recommendations;
      if (recommendations && recommendations.length > 0) {
        lines.push(`## Actionable Recommendations`);
        lines.push('');
        for (const rec of recommendations) {
          const icon = rec.severity === 'risk' ? '🔴' : rec.severity === 'warn' ? '🟡' : '🔵';
          lines.push(`### ${icon} ${rec.title}`);
          lines.push(`*Why:* ${rec.why}`);
          lines.push('');
        }
      }
    }

    lines.push(`## Detailed Check Findings`);
    lines.push('');

    for (const res of results) {
      // Skip score and recommendations since we displayed them prominently above
      if (res.id === 'health-score' || res.id === 'recommendations') {
        continue;
      }

      const severityIcon = res.severity === 'risk' ? '🔴' : res.severity === 'warn' ? '🟡' : '🟢';
      lines.push(`### ${severityIcon} ${res.title}`);
      lines.push(`**Summary:** ${res.summary}`);
      lines.push('');

      if (res.id === 'entry-path') {
        const chain = res.details.chain as string[];
        if (chain && chain.length > 0) {
          lines.push(`**Suggested Starting Sequence:**`);
          lines.push(`\`\`\``);
          lines.push(chain.join(' → '));
          lines.push(`\`\`\``);
          lines.push('');
        }
      }

      else if (res.id === 'reading-path-by-feature') {
        const features = res.details.features as { folder: string; chain: string[] }[];
        if (features && features.length > 0) {
          lines.push(`**Feature-by-Feature Entry Paths:**`);
          lines.push('');
          for (const feat of features) {
            lines.push(`- **${feat.folder}:** \`${feat.chain.join(' → ')}\``);
          }
          lines.push('');
        }
      }

      else if (res.id === 'high-risk') {
        const files = res.details.files as any[];
        if (files && files.length > 0) {
          lines.push(`| File | Imports (Fan-In) | Changes / 90d | Status |`);
          lines.push(`| :--- | :---: | :---: | :--- |`);
          for (const f of files) {
            lines.push(`| \`${f.filename}\` | ${f.fanIn} | ${f.changes90d} | ${f.hasTest ? 'Tested' : 'No Tests'} |`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'circular-deps') {
        const cycles = res.details.cycles as string[][];
        if (cycles && cycles.length > 0) {
          lines.push(`**Detected Cycles:**`);
          for (const cycle of cycles) {
            lines.push(`- \`${cycle.join(' → ')}\``);
          }
          lines.push('');
        }
      }

      else if (res.id === 'project-info') {
        lines.push(`- **Package Name:** \`${res.details.name}\``);
        lines.push(`- **Version:** \`${res.details.version}\``);
        lines.push(`- **Package Manager:** \`${res.details.packageManager}\``);
        lines.push(`- **Node Engine:** \`${res.details.nodeVersion || 'Not specified'}\``);
        lines.push(`- **Monorepo:** \`${res.details.workspaceType}\``);
        lines.push('');
      }

      else if (res.id === 'typescript') {
        if (res.details.isInstalled) {
          lines.push(`- **Installed:** Yes`);
          lines.push(`- **Strict Compiler Option:** \`${res.details.strict ? 'Enabled' : 'Disabled'}\``);
          lines.push(`- **No Implicit Any:** \`${res.details.noImplicitAny ? 'Enabled' : 'Disabled'}\``);
        } else {
          lines.push(`TypeScript is not configured in this codebase.`);
        }
        lines.push('');
      }

      else if (res.id === 'testing-stack') {
        const unit = res.details.unitTools || [];
        const e2e = res.details.e2eTools || [];
        lines.push(`- **Unit / Component Testing:** ${unit.length > 0 ? unit.join(', ') : 'None detected'}`);
        lines.push(`- **E2E Testing:** ${e2e.length > 0 ? e2e.join(', ') : 'None detected'}`);
        lines.push('');
      }

      else if (res.id === 'code-quality') {
        lines.push(`- **Linter (ESLint):** ${res.details.hasESLint ? 'Configured' : 'Not configured'}`);
        lines.push(`- **Formatter (Prettier):** ${res.details.hasPrettier ? 'Configured' : 'Not configured'}`);
        lines.push(`- **Husky Git Hooks:** ${res.details.hasHusky ? 'Configured' : 'Not configured'}`);
        lines.push('');
      }

      else if (res.id === 'dependency') {
        lines.push(`- **Total Declared Packages:** ${res.details.totalDeps}`);
        lines.push(`- **Production Dependencies:** ${res.details.totalProd}`);
        lines.push(`- **Development Dependencies:** ${res.details.totalDev}`);
        if (res.details.isDeep) {
          if (res.details.unusedDeps && res.details.unusedDeps.length > 0) {
            lines.push(`- **Unused Production Packages:**`);
            for (const d of res.details.unusedDeps) {
              lines.push(`  - \`${d}\``);
            }
          }
          if (res.details.duplicateDeps && res.details.duplicateDeps.length > 0) {
            lines.push(`- **Duplicated packages (Prod & Dev):**`);
            for (const d of res.details.duplicateDeps) {
              lines.push(`  - \`${d}\``);
            }
          }
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
