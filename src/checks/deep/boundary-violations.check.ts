/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../../models/types';
import { AppImportGraph } from '../../services/import-graph.service';
import * as path from 'path';

export interface BoundaryViolation {
  from: string;
  to: string;
  type: 'shared-imports-feature' | 'feature-cross-import-internals';
  description: string;
}

export class BoundaryViolationsCheck implements Check {
  id = 'boundary-violations';
  deep = true;

  async run(context: Context): Promise<CheckResult> {
    const graph = context.importGraph as AppImportGraph;
    const violations: BoundaryViolation[] = [];

    for (const edge of graph.edges) {
      const fromLower = edge.from.toLowerCase();
      const toLower = edge.to.toLowerCase();

      // Rule 1: Shared code should not import feature/page specific code
      const isFromShared = fromLower.includes('/shared/') || fromLower.includes('/components/ui/') || fromLower.includes('/utils/');
      const isToFeature = toLower.includes('/features/') || toLower.includes('/pages/') || toLower.includes('/auth/');

      if (isFromShared && isToFeature) {
        violations.push({
          from: edge.from,
          to: edge.to,
          type: 'shared-imports-feature',
          description: `Shared helper/ui component imports domain-specific code from feature/page`,
        });
        continue; // avoid duplicate flags
      }

      // Rule 2: Direct feature-to-feature imports (bypassing public index.ts)
      // src/features/auth/components/LoginForm.tsx -> from feature: auth
      // src/features/dashboard/Widget.tsx -> to feature: dashboard
      const featureFromMatch = edge.from.match(/src\/features\/([^/]+)/);
      const featureToMatch = edge.to.match(/src\/features\/([^/]+)/);

      if (featureFromMatch && featureToMatch) {
        const featureFrom = featureFromMatch[1];
        const featureTo = featureToMatch[1];

        // If they are different features
        if (featureFrom !== featureTo) {
          // Check if it imports the public entry index.ts of the other feature
          const isPublicImport = edge.to.endsWith(`/features/${featureTo}/index.ts`) ||
                                 edge.to.endsWith(`/features/${featureTo}/index.tsx`) ||
                                 edge.to.endsWith(`/features/${featureTo}/index`);

          if (!isPublicImport) {
            violations.push({
              from: edge.from,
              to: edge.to,
              type: 'feature-cross-import-internals',
              description: `Feature '${featureFrom}' directly imports internal file of feature '${featureTo}' (bypasses index.ts barrel)`,
            });
          }
        }
      }
    }

    const count = violations.length;
    // Boundary violations are critical architectural breakdown indicators
    const severity = count > 0 ? 'risk' : 'info';
    let summary = 'Architectural boundaries are strictly respected';
    if (count > 0) {
      summary = `${count} boundary violation${count === 1 ? '' : 's'} detected (leaking modules/cross-imports)`;
    }

    return {
      id: this.id,
      title: 'Boundary Violations',
      severity,
      summary,
      details: {
        violations,
      },
    };
  }
}
