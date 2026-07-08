/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppImportGraph } from '../../src/services/import-graph.service';
import { FileNode, ImportEdge } from '../../src/models/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function runTest() {
  console.log('Running Circular Dependencies Check Tests...');

  const mockFiles: FileNode[] = [
    { path: 'A.ts', loc: 10, hasTestFile: false },
    { path: 'B.ts', loc: 10, hasTestFile: false },
    { path: 'C.ts', loc: 10, hasTestFile: false },
  ];

  // Create a circle: A -> B -> C -> A
  const mockEdges: ImportEdge[] = [
    { from: 'A.ts', to: 'B.ts', isTypeOnly: false },
    { from: 'B.ts', to: 'C.ts', isTypeOnly: false },
    { from: 'C.ts', to: 'A.ts', isTypeOnly: false },
  ];

  const graph = new AppImportGraph(mockFiles, mockEdges);
  const cycles = graph.findCycles();

  assert(cycles.length === 1, 'Should find exactly 1 circular loop');
  assert(cycles[0].includes('A.ts'), 'Cycle contains A');
  assert(cycles[0].includes('B.ts'), 'Cycle contains B');
  assert(cycles[0].includes('C.ts'), 'Cycle contains C');

  // Test that type-only imports break the cycle
  const mockEdgesWithType: ImportEdge[] = [
    { from: 'A.ts', to: 'B.ts', isTypeOnly: false },
    { from: 'B.ts', to: 'C.ts', isTypeOnly: false },
    // C imports A as a type-only import
    { from: 'C.ts', to: 'A.ts', isTypeOnly: true },
  ];

  const graphWithType = new AppImportGraph(mockFiles, mockEdgesWithType);
  const cyclesWithType = graphWithType.findCycles();
  assert(cyclesWithType.length === 0, 'Type-only imports should be excluded from circular cycles');

  console.log('✓ Circular Dependencies Check Tests Passed Successfully!');
}

try {
  runTest();
} catch (e) {
  console.error('Test failed:', e);
  process.exit(1);
}
