/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';
import * as fs from 'fs';
import * as path from 'path';

export interface ReadmeStalenessDetails {
  readmeNodeVersion: string | null;
  actualNodeVersion: string | null;
  nodeVersionMismatch: boolean;
  readmeSetupCommand: string | null;
  packageScripts: string[];
  mismatchedCommands: string[];
}

export class ReadmeStalenessCheck implements Check {
  id = 'readme-staleness';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const readme = context.readmeContent;
    const pkg = context.packageJson;

    const details: ReadmeStalenessDetails = {
      readmeNodeVersion: null,
      actualNodeVersion: null,
      nodeVersionMismatch: false,
      readmeSetupCommand: null,
      packageScripts: [],
      mismatchedCommands: [],
    };

    if (!readme) {
      return {
        id: this.id,
        title: 'README Out of Date',
        severity: 'warn',
        summary: 'No README.md file found in project root',
        details,
      };
    }

    // 1. Detect Node version in README
    // Look for patterns like "Node 18+", "Node.js 20", "Node v18", etc.
    const nodeRegex = /node(?:\.js)?\s*(?:v|version)?\s*(\d+(?:\.\d+)*)/i;
    const nodeMatch = readme.match(nodeRegex);
    if (nodeMatch) {
      details.readmeNodeVersion = nodeMatch[1];
    }

    // Detect actual Node version from .nvmrc or package.json engines
    const nvmrcPath = path.join(context.rootDir, '.nvmrc');
    if (fs.existsSync(nvmrcPath)) {
      try {
        details.actualNodeVersion = fs.readFileSync(nvmrcPath, 'utf8').trim();
      } catch (e) {
        // Ignore
      }
    } else if (pkg && pkg.engines && typeof pkg.engines === 'object') {
      const engines = pkg.engines as Record<string, string>;
      if (engines.node) {
        details.actualNodeVersion = engines.node.replace(/[^\d.]/g, '');
      }
    }

    if (details.readmeNodeVersion && details.actualNodeVersion) {
      const readmeMajor = parseInt(details.readmeNodeVersion.split('.')[0], 10);
      const actualMajor = parseInt(details.actualNodeVersion.split('.')[0], 10);
      if (readmeMajor !== actualMajor) {
        details.nodeVersionMismatch = true;
      }
    }

    // 2. Cross-reference setup / dev scripts
    if (pkg && pkg.scripts && typeof pkg.scripts === 'object') {
      details.packageScripts = Object.keys(pkg.scripts);
    }

    // Extract setup commands from README
    // Look for commands like `npm run <something>`, `yarn <something>` inside markdown code blocks
    const cmdRegex = /`(npm|yarn|pnpm|bun)\s+(?:run\s+)?([a-z0-9:-]+)`/gi;
    let match;
    const seenCommands = new Set<string>();

    while ((match = cmdRegex.exec(readme)) !== null) {
      const manager = match[1].toLowerCase();
      const script = match[2].toLowerCase();
      
      // We only care about execution scripts like 'dev', 'start', 'build', etc.
      if (['install', 'i', 'add', 'run'].includes(script)) continue;

      const commandStr = `${manager} run ${script}`;
      if (!seenCommands.has(commandStr)) {
        seenCommands.add(commandStr);
        // If the script doesn't exist in package.json, flag it!
        if (details.packageScripts.length > 0 && !details.packageScripts.includes(script)) {
          details.mismatchedCommands.push(commandStr);
        }
      }
    }

    // Compute status
    let severity: 'info' | 'warn' | 'risk' = 'info';
    let summary = 'README instructions are up to date';
    const mismatches: string[] = [];

    if (details.nodeVersionMismatch) {
      mismatches.push(`README Node version (${details.readmeNodeVersion}) mismatches actual version (${details.actualNodeVersion})`);
      severity = 'warn';
    }

    if (details.mismatchedCommands.length > 0) {
      mismatches.push(`README references script commands that do not exist in package.json: ${details.mismatchedCommands.join(', ')}`);
      severity = 'warn';
    }

    if (mismatches.length > 0) {
      summary = mismatches.join('; ');
    }

    return {
      id: this.id,
      title: 'README Out of Date',
      severity,
      summary,
      details,
    };
  }
}
