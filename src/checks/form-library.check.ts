/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';

export class FormLibraryCheck implements Check {
  id = 'form-library';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const pkgJson = context.packageJson || {};
    const dependencies = (pkgJson.dependencies as Record<string, string>) || {};
    const devDependencies = (pkgJson.devDependencies as Record<string, string>) || {};
    const allDeps = { ...dependencies, ...devDependencies };

    const detected: string[] = [];

    if (allDeps['react-hook-form']) {
      detected.push('React Hook Form');
    }
    if (allDeps['formik']) {
      detected.push('Formik');
    }
    if (allDeps['@tanstack/react-form']) {
      detected.push('TanStack Form');
    }

    const summary = detected.length > 0 ? detected.join(', ') : 'No form libraries detected';

    return {
      id: this.id,
      title: 'Form Library',
      severity: 'info',
      summary,
      details: {
        libraries: detected,
      },
    };
  }
}
