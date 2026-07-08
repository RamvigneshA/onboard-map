/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class CodeQualityCheck implements Check {
  id = 'code-quality';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const pkgJson = context.packageJson || {};
    const dependencies = (pkgJson.dependencies as Record<string, string>) || {};
    const devDependencies = (pkgJson.devDependencies as Record<string, string>) || {};
    const allDeps = { ...dependencies, ...devDependencies };

    // 1. Detect ESLint
    let hasESLint = !!allDeps['eslint'];
    if (!hasESLint) {
      const files = fs.readdirSync(context.rootDir);
      hasESLint = files.some(f => f.startsWith('eslint.config.') || f.startsWith('.eslintrc'));
    }

    // 2. Detect Prettier
    let hasPrettier = !!allDeps['prettier'];
    if (!hasPrettier) {
      const files = fs.readdirSync(context.rootDir);
      hasPrettier = files.some(f => f.startsWith('.prettierrc') || f === 'prettier.config.js' || f === 'prettier.config.cjs' || f === 'prettier.config.mjs');
    }

    // 3. Detect Git Hooks
    const hasHusky = !!allDeps['husky'] || fs.existsSync(path.join(context.rootDir, '.husky'));
    const hasLintStaged = !!allDeps['lint-staged'];
    const hasCommitlint = !!allDeps['commitlint'] || !!allDeps['@commitlint/cli'] || fs.readdirSync(context.rootDir).some(f => f.startsWith('commitlint.config.'));

    const qualityTools: string[] = [];
    if (hasESLint) qualityTools.push('ESLint');
    if (hasPrettier) qualityTools.push('Prettier');
    if (hasHusky) qualityTools.push('Husky');
    if (hasLintStaged) qualityTools.push('Lint-staged');
    if (hasCommitlint) qualityTools.push('Commitlint');

    const summary = qualityTools.length > 0
      ? `${qualityTools.join(', ')} configured`
      : 'No standard linting or formatting tools detected';

    const severity = (hasESLint && hasPrettier) ? 'info' : 'warn';

    return {
      id: this.id,
      title: 'Code Quality',
      severity,
      summary,
      details: {
        hasESLint,
        hasPrettier,
        hasHusky,
        hasLintStaged,
        hasCommitlint,
        qualityTools,
      },
    };
  }
}
