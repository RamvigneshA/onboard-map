/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';
import { AppImportGraph } from '../services/import-graph.service';
import * as path from 'path';

export class ReadingPathByFeatureCheck implements Check {
  id = 'reading-path-by-feature';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const graph = context.importGraph as AppImportGraph;

    // Identify entry points to find paths from
    const candidates = [
      'src/main.tsx',
      'src/main.ts',
      'src/index.tsx',
      'src/index.ts',
      'src/App.tsx',
    ];
    let entryPoint = candidates.find(c => graph.files.some(f => f.path === c)) || '';

    // Group files by top-level feature folder under src/ or root
    // e.g. src/features/auth/LoginForm.tsx -> auth
    //      src/components/Button.tsx -> components
    const featureMap = new Map<string, string[]>();

    for (const file of graph.files) {
      if (file.path === entryPoint) continue;

      let featureName = '';
      const parts = file.path.split('/');
      
      if (parts[0] === 'src') {
        if (parts[1] === 'features' && parts.length > 3) {
          featureName = parts[2];
        } else if (parts.length > 2) {
          featureName = parts[1];
        }
      } else if (parts.length > 1) {
        featureName = parts[0];
      }

      if (!featureName || featureName === 'models' || featureName === 'constants' || featureName === 'types') {
        continue;
      }

      const filesInFeature = featureMap.get(featureName) || [];
      filesInFeature.push(file.path);
      featureMap.set(featureName, filesInFeature);
    }

    const features: { folder: string; chain: string[] }[] = [];

    for (const [folder, files] of featureMap.entries()) {
      if (files.length === 0) continue;

      let bestChain: string[] | null = null;

      // 1. Try finding a path from entryPoint to any file in this feature
      if (entryPoint) {
        for (const file of files) {
          const pathFound = graph.findShortestPath(entryPoint, file);
          if (pathFound && pathFound.length >= 2) {
            // Trim chain if it's too long, but keep the connection
            // We want to show: featureEntry -> intermediate -> final
            if (!bestChain || pathFound.length < bestChain.length) {
              bestChain = pathFound;
            }
          }
        }
      }

      // 2. If no path from entry point, build an internal chain of imports within the feature
      if (!bestChain) {
        // Sort files by fan-out inside the feature
        const sortedFiles = [...files].sort((a, b) => graph.fanOut(b) - graph.fanOut(a));
        const rootFile = sortedFiles[0];
        const chain = [rootFile];
        let current = rootFile;
        const visited = new Set<string>([current]);

        for (let i = 0; i < 2; i++) {
          const children = graph.getEdgesFrom(current)
            .map(e => e.to)
            .filter(to => files.includes(to) && !visited.has(to));
          
          if (children.length === 0) break;
          // Pick the one with highest fan-out
          children.sort((a, b) => graph.fanOut(b) - graph.fanOut(a));
          current = children[0];
          visited.add(current);
          chain.push(current);
        }
        
        if (chain.length >= 1) {
          bestChain = chain;
        }
      }

      if (bestChain) {
        // Map paths to filenames for display
        const displayChain = bestChain.map(p => path.basename(p));
        features.push({
          folder: `${folder}/`,
          chain: displayChain,
        });
      }
    }

    // Sort features alphabetically
    features.sort((a, b) => a.folder.localeCompare(b.folder));

    const summary = features.length > 0
      ? `Discovered ${features.length} feature areas with recommended reading paths`
      : 'No feature areas found';

    return {
      id: this.id,
      title: 'Reading Path by Feature',
      severity: 'info',
      summary,
      details: {
        features,
      },
    };
  }
}
