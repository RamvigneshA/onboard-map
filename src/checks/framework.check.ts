/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';
import { FrameworkDetectorService } from '../services/framework-detector.service';

export class FrameworkCheck implements Check {
  id = 'framework';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const frameworks = FrameworkDetectorService.detect(context);

    const summaryParts = frameworks.map(f => f.version ? `${f.name} ${f.version}` : f.name);
    const summary = summaryParts.length > 0
      ? `${summaryParts.join(', ')} detected`
      : 'No standard frontend framework detected';

    return {
      id: this.id,
      title: 'Framework',
      severity: 'info',
      summary,
      details: {
        frameworks,
      },
    };
  }
}
