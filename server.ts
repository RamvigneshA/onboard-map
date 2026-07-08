/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import AdmZip from 'adm-zip';
import os from 'os';

// Importing our analysis engine
import { ContextBuilder } from './src/core/context.js';
import { CodebaseEngine } from './src/core/engine.js';
import { TerminalReporter } from './src/reporters/terminal.reporter.js';
import { JsonReporter } from './src/reporters/json.reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Enable JSON and raw uploads for ZIPs
app.use(express.json({ limit: '100mb' }));
app.use(express.raw({ type: 'application/zip', limit: '100mb' }));

// 1. GET /api/analyze - Scan local workspace
app.get('/api/analyze', async (req, res) => {
  try {
    const runDeep = req.query.deep === 'true';
    const scanDir = req.query.dir ? path.resolve(String(req.query.dir)) : path.resolve(__dirname);

    if (!fs.existsSync(scanDir)) {
      return res.status(400).json({ error: `Directory "${scanDir}" does not exist` });
    }

    const startTime = Date.now();
    const { context, isRealGit } = ContextBuilder.build(scanDir);
    context.isDeep = runDeep;
    
    let projectName = path.basename(scanDir);
    if (context.packageJson && context.packageJson.name) {
      projectName = String(context.packageJson.name);
    }

    const engine = new CodebaseEngine();
    const results = await engine.run(context, { deep: runDeep });

    const durationMs = Date.now() - startTime;
    const meta = {
      projectName,
      filesScanned: context.importGraph.files.length,
      edgeCount: context.importGraph.edges.length,
      durationMs,
      isRealGit,
      projectMeta: context.projectMeta,
      isDeep: runDeep,
    };

    // Render ANSI CLI output so the frontend can display a terminal preview
    const terminalReporter = new TerminalReporter();
    const terminalOutput = terminalReporter.render(results, meta);

    res.json({
      meta,
      results,
      terminalOutput,
      // Pass the serialized graph and git log for the web dashboard visualization
      graph: {
        files: context.importGraph.files,
        edges: context.importGraph.edges,
      },
      gitLogSummary: context.gitLog.slice(0, 50), // keep payload light
    });
  } catch (error) {
    console.error('API Local Analyze Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 2. POST /api/upload-zip - Upload and analyze external repository
app.post('/api/upload-zip', async (req, res) => {
  const tempDir = path.join(os.tmpdir(), `onboard-map-${Date.now()}`);
  try {
    const zipBuffer = req.body;
    if (!zipBuffer || zipBuffer.length === 0) {
      return res.status(400).json({ error: 'Empty ZIP archive uploaded' });
    }

    // Extract ZIP to temp directory
    fs.mkdirSync(tempDir, { recursive: true });
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(tempDir, true);

    // Some ZIP files contain a single root directory wrapping the repository (like GitHub ZIP downloads)
    let scanPath = tempDir;
    const rootContents = fs.readdirSync(tempDir);
    if (rootContents.length === 1) {
      const maybeRootFolder = path.join(tempDir, rootContents[0]);
      if (fs.statSync(maybeRootFolder).isDirectory()) {
        scanPath = maybeRootFolder;
      }
    }

    const startTime = Date.now();
    const { context, isRealGit } = ContextBuilder.build(scanPath);
    context.isDeep = true;

    let projectName = req.headers['x-filename']
      ? String(req.headers['x-filename']).replace(/\.zip$/i, '')
      : path.basename(scanPath);
      
    if (context.packageJson && context.packageJson.name) {
      projectName = String(context.packageJson.name);
    }

    const engine = new CodebaseEngine();
    const results = await engine.run(context, { deep: true }); // Always run deep for uploads

    const durationMs = Date.now() - startTime;
    const meta = {
      projectName,
      filesScanned: context.importGraph.files.length,
      edgeCount: context.importGraph.edges.length,
      durationMs,
      isRealGit,
      projectMeta: context.projectMeta,
      isDeep: true,
    };

    const terminalReporter = new TerminalReporter();
    const terminalOutput = terminalReporter.render(results, meta);

    res.json({
      meta,
      results,
      terminalOutput,
      graph: {
        files: context.importGraph.files,
        edges: context.importGraph.edges,
      },
      gitLogSummary: context.gitLog.slice(0, 50),
    });
  } catch (error) {
    console.error('API Upload Analyze Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  } finally {
    // Clean up temp directory
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn('Failed to clean up temp dir:', tempDir, e);
    }
  }
});

// Configure Vite integration
const startServer = async () => {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Integrate Vite in Middleware Mode for full HMR development experience
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    
    // Serve Vite index.html and static files
    app.use(vite.middlewares);
    
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // In production, serve pre-built frontend files
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
};

startServer().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
