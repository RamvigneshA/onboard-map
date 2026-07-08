/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class TypeScriptCheck implements Check {
  id = 'typescript';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const pkgJson = context.packageJson || {};
    const dependencies = (pkgJson.dependencies as Record<string, string>) || {};
    const devDependencies = (pkgJson.devDependencies as Record<string, string>) || {};
    const allDeps = { ...dependencies, ...devDependencies };

    const tsconfigPath = path.join(context.rootDir, 'tsconfig.json');
    const isInstalled = !!allDeps['typescript'] || fs.existsSync(tsconfigPath);

    let strict = false;
    let noImplicitAny = false;
    let baseUrl: string | undefined = undefined;
    let paths: Record<string, string[]> | undefined = undefined;
    let moduleResolution: string | undefined = undefined;
    let hasTsConfig = false;

    if (fs.existsSync(tsconfigPath)) {
      hasTsConfig = true;
      try {
        const rawContent = fs.readFileSync(tsconfigPath, 'utf8');
        const cleanContent = rawContent
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(?:^|[^:])\/\/.*$/gm, (match) => {
            if (match.startsWith('//')) return '';
            return match.charAt(0);
          });
        const config = JSON.parse(cleanContent);
        const options = config.compilerOptions || {};

        strict = !!options.strict;
        // if strict is true, noImplicitAny is true by default, unless explicitly set to false
        noImplicitAny = options.noImplicitAny !== undefined ? !!options.noImplicitAny : strict;
        baseUrl = options.baseUrl;
        paths = options.paths;
        moduleResolution = options.moduleResolution;
      } catch (e) {
        // ignore parse failure, fallback to defaults
      }
    }

    const severity = isInstalled ? (strict ? 'info' : 'warn') : 'risk';
    const summary = isInstalled
      ? (strict ? 'TypeScript strictly configured' : 'TypeScript installed but strict mode disabled')
      : 'TypeScript not configured';

    return {
      id: this.id,
      title: 'TypeScript',
      severity,
      summary,
      details: {
        isInstalled,
        hasTsConfig,
        strict,
        noImplicitAny,
        baseUrl,
        paths: paths ? Object.keys(paths) : [],
        moduleResolution,
      },
    };
  }
}
