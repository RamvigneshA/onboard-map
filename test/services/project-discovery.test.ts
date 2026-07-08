/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProjectDiscoveryService } from '../../src/services/project-discovery.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function runTest() {
  console.log('Running Project Discovery Service Tests...');

  const tempDir = path.resolve('./test/temp-project-test');

  // Clean up any stale temp dir from previous run failures
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // Create temporary project structure
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'apps/app-a'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'packages/shared'), { recursive: true });

  // Write package.json files
  const rootPkg = {
    name: 'test-monorepo',
    private: true,
    workspaces: ['apps/*', 'packages/*'],
    dependencies: {
      react: '^18.0.0',
    },
    devDependencies: {
      vite: '^4.0.0',
    }
  };
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(rootPkg, null, 2));

  const appPkg = { name: 'app-a', private: true, dependencies: { 'shared-lib': 'workspace:*' } };
  fs.writeFileSync(path.join(tempDir, 'apps/app-a/package.json'), JSON.stringify(appPkg, null, 2));

  const sharedPkg = { name: 'shared-lib', version: '1.0.0', main: 'src/index.ts' };
  fs.writeFileSync(path.join(tempDir, 'packages/shared/package.json'), JSON.stringify(sharedPkg, null, 2));

  // Write other indicator files
  fs.writeFileSync(path.join(tempDir, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n  - "packages/*"\n');
  fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), ''); // Package manager indicator
  fs.writeFileSync(path.join(tempDir, 'vite.config.ts'), 'export default {};'); // Vite config
  fs.writeFileSync(path.join(tempDir, 'src/main.tsx'), 'console.log("hello");'); // Entry point

  // Write tsconfig.json with aliases and comments
  const tsconfigContent = `
    // This is a test comment
    {
      "compilerOptions": {
        "baseUrl": ".",
        /* Multi-line comment */
        "paths": {
          "@/*": ["src/*"],
          "shared-lib": ["packages/shared/src/index.ts"]
        }
      }
    }
  `;
  fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), tsconfigContent);

  try {
    // Run discovery
    const meta = ProjectDiscoveryService.discover(tempDir);

    // Assert values
    assert(meta.framework === 'react-vite', `Framework should be react-vite, got ${meta.framework}`);
    assert(meta.packageManager === 'pnpm', `Package manager should be pnpm, got ${meta.packageManager}`);
    assert(meta.workspaceType === 'pnpm', `Workspace type should be pnpm, got ${meta.workspaceType}`);
    assert(meta.projectType === 'monorepo', `Project type should be monorepo, got ${meta.projectType}`);

    // Workspace packages check
    assert(meta.workspacePackages.length >= 2, 'Should find at least 2 packages');
    const appPkgMeta = meta.workspacePackages.find(p => p.name === 'app-a');
    const sharedPkgMeta = meta.workspacePackages.find(p => p.name === 'shared-lib');
    assert(!!appPkgMeta, 'Should discover app-a workspace package');
    assert(!!sharedPkgMeta, 'Should discover shared-lib workspace package');
    assert(appPkgMeta!.path === 'apps/app-a', `app-a path should be apps/app-a, got ${appPkgMeta!.path}`);

    // Entry points check
    assert(meta.entryPoints.includes('src/main.tsx'), 'Should detect src/main.tsx as entry point');

    // Aliases check
    assert(!!meta.aliases['@/*'], 'Should discover @/* alias');
    assert(meta.aliases['@/*'][0] === 'src/*', 'Should map to src/*');
    assert(meta.aliases['shared-lib'][0] === 'packages/shared/src/index.ts', 'Should map shared-lib');

    console.log('✓ Project Discovery Service Tests Passed Successfully!');
  } finally {
    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  runTest();
} catch (e) {
  console.error('Test failed:', e);
  process.exit(1);
}
