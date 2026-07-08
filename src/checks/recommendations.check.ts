/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';
import { RecommendationService } from '../services/recommendation.service';

// Sub-checks for recommendations
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
import { DependencyCheck } from './dependency.check';
import { EnvMismatchCheck } from './env-mismatch.check';

export class RecommendationsCheck implements Check {
  id = 'recommendations';
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
      new DependencyCheck(),
      new EnvMismatchCheck(),
    ];

    const results: CheckResult[] = [];
    for (const check of subChecks) {
      try {
        const result = await check.run(context);
        results.push(result);
      } catch (e) {
        // ignore
      }
    }

    const recommendations = RecommendationService.generate(results);

    return {
      id: this.id,
      title: 'Recommendations',
      severity: 'info',
      summary: `${recommendations.length} actionable suggestions`,
      details: {
        recommendations,
      },
    };
  }
}
