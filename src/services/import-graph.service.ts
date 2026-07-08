/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Project, SourceFile, Node } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { FileNode, ImportEdge, ImportGraph } from '../models/types';
import { FsService } from './fs.service';
import { ProjectDiscoveryService } from './project-discovery.service';

export class AppImportGraph implements ImportGraph {
  files: FileNode[];
  edges: ImportEdge[];

  private fanInMap: Map<string, number> = new Map();
  private fanOutMap: Map<string, number> = new Map();
  private adjList: Map<string, ImportEdge[]> = new Map();
  private revAdjList: Map<string, ImportEdge[]> = new Map();

  constructor(files: FileNode[], edges: ImportEdge[]) {
    this.files = files;
    this.edges = edges;

    // Initialize map structures
    for (const file of files) {
      this.fanInMap.set(file.path, 0);
      this.fanOutMap.set(file.path, 0);
      this.adjList.set(file.path, []);
      this.revAdjList.set(file.path, []);
    }

    // Populate maps
    for (const edge of edges) {
      const fromList = this.adjList.get(edge.from) || [];
      fromList.push(edge);
      this.adjList.set(edge.from, fromList);

      const toList = this.revAdjList.get(edge.to) || [];
      toList.push(edge);
      this.revAdjList.set(edge.to, toList);

      this.fanOutMap.set(edge.from, (this.fanOutMap.get(edge.from) || 0) + 1);
      this.fanInMap.set(edge.to, (this.fanInMap.get(edge.to) || 0) + 1);
    }
  }

  fanIn(file: string, options?: { includeReExports?: boolean }): number {
    const includeReExports = options?.includeReExports !== false;
    const edgesTo = this.getEdgesTo(file);
    if (includeReExports) {
      return edgesTo.length;
    } else {
      return edgesTo.filter(e => !e.isReExport).length;
    }
  }

  fanOut(file: string, options?: { includeReExports?: boolean }): number {
    const includeReExports = options?.includeReExports !== false;
    const edgesFrom = this.getEdgesFrom(file);
    if (includeReExports) {
      return edgesFrom.length;
    } else {
      return edgesFrom.filter(e => !e.isReExport).length;
    }
  }

  getEdgesFrom(file: string): ImportEdge[] {
    return this.adjList.get(file) || [];
  }

  getEdgesTo(file: string): ImportEdge[] {
    return this.revAdjList.get(file) || [];
  }

  /**
   * Find circular dependencies on value-level imports (exclude type-only imports)
   */
  findCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack: string[] = [];
    const recStackSet = new Set<string>();

    const dfs = (node: string) => {
      visited.add(node);
      recStack.push(node);
      recStackSet.add(node);

      const edges = this.getEdgesFrom(node).filter(e => !e.isTypeOnly);
      for (const edge of edges) {
        const neighbor = edge.to;
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStackSet.has(neighbor)) {
          // Cycle found! Extract cycle path from stack
          const cycleStartIdx = recStack.indexOf(neighbor);
          const cycle = recStack.slice(cycleStartIdx);
          cycles.push([...cycle, neighbor]);
        }
      }

      recStack.pop();
      recStackSet.delete(node);
    };

    for (const file of this.files) {
      if (!visited.has(file.path)) {
        dfs(file.path);
      }
    }

    // Remove duplicates or sub-cycles to keep report clean
    const uniqueCycles: string[][] = [];
    const seenCycles = new Set<string>();

    for (const cycle of cycles) {
      // Normalize cycle to start with lexicographically smallest node
      const minVal = [...cycle].sort()[0];
      const startIdx = cycle.indexOf(minVal);
      const normalized = [...cycle.slice(startIdx, -1), ...cycle.slice(0, startIdx)];
      const key = normalized.join('->');
      if (!seenCycles.has(key)) {
        seenCycles.add(key);
        uniqueCycles.push([...normalized, normalized[0]]);
      }
    }

    return uniqueCycles;
  }

  /**
   * Shortest path BFS from starting nodes to target
   */
  findShortestPath(from: string, to: string): string[] | null {
    if (from === to) return [from];
    const queue: string[][] = [[from]];
    const visited = new Set<string>([from]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const last = path[path.length - 1];

      const edges = this.getEdgesFrom(last);
      for (const edge of edges) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          const newPath = [...path, edge.to];
          if (edge.to === to) return newPath;
          queue.push(newPath);
        }
      }
    }
    return null;
  }

  /**
   * BFS levels from an entry point file
   */
  getBfsLevels(entryPoints: string[], maxDepth = 5): Map<string, number> {
    const depths = new Map<string, number>();
    const queue: { path: string; depth: number }[] = [];

    for (const ep of entryPoints) {
      if (this.adjList.has(ep)) {
        queue.push({ path: ep, depth: 0 });
        depths.set(ep, 0);
      }
    }

    while (queue.length > 0) {
      const { path: current, depth } = queue.shift()!;
      if (depth >= maxDepth) continue;

      const edges = this.getEdgesFrom(current);
      for (const edge of edges) {
        if (!depths.has(edge.to)) {
          depths.set(edge.to, depth + 1);
          queue.push({ path: edge.to, depth: depth + 1 });
        }
      }
    }

    return depths;
  }
}

