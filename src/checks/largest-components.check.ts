/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, CheckResult, Context } from '../models/types';
import * as path from 'path';

export interface LargestComponentResult {
  file: string;
  filename: string;
  loc: number;
}

export class LargestComponentsCheck implements Check {
  id = 'largest-components';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const files = context.importGraph.files;

    const sortedFiles: LargestComponentResult[] = files
      .map(f => ({
        file: f.path,
        filename: path.basename(f.path),
        loc: f.loc,
      }))
      .sort((a, b) => b.loc - a.loc)
      .slice(0, 10); // top 10 largest files

    const count = sortedFiles.filter(f => f.loc > 250).length;
    const severity = count > 1 ? 'warn' : 'info';
    
    let summary = 'Component sizes are well-balanced';
    if (count > 0) {
      summary = `${count} file${count === 1 ? '' : 's'} exceed 250 Lines of Code (LOC) and may benefit from refactoring`;
    }

    return {
      id: this.id,
      title: 'Largest Components',
      severity,
      summary,
      details: {
        files: sortedFiles,
      },
    };
  }
}
