/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckResult } from '../models/types';

export interface Recommendation {
  id: string;
  title: string;
  why: string;
  severity: 'info' | 'warn' | 'risk';
}

export class RecommendationService {
  static generate(results: CheckResult[]): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const getDetails = (id: string) => results.find(r => r.id === id)?.details || {};

    // 1. TypeScript Strict Mode
    const tsInfo = getDetails('typescript');
    if (tsInfo.isInstalled && !tsInfo.strict) {
      recommendations.push({
        id: 'enable-ts-strict',
        title: 'Enable TypeScript strict mode',
        why: 'Strict mode catches common runtime bugs and null/undefined issues earlier during compilation.',
        severity: 'warn',
      });
    }

    // 2. React Testing Library
    const testingInfo = getDetails('testing-stack');
    const unitTools = testingInfo.unitTools || [];
    const hasRtl = unitTools.includes('React Testing Library');
    if (testingInfo.hasUnit && !hasRtl) {
      recommendations.push({
        id: 'add-rtl',
        title: 'Add React Testing Library',
        why: 'No component behavior coverage detected. RTL validates your components from the user\'s perspective.',
        severity: 'info',
      });
    }

    // 3. CI/CD / GitHub Actions
    const cicdInfo = getDetails('ci-cd');
    if (!cicdInfo.hasCi) {
      recommendations.push({
        id: 'add-github-actions',
        title: 'Add GitHub Actions CI/CD workflows',
        why: 'No automated validation on pull requests detected. CI/CD protects your master branch from failing builds.',
        severity: 'warn',
      });
    }

    // 4. Missing env.example
    const envInfo = getDetails('environment');
    if (!envInfo.hasEnvExample) {
      recommendations.push({
        id: 'add-env-example',
        title: 'Create a .env.example template',
        why: 'Documenting environment variables is critical for onboarding team members and protecting real secrets.',
        severity: 'warn',
      });
    }

    // 5. Env Mismatch / Missing variables
    const envMismatchInfo = getDetails('env-mismatch');
    if (envMismatchInfo.missingVars && envMismatchInfo.missingVars.length > 0) {
      recommendations.push({
        id: 'fix-env-mismatch',
        title: 'Sync .env.example with active local keys',
        why: `We found ${envMismatchInfo.missingVars.length} variables used in your code but missing from .env.example.`,
        severity: 'risk',
      });
    }

    // 6. No README
    const docInfo = getDetails('documentation');
    if (!docInfo.hasReadme) {
      recommendations.push({
        id: 'add-readme',
        title: 'Create a comprehensive README.md',
        why: 'A README provides the visual portal, architecture description, and setup guide for developers.',
        severity: 'risk',
      });
    }

    // 7. No LICENSE
    if (docInfo.hasReadme && !docInfo.hasLicense) {
      recommendations.push({
        id: 'add-license',
        title: 'Add an open-source LICENSE file',
        why: 'Without a LICENSE file, your project defaults to strict all-rights-reserved copyright protections.',
        severity: 'info',
      });
    }

    // 8. Quality tools missing
    const qualityInfo = getDetails('code-quality');
    if (!qualityInfo.hasESLint || !qualityInfo.hasPrettier) {
      recommendations.push({
        id: 'configure-lint-format',
        title: 'Configure both ESLint & Prettier',
        why: 'Automated code standards catch common anti-patterns and enforce uniform formatting team-wide.',
        severity: 'warn',
      });
    }

    // 9. Structure tests missing
    const structInfo = getDetails('project-structure');
    if (!structInfo.tests) {
      recommendations.push({
        id: 'add-tests-dir',
        title: 'Add a dedicated tests/ directory',
        why: 'No central test suite folder found. Grouping tests keeps your directory structure clean.',
        severity: 'info',
      });
    }

    // 10. Duplicate dependencies
    const depInfo = getDetails('dependency');
    if (depInfo.duplicateDeps && depInfo.duplicateDeps.length > 0) {
      recommendations.push({
        id: 'remove-duplicate-deps',
        title: `Remove ${depInfo.duplicateDeps.length} duplicate packages`,
        why: `Packages like ${depInfo.duplicateDeps.slice(0, 2).join(', ')} are declared in both dependencies and devDependencies.`,
        severity: 'warn',
      });
    }

    // 11. Unused dependencies
    if (depInfo.unusedDeps && depInfo.unusedDeps.length > 0) {
      recommendations.push({
        id: 'clean-unused-deps',
        title: `Prune ${depInfo.unusedDeps.length} unused dependencies`,
        why: `Unused packages like ${depInfo.unusedDeps.slice(0, 2).join(', ')} bloat build times and dependency trees.`,
        severity: 'info',
      });
    }

    return recommendations;
  }
}
