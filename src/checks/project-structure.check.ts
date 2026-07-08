/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class ProjectStructureCheck implements Check {
  id = 'project-structure';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const rootDir = context.rootDir;

    const hasSrc = fs.existsSync(path.join(rootDir, 'src'));
    const hasComponents = fs.existsSync(path.join(rootDir, 'components')) || fs.existsSync(path.join(rootDir, 'src', 'components'));
    const hasHooks = fs.existsSync(path.join(rootDir, 'hooks')) || fs.existsSync(path.join(rootDir, 'src', 'hooks'));
    const hasLib = fs.existsSync(path.join(rootDir, 'lib')) || fs.existsSync(path.join(rootDir, 'src', 'lib'));
    const hasUtils = fs.existsSync(path.join(rootDir, 'utils')) || fs.existsSync(path.join(rootDir, 'src', 'utils'));
    const hasPublic = fs.existsSync(path.join(rootDir, 'public')) || fs.existsSync(path.join(rootDir, 'src', 'public'));
    const hasTests = fs.existsSync(path.join(rootDir, 'tests')) || 
                     fs.existsSync(path.join(rootDir, 'src', 'tests')) || 
                     fs.existsSync(path.join(rootDir, '__tests__')) || 
                     fs.existsSync(path.join(rootDir, 'src', '__tests__'));

    const folders = {
      src: hasSrc,
      components: hasComponents,
      hooks: hasHooks,
      lib: hasLib,
      utils: hasUtils,
      public: hasPublic,
      tests: hasTests,
    };

    const present = Object.entries(folders)
      .filter(([_, exists]) => exists)
      .map(([name]) => name);

    const summary = present.length > 0
      ? `Detected standard directories: ${present.join(', ')}`
      : 'Non-standard directory layout';

    return {
      id: this.id,
      title: 'Project Structure',
      severity: 'info',
      summary,
      details: folders,
    };
  }
}
