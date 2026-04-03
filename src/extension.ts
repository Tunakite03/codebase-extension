import * as vscode from 'vscode';
import * as path from 'path';
import { DISPLAY_NAME } from './types';
import { state } from './state';
import { log, initLogFile } from './logger';
import { findBinary, normalizePath } from './binary';
import { runCli } from './cli';
import { startServer, stopServer, pollStats, indexRepository } from './server';
import { CBMWebviewProvider } from './webview';
import { setupAgentConfigs, installBinary, initCacheDir } from './config';

export function activate(context: vscode.ExtensionContext): void {
   state.logChannel = vscode.window.createOutputChannel(DISPLAY_NAME);
   context.subscriptions.push(state.logChannel);

   state.resolvedBinary = findBinary(context);

   const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
   if (workspace) {
      initLogFile(workspace);
      initCacheDir(workspace);
   }

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
      vscode.commands.registerCommand('contextEngine.indexRepo', () => indexRepository(workspace)),
      vscode.commands.registerCommand('contextEngine.forceReindex', () => {
         if (!workspace || !state.resolvedBinary) {
            return;
         }
         const projectName = path.basename(normalizePath(workspace));
         runCli(state.resolvedBinary, ['cli', 'delete_project', JSON.stringify({ project: projectName })], 10000)
            .catch(() => {
               /* may not exist */
            })
            .then(() => indexRepository(workspace));
      }),
      vscode.commands.registerCommand('contextEngine.setupAgents', () => {
         if (!workspace) {
            vscode.window.showWarningMessage(`${DISPLAY_NAME}: No workspace folder open.`);
            return;
         }
         setupAgentConfigs(workspace);
      }),
      vscode.commands.registerCommand('contextEngine.installBinary', () => installBinary()),
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
         if (workspace) {
            pollStats(workspace);
         } else {
            state.webviewProvider.update();
         }
      }),
   );

   if (state.resolvedBinary && workspace) {
      pollStats(workspace);
      if (!state.pollTimer) {
         state.pollTimer = setInterval(() => pollStats(workspace), 8000);
      }
   }
}

export function deactivate(): void {
   if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
   }
   stopServer();
}
