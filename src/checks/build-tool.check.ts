/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class BuildToolCheck implements Check {
  id = 'build-tool';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const pkgJson = context.packageJson || {};
    const dependencies = (pkgJson.dependencies as Record<string, string>) || {};
    const devDependencies = (pkgJson.devDependencies as Record<string, string>) || {};
    const allDeps = { ...dependencies, ...devDependencies };

    const detectedTools: { name: string; version?: string }[] = [];

    const getVersion = (name: string): string | undefined => {
      const raw = allDeps[name];
      if (!raw) return undefined;
      const match = raw.match(/(\d+\.\d+\.\d+|\d+\.\d+|\d+)/);
      return match ? match[1] : raw.replace(/[\^~]/g, '');
    };

    const getMajorVersion = (name: string): string | undefined => {
      const v = getVersion(name);
      return v ? v.split('.')[0] : undefined;
    };

    // 1. Vite
    const hasViteConfig = fs.readdirSync(context.rootDir).some(f => f.startsWith('vite.config.'));
    if (allDeps['vite'] || hasViteConfig) {
      detectedTools.push({ name: 'Vite', version: getMajorVersion('vite') });
    }

    // 2. Next.js / Turbopack
    const hasNextConfig = fs.readdirSync(context.rootDir).some(f => f.startsWith('next.config.'));
    if (allDeps['next'] || hasNextConfig) {
      // By default Next.js uses Webpack, but we can call out Next.js build system
      detectedTools.push({ name: 'Next.js Build', version: getMajorVersion('next') });
    }

    // 3. Webpack
    const hasWebpackConfig = fs.readdirSync(context.rootDir).some(f => f.startsWith('webpack.config.'));
    if (allDeps['webpack'] || hasWebpackConfig) {
      detectedTools.push({ name: 'Webpack', version: getMajorVersion('webpack') });
    }

    // 4. Rollup
    const hasRollupConfig = fs.readdirSync(context.rootDir).some(f => f.startsWith('rollup.config.'));
    if (allDeps['rollup'] || hasRollupConfig) {
      detectedTools.push({ name: 'Rollup', version: getMajorVersion('rollup') });
    }

    // 5. Parcel
    if (allDeps['parcel'] || allDeps['parcel-bundler']) {
      detectedTools.push({ name: 'Parcel', version: getMajorVersion('parcel') || getMajorVersion('parcel-bundler') });
    }

    // 6. Rspack
    const hasRspackConfig = fs.readdirSync(context.rootDir).some(f => f.startsWith('rspack.config.'));
    if (allDeps['@rspack/core'] || hasRspackConfig) {
      detectedTools.push({ name: 'Rspack', version: getMajorVersion('@rspack/core') });
    }

    const summary = detectedTools.length > 0
      ? detectedTools.map(t => t.version ? `${t.name} ${t.version}` : t.name).join(', ')
      : 'No standard build tool detected';

    return {
      id: this.id,
      title: 'Build Tool',
      severity: 'info',
      summary,
      details: {
        tools: detectedTools,
      },
    };
  }
}
