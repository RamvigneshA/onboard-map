# onboard-map 🗺️

`onboard-map` is a professional CLI and interactive visualizer that parses a TypeScript/React codebase's import graph, cross-references it with local git history, and outputs deep-dive diagnostic reports through two different organizational lenses:

*   **🔍 Day 1 New Hire**: Answers *"Where do I start reading? What's safe to touch? Who owns what?"*
*   **🧠 Staff Architect**: Answers *"Where is architectural risk concentrated? Where are coupling bottlenecks, circular chains, or siloed bus-factors?"*

All analysis runs **100% locally and offline** using `ts-morph` and local `git` log queries—no external networks, third-party API keys, or SaaS tokens are required.

---

## 🚀 Dual-Interface Access

`onboard-map` can be run in two modes: as a ultra-fast **Command Line Interface (CLI)** or as a **Full-Stack Dashboard Web App**.

### Mode A: Command Line Interface (CLI)

The standalone CLI parses your codebase and prints a beautifully colorized ANSI report directly to your terminal.

#### 1. Compile the Binary
```bash
npm run build
```
This builds the standalone ES module bundle into `dist/cli.js`.

#### 2. Run the CLI
Analyze the current directory:
```bash
node dist/cli.js
```

Analyze with additive **Deep checks** (Git churn analytics, bus factors, circular dependency paths):
```bash
node dist/cli.js --deep
```

Specify a custom directory to analyze:
```bash
node dist/cli.js --dir /path/to/another/project
```

Output as raw, structured **JSON** for machine consumption:
```bash
node dist/cli.js --json
```

---

### Mode B: Full-Stack Interactive Web Dashboard

To see your codebase represented as an interactive network graph, you can run the full-stack web application.

#### 1. Start the Server
```bash
npm run dev
```
This boots up an Express server on **port 3000** with integrated Vite middleware.

#### 2. Open the Visualizer
Navigate to `http://localhost:3000`. Inside, you can:
*   **Interactive Force-Directed Graph**: View files as nodes (scaled by incoming imports) and import links as directed paths. Hover, drag, and click nodes to inspect exact dependencies.
*   **Toggle Lenses**: Switch between the **New Hire** reading pathway and the **Staff Architect** risk metrics dashboard in real-time.
*   **Terminal Emulator**: View the exact, authentic CLI colorized terminal report.
*   **Universal Zip Analyzer**: Drag-and-drop or upload a `.zip` archive of *any* TypeScript codebase to instantly unzip, scan, and render its visual import graph on-the-fly.

---

## 📊 Dual-Lens Capabilities

### 🔍 Lens 1: The Day 1 New Hire
Designed to eliminate "analysis paralysis" on day one:
*   **📍 Entry Workflow Pathway**: Extracts the shortest topological entry path from `main.tsx`/`index.ts` to reveal the bootup cycle.
*   **🗺️ Feature Folders Reading Maps**: Groups files by top-level domains and lays out the primary entry-point imports for each feature.
*   **👥 Knowledge Ownership Tracker**: Computes which developer contributed the majority of changes to each module in the last 90 days.
*   **🛡️ Safe Practice Points**: Pinpoints highly stable, highly isolated helper files with existing test coverage as easy, low-risk starting points for practice tasks.
*   **🔧 Setup Auditor**: Audits `.env.example` mismatches and identifies missing node engine configurations in `package.json` vs. the project's `README.md`.

### 🧠 Lens 2: The Staff Architect
Designed to uncover structural rot and team alignment risks:
*   **⚠️ High-Risk Refactoring Spots**: Ranks files using our risk density formula: `fan-in × churn(90d) × lack-of-tests` to find highly volatile, highly coupled, untested code.
*   **🧩 Coupling Hotspots**: Pinpoints refactoring bottlenecks exhibiting high fan-in *and* high fan-out (violating Single Responsibility).
*   **🔁 Circular Dependency Loops**: Traces recursive value-level cycles (A ➔ B ➔ C ➔ A) that prevent dead-code elimination, while ignoring false-positive `import type` lines.
*   **🚧 Boundary Violations**: Highlights structural leakages, such as code in a generic `shared/` folder importing files from inside domain-specific `features/`.
*   **🚌 Bus Factor Silos**: Highlights critical modules where over 80% of historical commits are tied to a single active developer.
*   **📈 Churn Instability Speed**: Identifies files undergoing accelerating code churn (more edits in the last 30 days than the entire preceding 60 days).
*   **📦 Barrel Bloat**: Highlights index/barrel files exposing too many exports.

---

## 🛠️ Testing & Quality

To execute the unit test suites:
```bash
npm run test
```

To run lint checks and verify TypeScript type safety:
```bash
npm run lint
```
