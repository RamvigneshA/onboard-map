/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppImportGraph } from '../../src/services/import-graph.service';
import { FileNode, ImportEdge } from '../../src/models/types';

// Simple lightweight test runner helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function runTest() {
  console.log('Running Import Graph Service Tests...');

  const mockFiles: FileNode[] = [
    { path: 'src/main.tsx', loc: 10, hasTestFile: false },
    { path: 'src/App.tsx', loc: 50, hasTestFile: true },
    { path: 'src/services/api-client.ts', loc: 120, hasTestFile: false },
    { path: 'src/auth/authSlice.ts', loc: 80, hasTestFile: true },
  ];

  const mockEdges: ImportEdge[] = [
    { from: 'src/main.tsx', to: 'src/App.tsx', isTypeOnly: false },
    { from: 'src/App.tsx', to: 'src/services/api-client.ts', isTypeOnly: false },
    { from: 'src/App.tsx', to: 'src/auth/authSlice.ts', isTypeOnly: false },
    // Type-only import (should not count as value-level loop)
    { from: 'src/services/api-client.ts', to: 'src/auth/authSlice.ts', isTypeOnly: true },
  ];

  const graph = new AppImportGraph(mockFiles, mockEdges);

  // Test Fan-In and Fan-Out
  assert(graph.fanIn('src/App.tsx') === 1, 'App.tsx fan-in should be 1');
  assert(graph.fanOut('src/App.tsx') === 2, 'App.tsx fan-out should be 2');
  assert(graph.fanIn('src/auth/authSlice.ts') === 2, 'authSlice fan-in should be 2 (including type import)');

  // Test BFS path finding
  const path = graph.findShortestPath('src/main.tsx', 'src/auth/authSlice.ts');
  assert(path !== null, 'Path should be found');
  assert(path![0] === 'src/main.tsx', 'Path start');
  assert(path![1] === 'src/App.tsx', 'Path intermediate');
  assert(path![2] === 'src/auth/authSlice.ts', 'Path target');

  // Test circular cycle detection (no cycles yet)
  const cycles = graph.findCycles();
  assert(cycles.length === 0, 'No cycles should be detected on value-level imports');

  console.log('✓ Import Graph Service Tests Passed Successfully!');
}

try {
  runTest();
} catch (e) {
  console.error('Test failed:', e);
  process.exit(1);
}
