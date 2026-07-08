/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Check, CheckResult, Context } from '../models/types';

export class DocumentationCheck implements Check {
  id = 'documentation';
  deep = false;

  async run(context: Context): Promise<CheckResult> {
    const filesInRoot = fs.readdirSync(context.rootDir);
    
    const findFileCaseInsensitive = (baseName: string): string | undefined => {
      const lowerBase = baseName.toLowerCase();
      return filesInRoot.find(f => {
        const lowerFile = f.toLowerCase();
        return lowerFile === lowerBase || 
               lowerFile === `${lowerBase}.md` || 
               lowerFile === `${lowerBase}.txt`;
      });
    };

    const hasReadme = !!findFileCaseInsensitive('readme') || context.readmeContent !== null;
    const hasLicense = !!findFileCaseInsensitive('license');
    const hasChangelog = !!findFileCaseInsensitive('changelog');
    const hasContributing = !!findFileCaseInsensitive('contributing');

    const foundDocs: string[] = [];
    if (hasReadme) foundDocs.push('README');
    if (hasLicense) foundDocs.push('LICENSE');
    if (hasChangelog) foundDocs.push('CHANGELOG');
    if (hasContributing) foundDocs.push('CONTRIBUTING');

    const summary = foundDocs.length > 0
      ? `${foundDocs.join(', ')} files detected`
      : 'No standard documentation files detected';

    const severity = hasReadme ? 'info' : 'risk'; // Critical risk if no README exists!

    return {
      id: this.id,
      title: 'Documentation',
      severity,
      summary,
      details: {
        hasReadme,
        hasLicense,
        hasChangelog,
        hasContributing,
        foundDocs,
      },
    };
  }
}
