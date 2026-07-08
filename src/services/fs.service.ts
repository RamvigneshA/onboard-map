/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';

export class FsService {
  /**
   * Recursively walks directory to find TS/JS/JSX/TSX files, skipping ignored folders.
   */
  static walkFiles(dir: string, ignorePatterns: string[] = ['node_modules', 'dist', 'build', '.git', '.aistudio']): string[] {
    const results: string[] = [];

    const walk = (currentDir: string) => {
      let list: string[];
      try {
        list = fs.readdirSync(currentDir);
      } catch (e) {
        return;
      }

      for (const file of list) {
        const fullPath = path.join(currentDir, file);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch (e) {
          continue;
        }

        // Check ignore patterns
        const isIgnored = ignorePatterns.some(pattern => {
          return file === pattern || fullPath.includes(`${path.sep}${pattern}${path.sep}`) || fullPath.endsWith(`${path.sep}${pattern}`);
        });
        if (isIgnored) continue;

        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          const ext = path.extname(file);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    };

    walk(dir);
    return results;
  }

  /**
   * Reads package.json file
   */
  static readPackageJson(rootDir: string): Record<string, unknown> | null {
    const pPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pPath)) {
      try {
        return JSON.parse(fs.readFileSync(pPath, 'utf8'));
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Reads README.md file
   */
  static readReadme(rootDir: string): string | null {
    // Try different casings
    const readmeNames = ['README.md', 'readme.md', 'Readme.md', 'README'];
    for (const name of readmeNames) {
      const rPath = path.join(rootDir, name);
      if (fs.existsSync(rPath)) {
        try {
          return fs.readFileSync(rPath, 'utf8');
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Reads .env.example keys
   */
  static readEnvExampleKeys(rootDir: string): string[] {
    const envPath = path.join(rootDir, '.env.example');
    if (!fs.existsSync(envPath)) return [];
    
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      const keys: string[] = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([A-Z_0-9]+)\s*=/);
        if (match) {
          keys.push(match[1]);
        }
      }
      return keys;
    } catch (e) {
      return [];
    }
  }

  /**
   * Extract referenced env variables from source code files
   */
  static extractEnvVarsFromFiles(files: string[]): string[] {
    const envVars = new Set<string>();
    
    // Patterns to match:
    // process.env.VAR_NAME
    // import.meta.env.VAR_NAME
    const processEnvPattern = /process\.env\.([A-Z_0-9]+)/g;
    const importMetaPattern = /import\.meta\.env\.([A-Z_0-9]+)/g;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        let match;
        // Reset lastIndex for safety
        processEnvPattern.lastIndex = 0;
        while ((match = processEnvPattern.exec(content)) !== null) {
          envVars.add(match[1]);
        }
        
        importMetaPattern.lastIndex = 0;
        while ((match = importMetaPattern.exec(content)) !== null) {
          envVars.add(match[1]);
        }
      } catch (e) {
        // Skip unreadable files
      }
    }

    return Array.from(envVars);
  }
}
