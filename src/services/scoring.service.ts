/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckResult } from '../models/types';

export interface ScoreCategory {
  name: string;
  score: number;
  max: number;
}

export interface ScoreBreakdown {
  categories: ScoreCategory[];
  overall: number;
}

export class ScoringService {
  static calculate(results: CheckResult[]): ScoreBreakdown {
    const getDetails = (id: string) => results.find(r => r.id === id)?.details || {};

    // 1. Project (max 10)
    let projectScore = 10;
    const projectInfo = getDetails('project-info');
    if (projectInfo.hasGit === false) {
      projectScore -= 2;
    }

    // 2. Framework (max 10)
    let frameworkScore = 5;
    const frameworkInfo = getDetails('framework');
    const frameworks = frameworkInfo.frameworks || [];
    const hasModernFramework = frameworks.some((f: any) => ['React', 'Next.js', 'Angular', 'Vue', 'Svelte', 'Astro', 'Remix'].includes(f.name));
    const hasTS = frameworks.some((f: any) => f.name === 'TypeScript');
    if (hasModernFramework) {
      frameworkScore = hasTS ? 10 : 8;
    }

    // 3. TypeScript (max 10)
    let tsScore = 0;
    const tsInfo = getDetails('typescript');
    if (tsInfo.isInstalled) {
      tsScore += 5;
      if (tsInfo.strict) tsScore += 3;
      if (tsInfo.noImplicitAny) tsScore += 2;
    }

    // 4. Code Quality (max 10)
    let qualityScore = 0;
    const qualityInfo = getDetails('code-quality');
    if (qualityInfo.hasESLint) qualityScore += 5;
    if (qualityInfo.hasPrettier) qualityScore += 3;
    if (qualityInfo.hasHusky || qualityInfo.hasLintStaged || qualityInfo.hasCommitlint) {
      qualityScore += 2;
    }

    // 5. Testing (max 15)
    let testingScore = 0;
    const testingInfo = getDetails('testing-stack');
    const unitTools = testingInfo.unitTools || [];
    const e2eTools = testingInfo.e2eTools || [];
    if (unitTools.includes('Vitest') || unitTools.includes('Jest')) {
      testingScore += 10;
    }
    if (unitTools.includes('React Testing Library')) {
      testingScore += 2;
    }
    if (e2eTools.length > 0) {
      testingScore += 3;
    }

    // 6. Deployment (max 10)
    let deploymentScore = 5;
    const deploymentInfo = getDetails('deployment');
    if (deploymentInfo.platforms && deploymentInfo.platforms.length > 0) {
      deploymentScore = 10;
    }

    // 7. CI/CD (max 10)
    let cicdScore = 0;
    const cicdInfo = getDetails('ci-cd');
    if (cicdInfo.hasCi) {
      cicdScore = 10;
    }

    // 8. Documentation (max 10)
    let docScore = 0;
    const docInfo = getDetails('documentation');
    if (docInfo.hasReadme) docScore += 5;
    if (docInfo.hasLicense) docScore += 2;
    if (docInfo.hasChangelog) docScore += 2;
    if (docInfo.hasContributing) docScore += 1;

    // 9. Security (max 5)
    let securityScore = 5;
    const envInfo = getDetails('environment');
    const envMismatchInfo = getDetails('env-mismatch');
    if (envMismatchInfo.missingVars && envMismatchInfo.missingVars.length > 0) {
      securityScore -= 2;
    }
    if (!envInfo.hasEnvExample) {
      securityScore -= 2;
    }
    securityScore = Math.max(0, securityScore);

    // 10. Structure (max 10)
    let structureScore = 0;
    const structInfo = getDetails('project-structure');
    if (structInfo.src) structureScore += 2;
    if (structInfo.components) structureScore += 2;
    if (structInfo.hooks) structureScore += 2;
    if (structInfo.lib || structInfo.utils) structureScore += 2;
    if (structInfo.tests) structureScore += 2;

    const categories: ScoreCategory[] = [
      { name: 'Project', score: projectScore, max: 10 },
      { name: 'Framework', score: frameworkScore, max: 10 },
      { name: 'TypeScript', score: tsScore, max: 10 },
      { name: 'Quality', score: qualityScore, max: 10 },
      { name: 'Testing', score: testingScore, max: 15 },
      { name: 'Deployment', score: deploymentScore, max: 10 },
      { name: 'CI/CD', score: cicdScore, max: 10 },
      { name: 'Documentation', score: docScore, max: 10 },
      { name: 'Security', score: securityScore, max: 5 },
      { name: 'Structure', score: structureScore, max: 10 },
    ];

    const totalEarned = categories.reduce((sum, cat) => sum + cat.score, 0);
    const totalMax = categories.reduce((sum, cat) => sum + cat.max, 0); // Should be 100

    return {
      categories,
      overall: Math.round((totalEarned / totalMax) * 100),
    };
  }
}
