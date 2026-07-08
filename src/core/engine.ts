/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';

// Default checks
import { EntryPathCheck } from '../checks/entry-path.check';
import { ReadingPathByFeatureCheck } from '../checks/reading-path-by-feature.check';
import { HighRiskCheck } from '../checks/high-risk.check';
import { CircularDepsCheck } from '../checks/circular-deps.check';
import { SafeToPracticeCheck } from '../checks/safe-to-practice.check';
import { OwnershipCheck } from '../checks/ownership.check';
import { DeadEndsCheck } from '../checks/dead-ends.check';
import { EnvMismatchCheck } from '../checks/env-mismatch.check';
import { ReadmeStalenessCheck } from '../checks/readme-staleness.check';
import { LargestComponentsCheck } from '../checks/largest-components.check';

// Frontend Health Analyzer checks
import { ProjectInfoCheck } from '../checks/project-info.check';
import { FrameworkCheck } from '../checks/framework.check';
import { BuildToolCheck } from '../checks/build-tool.check';
import { TypeScriptCheck } from '../checks/typescript.check';
import { StylingCheck } from '../checks/styling.check';
import { StateManagementCheck } from '../checks/state-management.check';
import { FormLibraryCheck } from '../checks/form-library.check';
import { ValidationCheck } from '../checks/validation.check';
import { TestingStackCheck } from '../checks/testing-stack.check';
import { CodeQualityCheck } from '../checks/code-quality.check';
import { DeploymentCheck } from '../checks/deployment.check';
import { CiCdCheck } from '../checks/ci-cd.check';
import { DocumentationCheck } from '../checks/documentation.check';
import { EnvironmentCheck } from '../checks/environment.check';
import { ProjectStructureCheck } from '../checks/project-structure.check';
import { DependencyCheck } from '../checks/dependency.check';
import { HealthScoreCheck } from '../checks/health-score.check';
import { RecommendationsCheck } from '../checks/recommendations.check';

// Deep checks
import { CouplingHotspotsCheck } from '../checks/deep/coupling-hotspots.check';
import { BoundaryViolationsCheck } from '../checks/deep/boundary-violations.check';
import { BusFactorCheck } from '../checks/deep/bus-factor.check';
import { KnowledgeGapCheck } from '../checks/deep/knowledge-gap.check';
import { AcceleratingChurnCheck } from '../checks/deep/accelerating-churn.check';
import { BarrelBloatCheck } from '../checks/deep/barrel-bloat.check';
import { DeepImportChainsCheck } from '../checks/deep/deep-import-chains.check';

export class CodebaseEngine {
  private checks: Check[] = [
    // Default set
    new EntryPathCheck(),
    new ReadingPathByFeatureCheck(),
    new HighRiskCheck(),
    new CircularDepsCheck(),
    new SafeToPracticeCheck(),
    new OwnershipCheck(),
    new DeadEndsCheck(),
    new EnvMismatchCheck(),
    new ReadmeStalenessCheck(),
    new LargestComponentsCheck(),

    // Frontend Health Analyzer checks
    new ProjectInfoCheck(),
    new FrameworkCheck(),
    new BuildToolCheck(),
    new TypeScriptCheck(),
    new StylingCheck(),
    new StateManagementCheck(),
    new FormLibraryCheck(),
    new ValidationCheck(),
    new TestingStackCheck(),
    new CodeQualityCheck(),
    new DeploymentCheck(),
    new CiCdCheck(),
    new DocumentationCheck(),
    new EnvironmentCheck(),
    new ProjectStructureCheck(),
    new DependencyCheck(),
    new HealthScoreCheck(),
    new RecommendationsCheck(),

    // Deep set
    new CouplingHotspotsCheck(),
    new BoundaryViolationsCheck(),
    new BusFactorCheck(),
    new KnowledgeGapCheck(),
    new AcceleratingChurnCheck(),
    new BarrelBloatCheck(),
    new DeepImportChainsCheck(),
  ];

  /**
   * Run registered checks on context
   */
  async run(context: Context, options: { deep?: boolean } = {}): Promise<CheckResult[]> {
    const runDeep = !!options.deep;
    
    // Filter checks: only run deep checks if --deep is requested
    const checksToRun = this.checks.filter(c => !c.deep || runDeep);
    
    const results: CheckResult[] = [];
    for (const check of checksToRun) {
      try {
        const result = await check.run(context);
        results.push(result);
      } catch (e) {
        // Fallback result if check crashes
        results.push({
          id: check.id,
          title: check.id.toUpperCase(),
          severity: 'risk',
          summary: `Check failed to run: ${e instanceof Error ? e.message : String(e)}`,
          details: {},
        });
      }
    }

    return results;
  }
}
