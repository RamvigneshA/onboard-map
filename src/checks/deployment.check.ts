/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class DeploymentCheck implements Check {
  id = 'deployment';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const pkgJson = context.packageJson || {};
    const dependencies = (pkgJson.dependencies as Record<string, string>) || {};
    const devDependencies = (pkgJson.devDependencies as Record<string, string>) || {};
    const allDeps = { ...dependencies, ...devDependencies };

    const detected: string[] = [];

    // 1. Vercel
    const hasVercelConfig = fs.existsSync(path.join(context.rootDir, 'vercel.json'));
    const hasVercelDep = Object.keys(allDeps).some(d => d.startsWith('@vercel/'));
    const scripts = (pkgJson.scripts as Record<string, string>) || {};
    const hasVercelScript = Object.entries(scripts).some(([key, val]) => 
      key.toLowerCase().includes('vercel') || String(val).toLowerCase().includes('vercel')
    );
    if (hasVercelConfig || hasVercelDep || hasVercelScript) {
      detected.push('Vercel');
    }

    // 2. Netlify
    const hasNetlifyConfig = fs.existsSync(path.join(context.rootDir, 'netlify.toml'));
    const hasNetlifyScript = Object.entries(scripts).some(([key, val]) => 
      key.toLowerCase().includes('netlify') || String(val).toLowerCase().includes('netlify')
    );
    if (hasNetlifyConfig || allDeps['netlify-cli'] || hasNetlifyScript) {
      detected.push('Netlify');
    }

    // 3. Cloudflare Pages/Workers
    const hasCloudflareConfig = fs.existsSync(path.join(context.rootDir, 'wrangler.toml')) || fs.existsSync(path.join(context.rootDir, 'wrangler.json'));
    if (hasCloudflareConfig || allDeps['wrangler']) {
      detected.push('Cloudflare');
    }

    // 4. Firebase Hosting
    const hasFirebaseConfig = fs.existsSync(path.join(context.rootDir, 'firebase.json'));
    const hasFirebaseScript = Object.entries(scripts).some(([key, val]) => 
      key.toLowerCase().includes('firebase') || String(val).toLowerCase().includes('firebase')
    );
    if (hasFirebaseConfig || allDeps['firebase-tools'] || hasFirebaseScript) {
      detected.push('Firebase');
    }

    // 5. GitHub Pages / Actions
    const hasGithubFolder = fs.existsSync(path.join(context.rootDir, '.github'));
    if (allDeps['gh-pages']) {
      detected.push('GitHub Pages');
    }
    if (hasGithubFolder) {
      detected.push('GitHub Actions');
    }

    const summary = detected.length > 0
      ? `Configured for ${detected.join(', ')}`
      : '⚠ No deployment configuration detected';

    return {
      id: this.id,
      title: 'Deployment',
      severity: detected.length > 0 ? 'info' : 'warn',
      summary,
      details: {
        platforms: detected,
        hasVercel: detected.includes('Vercel'),
        hasNetlify: detected.includes('Netlify'),
        hasCloudflare: detected.includes('Cloudflare'),
        hasFirebase: detected.includes('Firebase'),
        hasGhPages: detected.includes('GitHub Pages'),
        hasGithubFolder,
      },
    };
  }
}
