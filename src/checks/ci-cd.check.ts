/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class CiCdCheck implements Check {
  id = 'ci-cd';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const platforms: string[] = [];

    // 1. GitHub Actions
    const githubWorkflowsPath = path.join(context.rootDir, '.github', 'workflows');
    let hasGithubActions = false;
    if (fs.existsSync(githubWorkflowsPath)) {
      try {
        const files = fs.readdirSync(githubWorkflowsPath);
        hasGithubActions = files.some(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      } catch (e) {
        // ignore
      }
    }
    if (hasGithubActions) {
      platforms.push('GitHub Actions');
    }

    // 2. GitLab CI
    if (fs.existsSync(path.join(context.rootDir, '.gitlab-ci.yml'))) {
      platforms.push('GitLab CI');
    }

    // 3. Azure Pipelines
    if (fs.existsSync(path.join(context.rootDir, 'azure-pipelines.yml')) || fs.existsSync(path.join(context.rootDir, 'azure-pipelines.yaml'))) {
      platforms.push('Azure Pipelines');
    }

    const hasCi = platforms.length > 0;
    const summary = hasCi
      ? `${platforms.join(', ')} configuration detected`
      : 'No automated CI/CD workflows detected';

    const severity = hasCi ? 'info' : 'warn';

    return {
      id: this.id,
      title: 'CI/CD',
      severity,
      summary,
      details: {
        platforms,
        hasCi,
        hasGithubActions,
      },
    };
  }
}
