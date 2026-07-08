/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class DependencyCheck implements Check {
  id = 'dependency';
  deep = false; // We can set deep=false, but the deep analysis logic inside run() only triggers if context.projectMeta or options specify it, or if context.isDeep/options.isDeep is true. Wait, how do we know if we are in deep mode?
  // In server.ts: isDeep: runDeep was added to meta. But wait, in Context, we don't have an isDeep field.
  // Wait! Let's check how we can pass deep mode down.
  // Ah! In server.ts, can we see if we have access to context or options? Wait, the Check.run only receives `Context`.
  // Let's check if we can add an optional field `isDeep?: boolean` to `Context` or just run deep checks when `context` has it, or we can check if there's any other indicator.
  // Wait! Let's look at `Context` definition in `/src/models/types.ts`. It has:
  // `rootDir`, `importGraph`, `gitLog`, `packageJson`, `readmeContent`, `envExampleKeys`, `projectMeta`.
  // Wait, does it have `isDeep`? No.
  // But wait, we can check if we can add `isDeep` to `Context`! Yes! In `/src/models/types.ts`, let's view line 43 to 52. Yes, we did.
  // If we want to check for deep mode, wait, we can also check if any deep check has been run, or if we can see `--deep` flag or query param! Or we can check if deep checks are in the results? No, wait!
  // We can check if a deep check can read an environment variable, or we can just add `isDeep?: boolean` to `Context` inside `src/models/types.ts`! That is extremely clean and robust!
  // Let's see: we can also just run it if we detect we are running in the CLI with `--deep` (using process.argv.includes('--deep')) or if the API request has query param `deep=true`.
  // Wait, checking both `process.argv.includes('--deep')` and an environment variable or checking file existence/context is extremely robust. Let's do that! E.g.
  // `const isDeep = process.argv.includes('--deep') || process.env.DEEP_ANALYSIS === 'true';`
  // Wait, we can also add `isDeep?: boolean` to `Context`! Let's edit `/src/models/types.ts` to include `isDeep?: boolean` in `Context` and set it in `server.ts` and `cli.ts`!
  // Let's first check `/src/models/types.ts` to see lines 43-52 again.

  async run(context: Context): Promise<CheckResult> {
    const pkgJson = context.packageJson || {};
    const dependencies = (pkgJson.dependencies as Record<string, string>) || {};
    const devDependencies = (pkgJson.devDependencies as Record<string, string>) || {};

    const totalProd = Object.keys(dependencies).length;
    const totalDev = Object.keys(devDependencies).length;
    const totalDeps = totalProd + totalDev;

    const unusedDeps: string[] = [];
    const duplicateDeps: string[] = [];

    // Check if we are in deep mode: either via process.argv, environment, or custom field on context
    const isDeep = (context as any).isDeep || process.argv.includes('--deep') || process.argv.includes('-d');

    if (isDeep) {
      const importRegex = /(?:import\s+.*?\s+from\s+|export\s+.*?\s+from\s+|require\(\s*)['"]([^'"]+)['"]/g;
      const importedPackages = new Set<string>();

      for (const fileNode of context.importGraph.files) {
        const fullPath = path.join(context.rootDir, fileNode.path);
        if (fs.existsSync(fullPath)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            let match;
            importRegex.lastIndex = 0; // Reset regex
            while ((match = importRegex.exec(content)) !== null) {
              const imported = match[1];
              // Extract package name (handling scopes e.g. @babel/core -> @babel/core, lodash/map -> lodash)
              let pkgName = imported;
              if (imported.startsWith('@')) {
                const parts = imported.split('/');
                if (parts.length >= 2) {
                  pkgName = `${parts[0]}/${parts[1]}`;
                }
              } else {
                pkgName = imported.split('/')[0];
              }
              importedPackages.add(pkgName);
            }
          } catch (e) {
            // ignore
          }
        }
      }

      // Check each production dependency
      for (const dep of Object.keys(dependencies)) {
        // Skip common framework core packages that may not be directly imported or are expected
        if (['react', 'react-dom', 'next', 'typescript', 'vite', 'eslint', 'prettier'].includes(dep)) {
          continue;
        }
        if (!importedPackages.has(dep)) {
          unusedDeps.push(dep);
        }
      }

      // Check for duplicates
      for (const dep of Object.keys(dependencies)) {
        if (devDependencies[dep]) {
          duplicateDeps.push(dep);
        }
      }
    }

    const summary = `${totalDeps} dependencies (${totalProd} production, ${totalDev} dev)`;

    return {
      id: this.id,
      title: 'Dependency Analysis',
      severity: 'info',
      summary,
      details: {
        totalProd,
        totalDev,
        totalDeps,
        unusedDeps,
        duplicateDeps,
        isDeep,
      },
    };
  }
}