export class ImportGraphService {
  private static isExecutableModule(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext);
  }

  private static resolveFileWithExtensions(candidatePath: string): string | null {
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      return candidatePath;
    }
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    for (const ext of extensions) {
      const p = candidatePath + ext;
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return p;
      }
    }
    // If it is a directory, check for index files
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
      for (const ext of extensions) {
        const p = path.join(candidatePath, 'index' + ext);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          return p;
        }
      }
    }
    return null;
  }

  private static resolveAlias(specifier: string, aliases: Record<string, string[]>, rootDir: string): string | null {
    for (const pattern of Object.keys(aliases)) {
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        if (specifier.startsWith(prefix)) {
          const subPath = specifier.slice(prefix.length);
          const targets = aliases[pattern];
          for (const target of targets) {
            if (target.endsWith('/*')) {
              const targetPrefix = target.slice(0, -2);
              const resolvedRel = path.join(targetPrefix, subPath);
              const resolvedAbs = path.resolve(rootDir, resolvedRel);
              const found = this.resolveFileWithExtensions(resolvedAbs);
              if (found) return found;
            }
          }
        }
      } else if (specifier === pattern) {
        const targets = aliases[pattern];
        for (const target of targets) {
          const resolvedAbs = path.resolve(rootDir, target);
          const found = this.resolveFileWithExtensions(resolvedAbs);
          if (found) return found;
        }
      }
    }
    return null;
  }

  private static resolveWorkspacePackage(specifier: string, workspacePackages: { name: string; path: string }[], rootDir: string): string | null {
    const matchedPkg = workspacePackages.find(p => specifier === p.name || specifier.startsWith(p.name + '/'));
    if (matchedPkg) {
      const pkgAbsDir = path.resolve(rootDir, matchedPkg.path);
      if (specifier === matchedPkg.name) {
        try {
          const pkgJsonPath = path.join(pkgAbsDir, 'package.json');
          if (fs.existsSync(pkgJsonPath)) {
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
            const entry = pkgJson.module || pkgJson.main;
            if (entry) {
              const found = this.resolveFileWithExtensions(path.resolve(pkgAbsDir, entry));
              if (found) return found;
            }
          }
        } catch (e) {
          // ignore
        }
        return this.resolveFileWithExtensions(path.join(pkgAbsDir, 'src/index')) || 
               this.resolveFileWithExtensions(path.join(pkgAbsDir, 'index'));
      } else {
        const subPath = specifier.slice(matchedPkg.name.length + 1);
        return this.resolveFileWithExtensions(path.resolve(pkgAbsDir, subPath));
      }
    }
    return null;
  }

  static buildGraph(rootDir: string, targetDir?: string): AppImportGraph {
    const searchPath = targetDir || rootDir;
    
    // Discover project metadata to helper resolver
    const meta = ProjectDiscoveryService.discover(rootDir);

    // Create ts-morph Project
    let project: Project;
    const tsconfigPath = path.join(rootDir, 'tsconfig.json');
    
    if (fs.existsSync(tsconfigPath)) {
      project = new Project({
        tsConfigFilePath: tsconfigPath,
        skipAddingFilesFromTsConfig: false,
      });
    } else {
      project = new Project();
    }

    // Explicitly find and add all JS/TS files in search path to ensure ts-morph has them loaded
    const allFiles = FsService.walkFiles(searchPath);
    for (const file of allFiles) {
      try {
        project.addSourceFileAtPath(file);
      } catch (e) {
        // Skip
      }
    }

    const sourceFiles = project.getSourceFiles();
    const files: FileNode[] = [];
    const edges: ImportEdge[] = [];
    const absoluteToRelative = (absPath: string) => path.relative(rootDir, absPath);

    // Filter files to only targetDir if specified
    const targetDirNormalized = targetDir ? path.resolve(targetDir) : null;
    const filteredSourceFiles = sourceFiles.filter(sf => {
      const filePath = sf.getFilePath();
      // Exclude node_modules and output directories
      if (filePath.includes('node_modules') || filePath.includes('/dist/') || filePath.includes('/build/') || filePath.includes('/coverage/') || filePath.includes('/.next/')) {
        return false;
      }
      if (targetDirNormalized) {
        return filePath.startsWith(targetDirNormalized);
      }
      return true;
    });

    for (const sf of filteredSourceFiles) {
      const absolutePath = sf.getFilePath();
      const relativePath = absoluteToRelative(absolutePath);
      if (!this.isExecutableModule(relativePath)) {
        continue;
      }
      const text = sf.getFullText();
      const loc = text.split('\n').length;

      // Check for matching test file (e.g. .test.ts, .spec.ts, __tests__/)
      const ext = path.extname(absolutePath);
      const baseName = path.basename(absolutePath, ext);
      const dirName = path.dirname(absolutePath);
      
      const potentialTests = [
        path.join(dirName, `${baseName}.test${ext}`),
        path.join(dirName, `${baseName}.spec${ext}`),
        path.join(dirName, `${baseName}.test.tsx`),
        path.join(dirName, `${baseName}.test.ts`),
        path.join(dirName, '__tests__', `${baseName}${ext}`),
        path.join(dirName, '__tests__', `${baseName}.test${ext}`),
      ];

      const hasTestFile = potentialTests.some(testPath => fs.existsSync(testPath));

      files.push({
        path: relativePath,
        loc,
        hasTestFile,
      });

      // Parse import declarations
      const imports = sf.getImportDeclarations();
      for (const imp of imports) {
        const isTypeOnly = imp.isTypeOnly();
        const importedRelPaths = new Set<string>();

        // Trace actual definitions to follow re-exports
        try {
          const namedImports = imp.getNamedImports();
          for (const named of namedImports) {
            const nameNode = named.getNameNode();
            if (Node.isIdentifier(nameNode)) {
              const defs = nameNode.getDefinitions();
              for (const def of defs) {
                const defSf = def.getSourceFile();
                if (defSf) {
                  const defAbsPath = defSf.getFilePath();
                  if (!defAbsPath.includes('node_modules')) {
                    const rel = absoluteToRelative(defAbsPath);
                    if (rel && rel !== relativePath && this.isExecutableModule(rel)) {
                      importedRelPaths.add(rel);
                    }
                  }
                }
              }
            }
          }

          const defaultImport = imp.getDefaultImport();
          if (defaultImport && Node.isIdentifier(defaultImport)) {
            const defs = defaultImport.getDefinitions();
            for (const def of defs) {
              const defSf = def.getSourceFile();
              if (defSf) {
                const defAbsPath = defSf.getFilePath();
                if (!defAbsPath.includes('node_modules')) {
                  const rel = absoluteToRelative(defAbsPath);
                  if (rel && rel !== relativePath && this.isExecutableModule(rel)) {
                    importedRelPaths.add(rel);
                  }
                }
              }
            }
          }
        } catch (e) {
          // ignore compiler/language service errors
        }

        // Always resolve direct module specifier path too
        let directRelPath: string | null = null;
        const importedSourceFile = imp.getModuleSpecifierSourceFile();
        if (importedSourceFile) {
          const importedAbsPath = importedSourceFile.getFilePath();
          if (!importedAbsPath.includes('node_modules')) {
            directRelPath = absoluteToRelative(importedAbsPath);
          }
        }

        if (!directRelPath) {
          try {
            const specifier = imp.getModuleSpecifierValue();
            const sourceFileAbsPath = sf.getFilePath();
            const sourceFileDir = path.dirname(sourceFileAbsPath);

            if (specifier.startsWith('.')) {
              const candidateAbs = path.resolve(sourceFileDir, specifier);
              const resolvedAbs = this.resolveFileWithExtensions(candidateAbs);
              if (resolvedAbs) {
                directRelPath = absoluteToRelative(resolvedAbs);
              }
            } else {
              const resolvedAbsAlias = this.resolveAlias(specifier, meta.aliases, rootDir);
              if (resolvedAbsAlias) {
                directRelPath = absoluteToRelative(resolvedAbsAlias);
              } else {
                const resolvedAbsPkg = this.resolveWorkspacePackage(specifier, meta.workspacePackages, rootDir);
                if (resolvedAbsPkg) {
                  directRelPath = absoluteToRelative(resolvedAbsPkg);
                } else {
                  const candidateBaseUrl = path.resolve(rootDir, specifier);
                  let resolvedAbsBase = this.resolveFileWithExtensions(candidateBaseUrl);
                  if (!resolvedAbsBase) {
                    resolvedAbsBase = this.resolveFileWithExtensions(path.resolve(rootDir, 'src', specifier));
                  }
                  if (resolvedAbsBase) {
                    directRelPath = absoluteToRelative(resolvedAbsBase);
                  }
                }
              }
            }
          } catch (e) {
            // ignore
          }
        }

        if (directRelPath && directRelPath !== relativePath && this.isExecutableModule(directRelPath)) {
          importedRelPaths.add(directRelPath);
        }

        for (const relPath of importedRelPaths) {
          edges.push({
            from: relativePath,
            to: relPath,
            isTypeOnly,
          });
        }
      }

      // Parse export declarations that export from another file
      try {
        const exports = sf.getExportDeclarations();
        for (const exp of exports) {
          const specifier = exp.getModuleSpecifierValue();
          if (specifier) {
            const isTypeOnly = exp.isTypeOnly();
            let exportedRelPath: string | null = null;
            const exportedSourceFile = exp.getModuleSpecifierSourceFile();

            if (exportedSourceFile) {
              const exportedAbsPath = exportedSourceFile.getFilePath();
              if (!exportedAbsPath.includes('node_modules')) {
                exportedRelPath = absoluteToRelative(exportedAbsPath);
              }
            }

            if (!exportedRelPath) {
              const sourceFileAbsPath = sf.getFilePath();
              const sourceFileDir = path.dirname(sourceFileAbsPath);

              if (specifier.startsWith('.')) {
                const candidateAbs = path.resolve(sourceFileDir, specifier);
                const resolvedAbs = this.resolveFileWithExtensions(candidateAbs);
                if (resolvedAbs) {
                  exportedRelPath = absoluteToRelative(resolvedAbs);
                }
              } else {
                const resolvedAbsAlias = this.resolveAlias(specifier, meta.aliases, rootDir);
                if (resolvedAbsAlias) {
                  exportedRelPath = absoluteToRelative(resolvedAbsAlias);
                } else {
                  const resolvedAbsPkg = this.resolveWorkspacePackage(specifier, meta.workspacePackages, rootDir);
                  if (resolvedAbsPkg) {
                    exportedRelPath = absoluteToRelative(resolvedAbsPkg);
                  } else {
                    const candidateBaseUrl = path.resolve(rootDir, specifier);
                    let resolvedAbsBase = this.resolveFileWithExtensions(candidateBaseUrl);
                    if (!resolvedAbsBase) {
                      resolvedAbsBase = this.resolveFileWithExtensions(path.resolve(rootDir, 'src', specifier));
                    }
                    if (resolvedAbsBase) {
                      exportedRelPath = absoluteToRelative(resolvedAbsBase);
                    }
                  }
                }
              }
            }

            if (exportedRelPath && exportedRelPath !== relativePath && this.isExecutableModule(exportedRelPath)) {
              edges.push({
                from: relativePath,
                to: exportedRelPath,
                isTypeOnly,
                isReExport: true,
              });
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }

    return new AppImportGraph(files, edges);
  }
}
