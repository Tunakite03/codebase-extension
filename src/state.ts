import * as vscode from 'vscode';
import { ChildProcess } from 'child_process';
import { IndexStats } from './types';

export interface ExtensionState {
   mcpProcess: ChildProcess | null;
   stats: IndexStats;
   isRunning: boolean;
   statusBarItem: vscode.StatusBarItem;
   webviewProvider: { update(): void };
   logChannel: vscode.OutputChannel;
   pollTimer: ReturnType<typeof setInterval> | null;
   resolvedBinary: string | null;
   logFilePath: string | null;
   cacheDir: string | null;
}

export const state: ExtensionState = {
   mcpProcess: null,
   stats: {
      nodes: 0,
      edges: 0,
      files: 0,
      projects: [],
      startedAt: null,
      lastIndexed: null,
      isIndexing: false,
   },
   isRunning: false,
   statusBarItem: undefined!,
   webviewProvider: undefined!,
   logChannel: undefined!,
   pollTimer: null,
   resolvedBinary: null,
   logFilePath: null,
   cacheDir: null,
};
