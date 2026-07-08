/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pc from 'picocolors';
import { CheckResult, Reporter } from '../models/types';
import { HighRiskFileResult } from '../checks/high-risk.check';
import { SafeToPracticeResult } from '../checks/safe-to-practice.check';
import { OwnershipFolderResult } from '../checks/ownership.check';
import { CouplingHotspotResult } from '../checks/deep/coupling-hotspots.check';
import { BoundaryViolation } from '../checks/deep/boundary-violations.check';
import { BusFactorResult } from '../checks/deep/bus-factor.check';
import { KnowledgeGapResult } from '../checks/deep/knowledge-gap.check';
import { AcceleratingChurnResult } from '../checks/deep/accelerating-churn.check';
import { BarrelBloatResult } from '../checks/deep/barrel-bloat.check';
import { DeepImportChainResult } from '../checks/deep/deep-import-chains.check';

export class TerminalReporter implements Reporter {
  render(
    results: CheckResult[],
    meta: { filesScanned: number; edgeCount: number; durationMs: number; projectName: string; isRealGit: boolean; projectMeta?: any }
  ): string {
    const lines: string[] = [];

    lines.push('');
    lines.push(`  ${pc.bold(pc.cyan('onboard-map'))}`);
    lines.push(`  Inspecting ${pc.bold(meta.projectName)}...`);
    lines.push('');
    lines.push(`  ${pc.green('✓')} Parsed ${pc.bold(meta.filesScanned)} files, ${pc.bold(meta.edgeCount)} import edges`);
    if (meta.isRealGit) {
      lines.push(`  ${pc.green('✓')} Scanned git history`);
    } else {
      lines.push(`  ${pc.yellow('⚠')} Running with sandbox simulated history (no local git repo found)`);
    }

    if (meta.projectMeta) {
      const pm = meta.projectMeta;
      const frameworkLabel = pm.framework !== 'unknown' ? pm.framework.toUpperCase() : 'General JS/TS';
      const pmLabel = pm.packageManager !== 'unknown' ? pm.packageManager.toUpperCase() : 'npm';
      const workspaceLabel = pm.workspaceType !== 'none' ? `Monorepo (${pm.workspaceType.toUpperCase()})` : 'Single package';
      const typeLabel = pm.projectType !== 'unknown' ? pm.projectType.toUpperCase() : 'APPLICATION';

      lines.push(`  ${pc.green('✓')} Ecosystem: ${pc.bold(frameworkLabel)} | Package Manager: ${pc.bold(pmLabel)}`);
      lines.push(`  ${pc.green('✓')} Structure: ${pc.bold(workspaceLabel)} | Type: ${pc.bold(typeLabel)}`);
      if (pm.workspacePackages.length > 0) {
        lines.push(`  ${pc.green('✓')} Discovered ${pc.bold(pm.workspacePackages.length)} workspace package(s)`);
      }
    }

    lines.push('');
    lines.push(pc.dim('────────────────────────────────────────────'));
    lines.push('');

    for (const res of results) {
      if (res.id === 'entry-path') {
        const chain = res.details.chain as string[];
        if (chain && chain.length > 0) {
          lines.push(`📍 ${pc.bold('START HERE')}`);
          lines.push(`   ${chain.join(pc.dim(' → '))}`);
          lines.push('');
        }
      }

      else if (res.id === 'reading-path-by-feature') {
        const features = res.details.features as { folder: string; chain: string[] }[];
        if (features && features.length > 0) {
          lines.push(`🗺️  ${pc.bold('READING PATH BY FEATURE')}`);
          for (const feat of features) {
            lines.push(`   ${pc.cyan(feat.folder.padEnd(14))} ${feat.chain.join(pc.dim(' → '))}`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'high-risk') {
        const files = res.details.files as HighRiskFileResult[];
        if (files && files.length > 0) {
          lines.push(`⚠️  ${pc.bold(pc.red('HIGH RISK'))}`);
          for (const f of files) {
            const testLabel = f.hasTest ? pc.green('tested') : pc.yellow('no tests');
            lines.push(`   ${pc.red(f.filename.padEnd(20))} ${pc.bold(f.fanIn)} imports · ${pc.bold(f.changes90d)} changes/90d · ${testLabel}`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'circular-deps') {
        const cycles = res.details.cycles as string[][];
        if (cycles && cycles.length > 0) {
          lines.push(`🔁 ${pc.bold(pc.red('CIRCULAR IMPORTS'))}`);
          for (const cycle of cycles) {
            lines.push(`   ${cycle.join(pc.dim(' → '))}`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'safe-to-practice') {
        const files = res.details.files as SafeToPracticeResult[];
        if (files && files.length > 0) {
          lines.push(`🟢 ${pc.bold(pc.green('SAFE TO PRACTICE ON'))}`);
          for (const f of files) {
            lines.push(`   ${pc.green(f.filename.padEnd(20))} ${f.fanIn} import · stable · ${pc.green('tested')}`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'ownership') {
        const folders = res.details.folders as OwnershipFolderResult[];
        if (folders && folders.length > 0) {
          lines.push(`👤 ${pc.bold('WHO KNOWS THIS CODE')}`);
          for (const fold of folders) {
            lines.push(`   ${pc.cyan(fold.folder.padEnd(14))} ${pc.bold(fold.topAuthor)} (${fold.percentage}%)`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'dead-ends') {
        const files = res.details.files as { path: string; filename: string; loc: number }[];
        if (files && files.length > 0) {
          lines.push(`🕸️  ${pc.bold(pc.yellow('UNUSED FILES'))}`);
          for (const f of files) {
            lines.push(`   ${pc.yellow(f.path)}`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'env-mismatch') {
        const missing = res.details.missingVars as string[];
        if (missing && missing.length > 0) {
          lines.push(`🔧 ${pc.bold(pc.yellow('SETUP MISMATCH'))}`);
          lines.push(`   ${missing.length} env vars used in code, missing from .env.example:`);
          lines.push(`   ${pc.yellow(missing.join(', '))}`);
          lines.push('');
        }
      }

      else if (res.id === 'readme-staleness') {
        const details = res.details;
        if (details.nodeVersionMismatch || (details.mismatchedCommands && details.mismatchedCommands.length > 0)) {
          lines.push(`📄 ${pc.bold(pc.yellow('README OUT OF DATE'))}`);
          if (details.nodeVersionMismatch) {
            lines.push(`   README says Node ${details.readmeNodeVersion}+ — project uses Node ${details.actualNodeVersion}`);
          }
          for (const cmd of (details.mismatchedCommands || [])) {
            lines.push(`   Command \`${cmd}\` found in README but script is missing from package.json`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'coupling-hotspots') {
        const hotspots = res.details.hotspots as CouplingHotspotResult[];
        if (hotspots && hotspots.length > 0) {
          lines.push(`🧩 ${pc.bold(pc.red('COUPLING HOTSPOTS'))}`);
          for (const h of hotspots) {
            lines.push(`   ${pc.red(h.filename.padEnd(24))} imports ${h.fanOut} modules · imported by ${h.fanIn}`);
            lines.push(`   ${pc.dim('→ high refactor blast radius in both directions')}`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'boundary-violations') {
        const violations = res.details.violations as BoundaryViolation[];
        if (violations && violations.length > 0) {
          lines.push(`🚧 ${pc.bold(pc.yellow('BOUNDARY VIOLATIONS'))}`);
          for (const v of violations) {
            lines.push(`   ${pc.yellow(v.from)} → imports ${v.to}`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'bus-factor') {
        const files = res.details.files as BusFactorResult[];
        if (files && files.length > 0) {
          lines.push(`🚌 ${pc.bold(pc.red('BUS FACTOR RISK'))}`);
          for (const f of files) {
            lines.push(`   ${pc.red(f.file.padEnd(28))} ${f.percentage}% of commits by ${pc.bold(f.topAuthor)} (12mo)`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'knowledge-gap') {
        const gaps = res.details.gaps as KnowledgeGapResult[];
        if (gaps && gaps.length > 0) {
          lines.push(`👻 ${pc.bold(pc.yellow('KNOWLEDGE GAP'))}`);
          for (const g of gaps) {
            lines.push(`   ${pc.yellow(g.file.padEnd(28))} primary author ${pc.bold(g.primaryAuthor)}, 0 commits repo-wide in ${g.daysSinceLastRepoCommit}d`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'accelerating-churn') {
        const files = res.details.files as AcceleratingChurnResult[];
        if (files && files.length > 0) {
          lines.push(`📈 ${pc.bold(pc.red('ACCELERATING INSTABILITY'))}`);
          for (const f of files) {
            lines.push(`   ${pc.red(f.filename.padEnd(20))} ${f.commits30d} changes in last 30d vs ${f.commitsPrior60d} in prior 60d`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'barrel-bloat') {
        const files = res.details.files as BarrelBloatResult[];
        if (files && files.length > 0) {
          lines.push(`📦 ${pc.bold(pc.yellow('BARREL FILE BLOAT'))}`);
          for (const f of files) {
            lines.push(`   ${pc.yellow(f.file.padEnd(28))} re-exports ${f.fanOut} modules`);
          }
          lines.push('');
        }
      }

      else if (res.id === 'deep-import-chains') {
        const files = res.details.files as DeepImportChainResult[];
        if (files && files.length > 0) {
          lines.push(`🪆 ${pc.bold(pc.yellow('DEEP IMPORT CHAINS'))}`);
          for (const f of files) {
            lines.push(`   ${pc.yellow(f.file.padEnd(28))} ${f.depth} hops from entry point`);
          }
          lines.push('');
        }
      }
    }

    lines.push(pc.dim('────────────────────────────────────────────'));
    const durationS = (meta.durationMs / 1000).toFixed(1);
    lines.push(`  ${meta.filesScanned} files · ${meta.edgeCount} imports · done in ${durationS}s`);
    lines.push(`  Run with --deep for architecture-level findings`);
    lines.push(pc.dim('────────────────────────────────────────────'));
    lines.push('');

    return lines.join('\n');
  }
}
