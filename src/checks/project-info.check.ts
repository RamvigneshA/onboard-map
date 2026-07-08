/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class ProjectInfoCheck implements Check {
  id = 'project-info';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const pkgJson = context.packageJson || {};
    
    // 1. Detect Name and Version
    const name = String(pkgJson.name || path.basename(context.rootDir));
    const version = String(pkgJson.version || '0.0.0');

    // 2. Detect Package Manager
    let packageManager = 'unknown';
    if (fs.existsSync(path.join(context.rootDir, 'bun.lockb')) || fs.existsSync(path.join(context.rootDir, 'bun.lock'))) {
      packageManager = 'bun';
    } else if (fs.existsSync(path.join(context.rootDir, 'pnpm-lock.yaml'))) {
      packageManager = 'pnpm';
    } else if (fs.existsSync(path.join(context.rootDir, 'yarn.lock'))) {
      packageManager = 'yarn';
    } else if (fs.existsSync(path.join(context.rootDir, 'package-lock.json'))) {
      packageManager = 'npm';
    } else if (pkgJson.packageManager) {
      const pmString = String(pkgJson.packageManager);
      if (pmString.startsWith('pnpm')) packageManager = 'pnpm';
      else if (pmString.startsWith('yarn')) packageManager = 'yarn';
      else if (pmString.startsWith('bun')) packageManager = 'bun';
      else if (pmString.startsWith('npm')) packageManager = 'npm';
    }

    // 3. Detect Node Version
    let nodeVersion = 'Any';
    if (pkgJson.engines && typeof pkgJson.engines === 'object' && (pkgJson.engines as any).node) {
      nodeVersion = String((pkgJson.engines as any).node);
    } else {
      const nvmrcPath = path.join(context.rootDir, '.nvmrc');
      const nodeVersionPath = path.join(context.rootDir, '.node-version');
      if (fs.existsSync(nvmrcPath)) {
        try {
          nodeVersion = fs.readFileSync(nvmrcPath, 'utf8').trim();
        } catch (e) {
          // ignore
        }
      } else if (fs.existsSync(nodeVersionPath)) {
        try {
          nodeVersion = fs.readFileSync(nodeVersionPath, 'utf8').trim();
        } catch (e) {
          // ignore
        }
      }
    }

    // 4. Detect Git presence
    const hasGit = fs.existsSync(path.join(context.rootDir, '.git'));
    const repository = hasGit ? 'Git detected' : 'No Git repository';

    // 5. Detect monorepo vs single package
    const isMonorepo = context.projectMeta.workspaceType !== 'none' || context.projectMeta.projectType === 'monorepo';
    const structure = isMonorepo ? 'Monorepo' : 'Single package';

    return {
      id: this.id,
      title: 'Project Information',
      severity: 'info',
      summary: `${name} v${version}`,
      details: {
        name,
        version,
        packageManager,
        nodeVersion,
        repository,
        structure,
        isMonorepo,
        hasGit,
      },
    };
  }
}
