import * as vscode from 'vscode';
import * as path from 'path';
import { DISPLAY_NAME } from './types';
import { state } from './state';
import { log, initLogFile } from './logger';
import { findBinary } from './binary';
import {
   startServer,
   stopServer,
   pollStats,
   indexRepository,
   addRepository,
   removeRepository,
   forceReindexRepository,
} from './server';
import { CBMWebviewProvider } from './webview';
import { setupAgentConfigs, installBinary, initCacheDir } from './config';
import { getPrimaryWorkspacePath } from './workspace';

function syncWorkspaceContext(): string {
   const workspace = getPrimaryWorkspacePath();
   if (workspace) {
      initLogFile(workspace);
      initCacheDir(workspace);
   }
   return workspace;
}

export function activate(context: vscode.ExtensionContext): void {
   state.logChannel = vscode.window.createOutputChannel(DISPLAY_NAME);
   context.subscriptions.push(state.logChannel);

   state.resolvedBinary = findBinary(context);

   const workspace = syncWorkspaceContext();

   if (state.resolvedBinary) {
      log(`[INFO] Binary found: ${state.resolvedBinary}`);
   } else {
      log('[WARN] codebase-memory-mcp binary not found');
   }

   state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
   state.statusBarItem.text = `$(circle-outline) ${DISPLAY_NAME}: stopped`;
   state.statusBarItem.command = 'contextEngine.startServer';
   state.statusBarItem.show();
   context.subscriptions.push(state.statusBarItem);

   const webviewProvider = new CBMWebviewProvider(context.extensionUri);
   state.webviewProvider = webviewProvider;
   context.subscriptions.push(vscode.window.registerWebviewViewProvider(CBMWebviewProvider.viewType, webviewProvider));

   context.subscriptions.push(
      vscode.commands.registerCommand('contextEngine.startServer', () => startServer(context)),
      vscode.commands.registerCommand('contextEngine.stopServer', () => stopServer()),
      vscode.commands.registerCommand('contextEngine.indexRepo', () => indexRepository(getPrimaryWorkspacePath())),
      vscode.commands.registerCommand('contextEngine.forceReindex', () =>
         forceReindexRepository(getPrimaryWorkspacePath()),
      ),
      vscode.commands.registerCommand('contextEngine.setupAgents', () => {
         const workspace = syncWorkspaceContext();
         if (!workspace) {
            vscode.window.showWarningMessage(`${DISPLAY_NAME}: No workspace folder open.`);
            return;
         }
         setupAgentConfigs(workspace);
      }),
      vscode.commands.registerCommand('contextEngine.installBinary', () => installBinary()),
      vscode.commands.registerCommand('contextEngine.addRepo', () => addRepository()),
      vscode.commands.registerCommand('contextEngine.removeRepo', (projectName?: string) =>
         removeRepository(projectName),
      ),
      vscode.commands.registerCommand('contextEngine.viewLogs', () => {
         if (state.logFilePath) {
            const uri = vscode.Uri.file(state.logFilePath);
            vscode.window.showTextDocument(uri, { preview: true });
         } else {
            state.logChannel.show();
         }
      }),
      vscode.commands.registerCommand('contextEngine.refresh', () => {
         state.resolvedBinary = findBinary(context);
         const workspace = syncWorkspaceContext();
         if (workspace) {
            void pollStats(workspace);
         } else {
            state.webviewProvider.update();
         }
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
         const workspace = syncWorkspaceContext();
         if (workspace && state.isRunning) {
            void pollStats(workspace);
         } else {
            state.webviewProvider.update();
         }
      }),
   );

   if (state.resolvedBinary && workspace) {
      void pollStats(workspace);
      if (!state.pollTimer) {
         state.pollTimer = setInterval(() => {
            const workspace = getPrimaryWorkspacePath();
            if (workspace) {
               void pollStats(workspace);
            } else {
               state.webviewProvider.update();
            }
         }, 8000);
      }

      // Auto re-index on file changes (debounced 5s)
      state.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*', false, false, false);
      const DEBOUNCE_MS = 5000;
      const scheduleReindex = (uri?: vscode.Uri) => {
         // Ignore changes inside .codebase/ — those are DB files written during indexing
         // and would otherwise cause an infinite reindex loop.
         if (uri && uri.fsPath.replace(/\\/g, '/').includes('/.codebase/')) {
            return;
         }
         if (!state.isRunning || state.stats.isIndexing) {
            return;
         }
         if (state.watchDebounce) {
            clearTimeout(state.watchDebounce);
         }
         state.watchDebounce = setTimeout(() => {
            state.watchDebounce = null;
            const workspace = getPrimaryWorkspacePath();
            if (state.isRunning && !state.stats.isIndexing && workspace) {
               log('[INFO] File change detected — triggering incremental index');
               void indexRepository(workspace, true);
            }
         }, DEBOUNCE_MS);
      };
      state.fileWatcher.onDidChange((uri) => scheduleReindex(uri));
      state.fileWatcher.onDidCreate((uri) => scheduleReindex(uri));
      state.fileWatcher.onDidDelete((uri) => scheduleReindex(uri));
      context.subscriptions.push(state.fileWatcher);
   }
}

export function deactivate(): void {
   if (state.watchDebounce) {
      clearTimeout(state.watchDebounce);
      state.watchDebounce = null;
   }
   if (state.fileWatcher) {
      state.fileWatcher.dispose();
      state.fileWatcher = null;
   }
   if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
   }
   stopServer();
}
