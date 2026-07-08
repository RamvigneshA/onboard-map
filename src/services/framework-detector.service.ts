/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Context } from '../models/types';

export interface DetectedFramework {
  name: string;
  version?: string;
}

export class FrameworkDetectorService {
  /**
   * Detect frameworks and languages in the project
   */
  static detect(context: Context): DetectedFramework[] {
    const frameworks: DetectedFramework[] = [];
    const pkgJson = context.packageJson;
    if (!pkgJson) return [];

    const dependencies = (pkgJson.dependencies as Record<string, string>) || {};
    const devDependencies = (pkgJson.devDependencies as Record<string, string>) || {};
    const allDeps = { ...dependencies, ...devDependencies };

    const getVersion = (name: string): string | undefined => {
      const raw = allDeps[name];
      if (!raw) return undefined;
      // Extract first sequence of digits and dots, e.g., ^19.0.1 -> 19.0.1, or workspace:* -> workspace:*
      const match = raw.match(/(\d+\.\d+\.\d+|\d+\.\d+|\d+)/);
      return match ? match[1] : raw.replace(/[\^~]/g, '');
    };

    const getMajorVersion = (name: string): string | undefined => {
      const v = getVersion(name);
      if (!v) return undefined;
      const firstPart = v.split('.')[0];
      return firstPart;
    };

    // 1. Next.js (Check next dependency first, as it also depends on React)
    const hasNextDir = fs.existsSync(path.join(context.rootDir, 'app')) || 
                        fs.existsSync(path.join(context.rootDir, 'pages')) ||
                        fs.existsSync(path.join(context.rootDir, 'src', 'pages')) ||
                        fs.existsSync(path.join(context.rootDir, 'src', 'app'));

    if (allDeps['next'] || hasNextDir) {
      const v = getMajorVersion('next');
      frameworks.push({ name: 'Next.js', version: v });
    }

    // 2. React
    if (allDeps['react'] && !frameworks.some(f => f.name === 'Next.js')) {
      const v = getMajorVersion('react');
      frameworks.push({ name: 'React', version: v });
    }

    // 3. Angular
    if (allDeps['@angular/core'] || fs.existsSync(path.join(context.rootDir, 'angular.json'))) {
      const v = getMajorVersion('@angular/core');
      frameworks.push({ name: 'Angular', version: v });
    }

    // 4. Vue
    if (allDeps['vue']) {
      const v = getMajorVersion('vue');
      frameworks.push({ name: 'Vue', version: v });
    }

    // 5. Svelte
    if (allDeps['svelte'] || allDeps['@sveltejs/kit']) {
      const v = getMajorVersion('svelte') || getMajorVersion('@sveltejs/kit');
      frameworks.push({ name: 'Svelte', version: v });
    }

    // 6. Astro
    if (allDeps['astro']) {
      const v = getMajorVersion('astro');
      frameworks.push({ name: 'Astro', version: v });
    }

    // 7. Remix
    if (allDeps['@remix-run/react'] || allDeps['@remix-run/node']) {
      const v = getMajorVersion('@remix-run/react') || getMajorVersion('@remix-run/node');
      frameworks.push({ name: 'Remix', version: v });
    }

    // 8. TypeScript (Language)
    if (allDeps['typescript'] || fs.existsSync(path.join(context.rootDir, 'tsconfig.json'))) {
      const v = getMajorVersion('typescript');
      frameworks.push({ name: 'TypeScript', version: v });
    }

    return frameworks;
  }
}
