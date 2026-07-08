/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class TestingStackCheck implements Check {
  id = 'testing-stack';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const pkgJson = context.packageJson || {};
    const dependencies = (pkgJson.dependencies as Record<string, string>) || {};
    const devDependencies = (pkgJson.devDependencies as Record<string, string>) || {};
    const allDeps = { ...dependencies, ...devDependencies };

    const unitTools: string[] = [];
    const e2eTools: string[] = [];

    // 1. Vitest
    if (allDeps['vitest'] || fs.existsSync(path.join(context.rootDir, 'vitest.config.ts')) || fs.existsSync(path.join(context.rootDir, 'vitest.config.js'))) {
      unitTools.push('Vitest');
    }

    // 2. Jest
    if (allDeps['jest'] || fs.existsSync(path.join(context.rootDir, 'jest.config.js')) || fs.existsSync(path.join(context.rootDir, 'jest.config.ts'))) {
      unitTools.push('Jest');
    }

    // 3. React Testing Library
    if (allDeps['@testing-library/react']) {
      unitTools.push('React Testing Library');
    }

    // 4. Cypress
    if (allDeps['cypress'] || fs.existsSync(path.join(context.rootDir, 'cypress.config.ts')) || fs.existsSync(path.join(context.rootDir, 'cypress.config.js'))) {
      e2eTools.push('Cypress');
    }

    // 5. Playwright
    if (allDeps['@playwright/test'] || fs.existsSync(path.join(context.rootDir, 'playwright.config.ts')) || fs.existsSync(path.join(context.rootDir, 'playwright.config.js'))) {
      e2eTools.push('Playwright');
    }

    const hasUnit = unitTools.length > 0;
    const hasE2e = e2eTools.length > 0;

    let summary = 'No testing suite detected';
    let severity: CheckResult['severity'] = 'warn';

    if (hasUnit && hasE2e) {
      summary = `${unitTools.join(', ')} and E2E (${e2eTools.join(', ')}) configured`;
      severity = 'info';
    } else if (hasUnit) {
      summary = `${unitTools.join(', ')} configured, no E2E suite detected`;
      severity = 'warn';
    } else if (hasE2e) {
      summary = `E2E (${e2eTools.join(', ')}) configured, no unit tests detected`;
      severity = 'warn';
    }

    return {
      id: this.id,
      title: 'Testing',
      severity,
      summary,
      details: {
        unitTools,
        e2eTools,
        hasUnit,
        hasE2e,
      },
    };
  }
}
