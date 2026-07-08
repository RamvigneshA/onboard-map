#!/usr/bin/env node

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ContextBuilder } from './core/context';
import { CodebaseEngine } from './core/engine';
import { TerminalReporter } from './reporters/terminal.reporter';
import { JsonReporter } from './reporters/json.reporter';

const program = new Command();

program
  .name('onboard-map')
  .description('Onboarding and Architecture analyzer for TypeScript/React codebases')
  .version('1.0.0')
  .option('-j, --json', 'Output report in JSON format')
  .option('-d, --deep', 'Run additive deep checks for staff/architect level findings')
  .option('--dir <path>', 'Path to target directory (defaults to current working directory)', '.')
  .action(async (options) => {
    const startTime = Date.now();
    const targetPath = path.resolve(options.dir);

    if (!fs.existsSync(targetPath)) {
      console.error(`Error: Directory "${options.dir}" does not exist.`);
      process.exit(1);
    }

    try {
      // 1. Build Shared Context
      // Since rootDir is always the main workspace, we can walk from the selected targetPath
      const { context, isRealGit } = ContextBuilder.build(targetPath);

      // Guess project name
      let projectName = path.basename(targetPath);
      if (context.packageJson && context.packageJson.name) {
        projectName = String(context.packageJson.name);
      }

      // 2. Run Analysis
      const engine = new CodebaseEngine();
      const results = await engine.run(context, { deep: options.deep });

      const durationMs = Date.now() - startTime;
      const meta = {
        filesScanned: context.importGraph.files.length,
        edgeCount: context.importGraph.edges.length,
        durationMs,
        projectName,
        isRealGit,
        projectMeta: context.projectMeta,
        isDeep: !!options.deep,
      };

      // 3. Format and Output Report
      if (options.json) {
        const jsonReporter = new JsonReporter();
        console.log(jsonReporter.render(results, meta));
      } else {
        const terminalReporter = new TerminalReporter();
        console.log(terminalReporter.render(results, meta));
      }
    } catch (err) {
      console.error('onboard-map analysis failed:');
      console.error(err instanceof Error ? err.stack : String(err));
      process.exit(1);
    }
  });

program.parse(process.argv);
