/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../../models/types';
import { AppImportGraph } from '../../services/import-graph.service';
import * as path from 'path';

export interface KnowledgeGapResult {
  file: string;
  filename: string;
  primaryAuthor: string;
  authorLifetimeCommitsOnFile: number;
  totalCommitsOnFile: number;
  daysSinceLastRepoCommit: number;
}

export class KnowledgeGapCheck implements Check {
  id = 'knowledge-gap';
  deep = true;

  async run(context: Context): Promise<CheckResult> {
    const graph = context.importGraph as AppImportGraph;
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // 1. Identify active authors repo-wide in the last 90 days
    const activeAuthors = new Set<string>();
    const authorLastCommitMap = new Map<string, Date>();

    for (const commit of context.gitLog) {
      const commitDate = new Date(commit.date);
      const existingLast = authorLastCommitMap.get(commit.author);
      if (!existingLast || commitDate > existingLast) {
        authorLastCommitMap.set(commit.author, commitDate);
      }

      if (commitDate >= ninetyDaysAgo) {
        activeAuthors.add(commit.author);
      }
    }

    const gaps: KnowledgeGapResult[] = [];

    for (const file of graph.files) {
      const fileCommits = context.gitLog.filter(c => c.file === file.path);
      if (fileCommits.length === 0) continue;

      // Find primary author for this file
      const fileAuthorMap = new Map<string, number>();
      for (const commit of fileCommits) {
        fileAuthorMap.set(commit.author, (fileAuthorMap.get(commit.author) || 0) + 1);
      }

      let primaryAuthor = 'Unknown';
      let maxCommits = 0;
      for (const [author, count] of fileAuthorMap.entries()) {
        if (count > maxCommits) {
          maxCommits = count;
          primaryAuthor = author;
        }
      }

      // Check if primary author is inactive repo-wide in the last 90 days
      if (!activeAuthors.has(primaryAuthor) && primaryAuthor !== 'Unknown') {
        const lastCommitDate = authorLastCommitMap.get(primaryAuthor);
        let daysSinceLastRepoCommit = 999;
        
        if (lastCommitDate) {
          const diffTime = Math.abs(now.getTime() - lastCommitDate.getTime());
          daysSinceLastRepoCommit = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        gaps.push({
          file: file.path,
          filename: path.basename(file.path),
          primaryAuthor,
          authorLifetimeCommitsOnFile: maxCommits,
          totalCommitsOnFile: fileCommits.length,
          daysSinceLastRepoCommit,
        });
      }
    }

    // Sort by lifetime commits on the file descending (showing gap significance)
    gaps.sort((a, b) => b.authorLifetimeCommitsOnFile - a.authorLifetimeCommitsOnFile);

    const count = gaps.length;
    const severity = count > 0 ? 'risk' : 'info';
    let summary = 'All primary authors of code components are active';
    if (count > 0) {
      summary = `${count} primary author${count === 1 ? '' : 's'} are inactive repo-wide (knowledge gap risk)`;
    }

    return {
      id: this.id,
      title: 'Knowledge Gap',
      severity,
      summary,
      details: {
        gaps,
      },
    };
  }
}
