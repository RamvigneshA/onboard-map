/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProjectMeta } from '../models/types';

export class ProjectDiscoveryService {
  /**
   * Auto-detect project metadata from the repository structure
   */
  static discover(rootDir: string): ProjectMeta {
    const packageJson = this.readJsonFile(path.join(rootDir, 'package.json')) || {};
    const dependencies = (packageJson.dependencies as Record<string, string>) || {};
    const devDependencies = (packageJson.devDependencies as Record<string, string>) || {};
    const allDeps = { ...dependencies, ...devDependencies };

    // 1. Detect Package Manager
    let packageManager: ProjectMeta['packageManager'] = 'unknown';
    if (fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml'))) {
      packageManager = 'pnpm';
    } else if (fs.existsSync(path.join(rootDir, 'yarn.lock'))) {
      packageManager = 'yarn';
    } else if (fs.existsSync(path.join(rootDir, 'package-lock.json'))) {
      packageManager = 'npm';
    }

    // 2. Detect Workspace Type
    let workspaceType: ProjectMeta['workspaceType'] = 'none';
    if (fs.existsSync(path.join(rootDir, 'turbo.json'))) {
      workspaceType = 'turborepo';
    } else if (fs.existsSync(path.join(rootDir, 'nx.json'))) {
      workspaceType = 'nx';
    } else if (fs.existsSync(path.join(rootDir, 'pnpm-workspace.yaml'))) {
      workspaceType = 'pnpm';
    } else if (packageJson.workspaces) {
      workspaceType = packageManager === 'yarn' ? 'yarn' : 'npm';
    }

    // 3. Detect Workspace Packages
    const workspacePackages: { name: string; path: string }[] = [];
    if (workspaceType !== 'none') {
      this.findWorkspacePackages(rootDir, packageJson, workspacePackages);
    }

    // 4. Detect Framework
    let framework: ProjectMeta['framework'] = 'unknown';
    if (allDeps['next'] || fs.existsSync(path.join(rootDir, 'next.config.js')) || fs.existsSync(path.join(rootDir, 'next.config.mjs')) || fs.existsSync(path.join(rootDir, 'next.config.ts'))) {
      framework = 'next';
    } else if (allDeps['@angular/core'] || fs.existsSync(path.join(rootDir, 'angular.json'))) {
      framework = 'angular';
    } else if (fs.existsSync(path.join(rootDir, 'vite.config.ts')) || fs.existsSync(path.join(rootDir, 'vite.config.js')) || fs.existsSync(path.join(rootDir, 'vite.config.mjs')) || allDeps['vite']) {
      framework = 'react-vite';
    } else if (allDeps['react-scripts']) {
      framework = 'react-cra';
    } else if (allDeps['express'] || allDeps['fastify'] || allDeps['@nestjs/core']) {
      framework = 'express';
    } else {
      // Fallback: search for TS or JS indicators
      const hasTs = fs.existsSync(path.join(rootDir, 'tsconfig.json'));
      const hasJs = fs.existsSync(path.join(rootDir, 'jsconfig.json'));
      if (hasTs) {
        framework = 'ts-lib';
      } else if (hasJs) {
        framework = 'js-lib';
      } else {
        framework = 'node';
      }
    }

    // 5. Detect Project Type
    let projectType: ProjectMeta['projectType'] = 'unknown';
    if (workspaceType !== 'none') {
      projectType = 'monorepo';
    } else if (packageJson.bin) {
      projectType = 'cli';
    } else if (framework === 'next') {
      projectType = 'full-stack';
    } else if (['react-vite', 'react-cra', 'angular'].includes(framework)) {
      projectType = 'application'; // frontend application
    } else if (framework === 'express' || framework === 'node') {
      projectType = 'application'; // backend application
    } else if (['ts-lib', 'js-lib'].includes(framework)) {
      projectType = 'library';
    }

    // 6. Resolve Aliases from tsconfig.json or jsconfig.json
    const aliases = this.resolveCompilerAliases(rootDir);

    // 7. Detect Entry Points
    const entryPoints = this.detectEntryPoints(rootDir, packageJson, framework);

    return {
      framework,
      packageManager,
      workspaceType,
      projectType,
      workspacePackages,
      entryPoints,
      aliases,
    };
  }

