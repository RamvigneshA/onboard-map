/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class StateManagementCheck implements Check {
  id = 'state-management';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const pkgJson = context.packageJson || {};
    const dependencies = (pkgJson.dependencies as Record<string, string>) || {};
    const devDependencies = (pkgJson.devDependencies as Record<string, string>) || {};
    const allDeps = { ...dependencies, ...devDependencies };

    const detected: string[] = [];

    // 1. Redux Toolkit
    if (allDeps['@reduxjs/toolkit'] || allDeps['redux']) {
      detected.push('Redux');
    }

    // 2. Zustand
    if (allDeps['zustand']) {
      detected.push('Zustand');
    }

    // 3. Jotai
    if (allDeps['jotai']) {
      detected.push('Jotai');
    }

    // 4. MobX
    if (allDeps['mobx'] || allDeps['mobx-react'] || allDeps['mobx-react-lite']) {
      detected.push('MobX');
    }

    // 5. Recoil
    if (allDeps['recoil']) {
      detected.push('Recoil');
    }

    // 6. TanStack Query
    if (allDeps['@tanstack/react-query'] || allDeps['react-query']) {
      detected.push('TanStack Query');
    }

    // 7. Apollo Client
    if (allDeps['@apollo/client'] || allDeps['apollo-client']) {
      detected.push('Apollo Client');
    }

    // 8. Component State (useState / useReducer)
    let hasComponentState = false;
    const filesToScan = context.importGraph.files
      .filter(f => f.path.endsWith('.tsx') || f.path.endsWith('.ts'))
      .slice(0, 100); // scan up to 100 files for high reliability
    for (const f of filesToScan) {
      const fullPath = path.join(context.rootDir, f.path);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('useState') || content.includes('useReducer')) {
            hasComponentState = true;
            break;
          }
        } catch (e) {
          // ignore
        }
      }
    }

    const summary = detected.length > 0 
      ? detected.join(', ') 
      : 'No external state library detected';

    return {
      id: this.id,
      title: 'State Management',
      severity: 'info',
      summary,
      details: {
        states: detected,
        hasComponentState,
      },
    };
  }
}
