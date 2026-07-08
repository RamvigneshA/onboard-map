/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';

export interface OwnershipFolderResult {
  folder: string;
  topAuthor: string;
  percentage: number;
  commitCount: number;
  totalCommits: number;
}

export class OwnershipCheck implements Check {
  id = 'ownership';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Track commits by folder and author
    // Folder -> Author -> CommitCount
    const folderAuthorCommits = new Map<string, Map<string, number>>();

    for (const commit of context.gitLog) {
      // Filter for trailing 90 days
      if (new Date(commit.date) < ninetyDaysAgo) continue;

      // Extract folder name
      let folderName = 'root';
      const parts = commit.file.split('/');
      
      if (parts[0] === 'src') {
        if (parts[1] === 'features' && parts.length > 3) {
          folderName = parts[2];
        } else if (parts.length > 2) {
          folderName = parts[1];
        }
      } else if (parts.length > 1) {
        folderName = parts[0];
      }

      if (!folderName || folderName === 'models' || folderName === 'constants' || folderName === 'types') {
        continue;
      }

      const authorMap = folderAuthorCommits.get(folderName) || new Map<string, number>();
      authorMap.set(commit.author, (authorMap.get(commit.author) || 0) + 1);
      folderAuthorCommits.set(folderName, authorMap);
    }

    const folders: OwnershipFolderResult[] = [];

    for (const [folder, authorMap] of folderAuthorCommits.entries()) {
      let totalCommits = 0;
      let topAuthor = 'Unknown';
      let maxCommits = 0;

      for (const [author, count] of authorMap.entries()) {
        totalCommits += count;
        if (count > maxCommits) {
          maxCommits = count;
          topAuthor = author;
        }
      }

      if (totalCommits > 0) {
        folders.push({
          folder: `${folder}/`,
          topAuthor,
          percentage: Math.round((maxCommits / totalCommits) * 100),
          commitCount: maxCommits,
          totalCommits,
        });
      }
    }

    // Sort folders alphabetically
    folders.sort((a, b) => a.folder.localeCompare(b.folder));

    const summary = folders.length > 0
      ? `Ownership analyzed across ${folders.length} directories`
      : 'No active ownership data in the last 90 days';

    return {
      id: this.id,
      title: 'Who Knows This Code',
      severity: 'info',
      summary,
      details: {
        folders,
      },
    };
  }
}
