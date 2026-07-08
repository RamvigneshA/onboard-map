/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class StylingCheck implements Check {
  id = 'styling';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const pkgJson = context.packageJson || {};
    const dependencies = (pkgJson.dependencies as Record<string, string>) || {};
    const devDependencies = (pkgJson.devDependencies as Record<string, string>) || {};
    const allDeps = { ...dependencies, ...devDependencies };

    const detected: string[] = [];

    // 1. Tailwind CSS
    if (allDeps['tailwindcss'] || allDeps['@tailwindcss/vite']) {
      detected.push('Tailwind CSS');
    }

    // 2. CSS Modules
    const hasCssModules = context.importGraph.files.some(f => 
      f.path.endsWith('.module.css') || 
      f.path.endsWith('.module.scss') || 
      f.path.endsWith('.module.less')
    );
    if (hasCssModules) {
      detected.push('CSS Modules');
    }

    // 3. Sass
    if (allDeps['sass'] || allDeps['node-sass']) {
      detected.push('Sass');
    }

    // 4. Emotion
    const hasEmotion = Object.keys(allDeps).some(d => d.startsWith('@emotion/'));
    if (hasEmotion) {
      detected.push('Emotion');
    }

    // 5. Styled Components
    if (allDeps['styled-components']) {
      detected.push('Styled Components');
    }

    // 6. MUI (Material UI)
    const hasMui = Object.keys(allDeps).some(d => d.startsWith('@mui/'));
    if (hasMui) {
      detected.push('Material UI');
    }

    // 7. Chakra UI
    const hasChakra = Object.keys(allDeps).some(d => d.startsWith('@chakra-ui/'));
    if (hasChakra) {
      detected.push('Chakra UI');
    }

    // 8. Shadcn UI
    const hasComponentsJson = fs.existsSync(path.join(context.rootDir, 'components.json'));
    const hasUiFolder = fs.existsSync(path.join(context.rootDir, 'components', 'ui')) ||
                        fs.existsSync(path.join(context.rootDir, 'src', 'components', 'ui'));
    const hasRadix = Object.keys(allDeps).some(d => d.startsWith('@radix-ui/'));
    const hasShadcn = hasComponentsJson && hasUiFolder && hasRadix;
    if (hasShadcn) {
      detected.push('Shadcn UI');
    }

    const summary = detected.length > 0 ? detected.join(', ') : 'CSS/HTML native styling';

    return {
      id: this.id,
      title: 'Styling',
      severity: 'info',
      summary,
      details: {
        stylingTechs: detected,
        hasShadcn,
        hasComponentsJson,
        hasUiFolder,
        hasRadix,
        hasTailwind: detected.includes('Tailwind CSS'),
        hasCssModules,
      },
    };
  }
}