  /**
   * Search for packages in workspaces
   */
  private static findWorkspacePackages(rootDir: string, packageJson: any, outPackages: { name: string; path: string }[]) {
    const patterns: string[] = [];

    // Extract workspace patterns
    if (Array.isArray(packageJson.workspaces)) {
      patterns.push(...packageJson.workspaces);
    } else if (packageJson.workspaces && Array.isArray(packageJson.workspaces.packages)) {
      patterns.push(...packageJson.workspaces.packages);
    }

    const pnpmWorkspacePath = path.join(rootDir, 'pnpm-workspace.yaml');
    if (fs.existsSync(pnpmWorkspacePath)) {
      try {
        const content = fs.readFileSync(pnpmWorkspacePath, 'utf8');
        // Simple YAML parser for packages
        const lines = content.split('\n');
        let inPackages = false;
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('packages:')) {
            inPackages = true;
            continue;
          }
          if (inPackages) {
            if (trimmed.startsWith('-')) {
              const pkgPattern = trimmed.replace(/^-/, '').trim().replace(/['"]/g, '');
              patterns.push(pkgPattern);
            } else if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith(' ')) {
              inPackages = false;
            }
          }
        }
      } catch (e) {
        // Skip
      }
    }

    if (patterns.length === 0) {
      // Default guess for common monorepos
      patterns.push('packages/*', 'apps/*', 'libs/*');
    }

