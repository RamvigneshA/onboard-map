/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';

export class ValidationCheck implements Check {
  id = 'validation';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const pkgJson = context.packageJson || {};
    const dependencies = (pkgJson.dependencies as Record<string, string>) || {};
    const devDependencies = (pkgJson.devDependencies as Record<string, string>) || {};
    const allDeps = { ...dependencies, ...devDependencies };

    const detected: string[] = [];

    if (allDeps['zod']) {
      detected.push('Zod');
    }
    if (allDeps['yup']) {
      detected.push('Yup');
    }
    if (allDeps['valibot']) {
      detected.push('Valibot');
    }

    const summary = detected.length > 0 ? detected.join(', ') : 'No schema validation library detected';

    return {
      id: this.id,
      title: 'Validation',
      severity: 'info',
      summary,
      details: {
        libraries: detected,
      },
    };
  }
}
