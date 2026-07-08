/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class SecurityCheck implements Check {
  id = 'security';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const pkgJson = context.packageJson || {};
    const scripts = (pkgJson.scripts as Record<string, string>) || {};

    // 1. Detect .gitignore exists
    const gitignorePath = path.join(context.rootDir, '.gitignore');
    const hasGitignore = fs.existsSync(gitignorePath);

    // 2. Detect env files ignored
    let hasEnvIgnored = false;
    if (hasGitignore) {
      try {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '.env' || trimmed.startsWith('.env') || trimmed === '*.env' || trimmed.includes('.env')) {
            hasEnvIgnored = true;
            break;
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // 3. Detect Security Audit Script or Dependabot
    let hasAuditScript = false;
    for (const key of Object.keys(scripts)) {
      const val = String(scripts[key]).toLowerCase();
      if (key.toLowerCase().includes('audit') || val.includes('audit')) {
        hasAuditScript = true;
        break;
      }
    }

    const dependabotPath = path.join(context.rootDir, '.github', 'dependabot.yml');
    const dependabotYamlPath = path.join(context.rootDir, '.github', 'dependabot.yaml');
    const hasDependabot = fs.existsSync(dependabotPath) || fs.existsSync(dependabotYamlPath);

    const hasSecurityConfig = hasAuditScript || hasDependabot;

    // Severity and Summary
    let severity: 'info' | 'warn' | 'risk' = 'info';
    let summary = 'Security practices verified';

    if (!hasGitignore) {
      severity = 'risk';
      summary = '.gitignore is missing';
    } else if (!hasEnvIgnored) {
      severity = 'risk';
      summary = '.env files are not ignored';
    } else if (!hasSecurityConfig) {
      severity = 'warn';
      summary = 'No automated security audit or Dependabot configured';
    }

    return {
      id: this.id,
      title: 'Security',
      severity,
      summary,
      details: {
        hasGitignore,
        hasEnvIgnored,
        hasAuditScript,
        hasDependabot,
        hasSecurityConfig,
      },
    };
  }
}