    // Standard recursive walk to find sub-packages that match workspace folders
    const walk = (currentDir: string, depth = 0) => {
      if (depth > 4) return; // Prevent too deep traversal
      let files: string[];
      try {
        files = fs.readdirSync(currentDir);
      } catch (e) {
        return;
      }

      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch (e) {
          continue;
        }

        if (stat.isDirectory()) {
          const relativeDir = path.relative(rootDir, fullPath);
          if (['node_modules', 'dist', 'build', '.git', '.aistudio', 'coverage', '.next'].includes(file)) {
            continue;
          }

          const pkgJsonPath = path.join(fullPath, 'package.json');
          if (fs.existsSync(pkgJsonPath)) {
            const pkgJson = this.readJsonFile(pkgJsonPath);
            if (pkgJson && pkgJson.name) {
              outPackages.push({
                name: pkgJson.name,
                path: relativeDir,
              });
            }
          }
          walk(fullPath, depth + 1);
        }
      }
    };

    walk(rootDir);
  }

  /**
   * Resolve path aliases from tsconfig.json or jsconfig.json
   */
  private static resolveCompilerAliases(rootDir: string): Record<string, string[]> {
    const aliases: Record<string, string[]> = {};
    const tsconfigPath = path.join(rootDir, 'tsconfig.json');
    const jsconfigPath = path.join(rootDir, 'jsconfig.json');
    let configPath = '';

    if (fs.existsSync(tsconfigPath)) {
      configPath = tsconfigPath;
    } else if (fs.existsSync(jsconfigPath)) {
      configPath = jsconfigPath;
    }

    if (configPath) {
      try {
        const rawContent = fs.readFileSync(configPath, 'utf8');
        const cleanContent = this.stripJsonComments(rawContent);
        const config = JSON.parse(cleanContent);
        const paths = config.compilerOptions?.paths;
        if (paths && typeof paths === 'object') {
          for (const key of Object.keys(paths)) {
            if (Array.isArray(paths[key])) {
              aliases[key] = paths[key];
            }
          }
        }
      } catch (e) {
        // Fallback to empty on parse failure
      }
    }

    return aliases;
  }

  /**
   * Strip single-line and multi-line comments from JSON string
   */
  private static stripJsonComments(jsonStr: string): string {
    return jsonStr
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(?:^|[^:])\/\/.*$/gm, (match) => {
        if (match.startsWith('//')) return '';
        return match.charAt(0);
      });
  }

  /**
   * Helper to safely read and parse a JSON file
   */
  private static readJsonFile(filePath: string): any {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(this.stripJsonComments(raw));
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Detect potential execution entry points based on file presence
   */
  private static detectEntryPoints(rootDir: string, packageJson: any, framework: string): string[] {
    const entryPoints = new Set<string>();

    // 1. Check bin files in package.json
    if (packageJson.bin) {
      if (typeof packageJson.bin === 'string') {
        const binPath = packageJson.bin;
        this.addIfFileExists(rootDir, binPath, entryPoints);
        // Also add potential source files matching the compiled bin path (e.g. dist/cli.js -> src/cli.ts)
        this.addSrcFallbackForBin(rootDir, binPath, entryPoints);
      } else if (typeof packageJson.bin === 'object') {
        for (const key of Object.keys(packageJson.bin)) {
          const binPath = packageJson.bin[key];
          this.addIfFileExists(rootDir, binPath, entryPoints);
          this.addSrcFallbackForBin(rootDir, binPath, entryPoints);
        }
      }
    }

    // 2. Check main/module fields in package.json
    if (packageJson.main) {
      this.addIfFileExists(rootDir, packageJson.main, entryPoints);
      this.addSrcFallbackForBin(rootDir, packageJson.main, entryPoints);
    }
    if (packageJson.module) {
      this.addIfFileExists(rootDir, packageJson.module, entryPoints);
      this.addSrcFallbackForBin(rootDir, packageJson.module, entryPoints);
    }

    // 3. Framework-specific defaults
    const candidatePaths: string[] = [];

    if (framework === 'next') {
      candidatePaths.push(
        'app/layout.tsx',
        'app/page.tsx',
        'pages/_app.tsx',
        'pages/index.tsx',
        'src/pages/_app.tsx',
        'src/pages/index.tsx'
      );
    } else if (framework === 'angular') {
      candidatePaths.push('src/main.ts');
    } else if (framework === 'react-vite' || framework === 'react-cra') {
      candidatePaths.push(
        'src/main.tsx',
        'src/index.tsx',
        'src/main.ts',
        'src/index.ts',
        'main.tsx',
        'index.tsx',
        'index.html'
      );
    } else {
      // Node/Express/libs
      candidatePaths.push(
        'server.ts',
        'src/server.ts',
        'index.ts',
        'src/index.ts',
        'main.ts',
        'src/main.ts',
        'app.ts',
        'src/app.ts',
        'index.js',
        'src/index.js',
        'server.js',
        'src/server.js'
      );
    }

    for (const cand of candidatePaths) {
      this.addIfFileExists(rootDir, cand, entryPoints);
    }

    return Array.from(entryPoints);
  }

  private static addIfFileExists(rootDir: string, relPath: string, set: Set<string>) {
    const cleanPath = relPath.replace(/^\.\//, '');
    const fullPath = path.join(rootDir, cleanPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      set.add(cleanPath);
    }
  }

  /**
   * If a binary is pointing to something like dist/cli.js, we should also treat src/cli.ts as an entry point
   */
  private static addSrcFallbackForBin(rootDir: string, binPath: string, set: Set<string>) {
    const cleanPath = binPath.replace(/^\.\//, '');
    if (cleanPath.startsWith('dist/') || cleanPath.startsWith('build/') || cleanPath.startsWith('out/')) {
      const folderRemoved = cleanPath.split('/').slice(1).join('/'); // cli.js
      const baseName = path.basename(folderRemoved, path.extname(folderRemoved)); // cli
      
      const potentialSourceFiles = [
        `src/${baseName}.ts`,
        `src/${baseName}.tsx`,
        `src/${baseName}.js`,
        `src/${baseName}.jsx`,
        `src/index.ts`,
        `src/index.js`,
        `src/main.ts`,
        `src/main.js`
      ];

      for (const srcPath of potentialSourceFiles) {
        if (fs.existsSync(path.join(rootDir, srcPath))) {
          set.add(srcPath);
          break;
        }
      }
    }
  }
}
