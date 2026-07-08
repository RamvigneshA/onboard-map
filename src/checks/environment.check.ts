/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class EnvironmentCheck implements Check {
  id = 'environment';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const hasEnvExample = fs.existsSync(path.join(context.rootDir, '.env.example')) || context.envExampleKeys.length > 0;
    const hasEnvLocal = fs.existsSync(path.join(context.rootDir, '.env.local')) || fs.existsSync(path.join(context.rootDir, '.env'));
    const hasGitignore = fs.existsSync(path.join(context.rootDir, '.gitignore'));
    const hasEditorconfig = fs.existsSync(path.join(context.rootDir, '.editorconfig'));

    const foundConfigs: string[] = [];
    if (hasEnvExample) foundConfigs.push('.env.example');
    if (hasEnvLocal) foundConfigs.push('.env files (existence check)');
    if (hasGitignore) foundConfigs.push('.gitignore');
    if (hasEditorconfig) foundConfigs.push('.editorconfig');

    const summary = foundConfigs.length > 0
      ? `${foundConfigs.join(', ')} detected`
      : 'No standard environment configuration files detected';

    return {
      id: this.id,
      title: 'Environment',
      severity: 'info',
      summary,
      details: {
        hasEnvExample,
        hasEnvLocal,
        hasGitignore,
        hasEditorconfig,
        foundConfigs,
      },
    };
  }
}
