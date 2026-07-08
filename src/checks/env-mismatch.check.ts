/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';
import { FsService } from '../services/fs.service';
import * as path from 'path';

export class EnvMismatchCheck implements Check {
  id = 'env-mismatch';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const files = context.importGraph.files.map(f => path.join(context.rootDir, f.path));
    const referencedVars = FsService.extractEnvVarsFromFiles(files);
    
    // Ignore standard built-in or system env vars to avoid noise
    const ignoredVars = new Set(['NODE_ENV', 'PORT', 'BASE_URL', 'MODE', 'DEV', 'PROD', 'SSR']);

    const missingVars = referencedVars.filter(v => {
      if (ignoredVars.has(v)) return false;
      return !context.envExampleKeys.includes(v);
    });

    const count = missingVars.length;
    // Env mismatches make local setups fail, so flag as risk/warn if any exist
    const severity = count > 0 ? 'risk' : 'info';
    const summary = count === 0
      ? 'All environment variables used in code are declared in .env.example'
      : `${count} env variable${count === 1 ? '' : 's'} used in code missing from .env.example`;

    return {
      id: this.id,
      title: 'Setup Mismatch',
      severity,
      summary,
      details: {
        referencedVars,
        declaredVars: context.envExampleKeys,
        missingVars,
      },
    };
  }
}
