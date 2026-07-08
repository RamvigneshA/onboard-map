/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'path';
import { Context } from '../models/types';
import { ImportGraphService } from '../services/import-graph.service';
import { GitHistoryService } from '../services/git-history.service';
import { FsService } from '../services/fs.service';
import { ProjectDiscoveryService } from '../services/project-discovery.service';

export class ContextBuilder {
  static build(rootDir: string, targetDir?: string): { context: Context; isRealGit: boolean } {
    const absoluteRootDir = path.resolve(rootDir);
    const absoluteTargetDir = targetDir ? path.resolve(targetDir) : undefined;

    // 0. Discover project-wide metadata
    const projectMeta = ProjectDiscoveryService.discover(absoluteRootDir);

    // 1. Build import graph
    const importGraph = ImportGraphService.buildGraph(absoluteRootDir, absoluteTargetDir);

    // 2. Fetch git history based on the files discovered in the import graph
    const filePaths = importGraph.files.map(f => f.path);
    const { commits, isRealGit } = GitHistoryService.getHistory(absoluteRootDir, filePaths);

    // 3. Read other ecosystem files
    const packageJson = FsService.readPackageJson(absoluteRootDir);
    const readmeContent = FsService.readReadme(absoluteRootDir);
    const envExampleKeys = FsService.readEnvExampleKeys(absoluteRootDir);

    const context: Context = {
      rootDir: absoluteRootDir,
      importGraph,
      gitLog: commits,
      packageJson,
      readmeContent,
      envExampleKeys,
      projectMeta,
    };

    return { context, isRealGit };
  }
}
