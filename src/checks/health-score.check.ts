/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';
import { ScoringService } from '../services/scoring.service';

// Sub-checks for scoring
import { ProjectInfoCheck } from './project-info.check';
import { FrameworkCheck } from './framework.check';
import { TypeScriptCheck } from './typescript.check';
import { CodeQualityCheck } from './code-quality.check';
import { TestingStackCheck } from './testing-stack.check';
import { DeploymentCheck } from './deployment.check';
import { CiCdCheck } from './ci-cd.check';
import { DocumentationCheck } from './documentation.check';
import { EnvironmentCheck } from './environment.check';
import { ProjectStructureCheck } from './project-structure.check';
import { EnvMismatchCheck } from './env-mismatch.check';

export class HealthScoreCheck implements Check {
  id = 'health-score';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const subChecks = [
      new ProjectInfoCheck(),
      new FrameworkCheck(),
      new TypeScriptCheck(),
      new CodeQualityCheck(),
      new TestingStackCheck(),
      new DeploymentCheck(),
      new CiCdCheck(),
      new DocumentationCheck(),
      new EnvironmentCheck(),
      new ProjectStructureCheck(),
      new EnvMismatchCheck(),
    ];

    const results: CheckResult[] = [];
    for (const check of subChecks) {
      try {
        const result = await check.run(context);
        results.push(result);
      } catch (e) {
        // skip or add fallback
      }
    }

    const scoreBreakdown = ScoringService.calculate(results);

    return {
      id: this.id,
      title: 'Frontend Health',
      severity: 'info',
      summary: `Overall score: ${scoreBreakdown.overall}/100`,
      details: {
        scoreBreakdown,
      },
    };
  }
}
