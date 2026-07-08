# Contributing to onboard-map

Thank you for your interest in contributing to `onboard-map`! This document guides you through our design principles, codebase structure, and pull request processes.

## Architectural Integrity Rules

To preserve the utility and deterministic speed of this offline diagnostic tool, we maintain strict guardrails:

1. **Zero External Integrations**: Every parser, check, and routine must run 100% locally on the filesystem and local `git`. No network calls, remote API connections, or proprietary keys are allowed.
2. **Strict Functional Purity**: All check modules must adhere to the pure function contract: `(context: Context) => Promise<CheckResult>`. No check may emit write side-effects, edit files, or manipulate the terminal display directly.
3. **No TypeScript `any`**: Type safety is verified via strict compiler checks. Always define specific payload details and import shapes.
4. **Value-Level vs. Type-Level Cycle Isolation**: In `import-graph.service.ts`, value-level imports (dependencies that generate bundle output) are strictly separated from type-only imports (`import type`). This prevents false-positive warnings in circular dependency checks.

## Development Lifecycle

### Getting Started
1. Clone the repository
2. Install local dependencies:
   ```bash
   npm install
   ```

### Running Tests
We enforce local test backstops. To run unit tests:
```bash
npm run test
```

### Type Checking & Linting
Ensure all TypeScript definitions compile cleanly before submitting pull requests:
```bash
npm run lint
```

### Compilation & Building
To build the CLI bundle and the companion dashboard SPA:
```bash
npm run build
```

## Adding a Custom Check

1. **Implement the Check Interface**: Create your check file under `src/checks/` (or `src/checks/deep/` if it requires deep git history or extensive graph traversals).
   ```typescript
   import { Check, CheckResult, Context } from '../models/types';

   export class MyCustomCheck implements Check {
     id = 'my-custom-check';
     deep = false; // Set to true if computationally expensive

     async run(context: Context): Promise<CheckResult> {
       // Your pure analysis logic...
       return {
         id: this.id,
         title: 'My Custom Check',
         severity: 'info',
         summary: 'Clean analysis summary',
         details: { /* custom payload */ }
       };
     }
   }
   ```
2. **Register the Check**: Add your class instantiation in `src/core/engine.ts` inside the `CodebaseEngine`'s constructor.
3. **Add Tests**: Create a corresponding unit test file under `test/checks/my-custom-check.test.ts` and add it to the `test` script in `package.json`.
