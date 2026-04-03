import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { DISPLAY_NAME, ProjectInfo } from './types';
import { state } from './state';
import { log } from './logger';
import { runCli, parseMcpEnvelope, getCacheEnv } from './cli';
import { normalizePath } from './binary';
import { writeCodebaseDir } from './config';

export function startServer(context: vscode.ExtensionContext): void {
   if (state.mcpProcess) {
      vscode.window.showWarningMessage(`${DISPLAY_NAME}: Server already running.`);
      return;
   }
   if (!state.resolvedBinary) {
      vscode.window.showErrorMessage(`${DISPLAY_NAME}: Binary not found. Install it first.`);
      return;
   }
   log(`[INFO] Starting MCP server: ${state.resolvedBinary}`);
   state.mcpProcess = spawn(state.resolvedBinary, [], { stdio: ['pipe', 'pipe', 'pipe'], env: getCacheEnv() });
   state.stats.startedAt = new Date();
   state.isRunning = true;
   state.mcpProcess.stderr?.on('data', (data: Buffer) => log(`[SERVER] ${data.toString().trimEnd()}`));
   state.mcpProcess.on('error', (err: Error) => {
      log(`[ERROR] ${err.message}`);
      stopServer();
   });
   state.mcpProcess.on('exit', (code: number | null) => {
      log(`[INFO] MCP server exited with code ${code}`);
      stopServer();
   });
   vscode.commands.executeCommand('setContext', 'contextEngine.running', true);
   state.statusBarItem.text = `$(circuit-board) ${DISPLAY_NAME}: running`;
   state.webviewProvider.update();

   const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
   if (!state.pollTimer) {
      state.pollTimer = setInterval(() => pollStats(workspace), 8000);
   }
   pollStats(workspace).then(() => {
      if (state.stats.nodes === 0 && workspace && state.isRunning) {
         log('[INFO] No indexed data found — starting auto-index');
         indexRepository(workspace);
      }
   });
}

export function stopServer(): void {
   if (state.mcpProcess) {
      state.mcpProcess.kill();
      state.mcpProcess = null;
   }
   state.stats.startedAt = null;
   state.isRunning = false;
   vscode.commands.executeCommand('setContext', 'contextEngine.running', false);
   state.statusBarItem.text = `$(circle-outline) ${DISPLAY_NAME}: stopped`;
   state.webviewProvider.update();
}

export async function pollStats(workspace: string): Promise<void> {
   if (!state.resolvedBinary) {
      return;
   }
   try {
      const raw = await runCli(state.resolvedBinary, ['cli', 'list_projects', '{}']);
      const result = parseMcpEnvelope(raw) as {
         projects?: Array<{ name: string; root_path: string; nodes: number; edges: number; size_bytes: number }>;
      };
      const projects = (result.projects || []).map(
         (p): ProjectInfo => ({
            name: p.name,
            path: p.root_path,
            nodes: p.nodes,
            edges: p.edges,
            files: p.size_bytes,
         }),
      );
      let totalNodes = 0;
      let totalEdges = 0;
      for (const p of projects) {
         totalNodes += p.nodes;
         totalEdges += p.edges;
      }
      state.stats.projects = projects;
      state.stats.nodes = totalNodes;
      state.stats.edges = totalEdges;
      if (totalNodes > 0) {
         state.stats.lastIndexed = new Date();
      }
      state.statusBarItem.text =
         totalNodes > 0
            ? `$(circuit-board) ${totalNodes.toLocaleString()} nodes`
            : `$(circuit-board) ${DISPLAY_NAME}: running`;
      state.webviewProvider.update();
      writeCodebaseDir(workspace);
   } catch (err: unknown) {
      log(`[POLL ERROR] ${err instanceof Error ? err.message : String(err)}`);
   }
}

export async function indexRepository(workspace: string): Promise<void> {
   if (!state.resolvedBinary) {
      vscode.window.showErrorMessage(`${DISPLAY_NAME}: Binary not found.`);
      return;
   }
   if (!workspace) {
      vscode.window.showErrorMessage(`${DISPLAY_NAME}: No workspace folder open.`);
      return;
   }
   if (state.stats.isIndexing) {
      log('[INFO] Indexing already in progress, skipping duplicate request');
      return;
   }

   state.stats.isIndexing = true;
   state.statusBarItem.text = `$(sync~spin) ${DISPLAY_NAME}: indexing...`;
   state.webviewProvider.update();
   log(`[INFO] Indexing: ${workspace}`);

   try {
      const out = await runCli(
         state.resolvedBinary,
         ['cli', 'index_repository', JSON.stringify({ repo_path: normalizePath(workspace) })],
         600000,
      ); // 10 min timeout for large repos
      log(`[INDEX] ${out.trim()}`);
      vscode.window.showInformationMessage(`${DISPLAY_NAME}: Indexing complete.`);
      state.stats.lastIndexed = new Date();
      await pollStats(workspace);
      writeCodebaseDir(workspace);
   } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`${DISPLAY_NAME}: Indexing failed — ${msg}`);
      log(`[INDEX ERROR] ${msg}`);
   } finally {
      state.stats.isIndexing = false;
      state.statusBarItem.text = state.isRunning
         ? `$(circuit-board) ${DISPLAY_NAME}: running`
         : `$(circuit-board) ${state.stats.nodes.toLocaleString()} nodes`;
      state.webviewProvider.update();
   }
}
