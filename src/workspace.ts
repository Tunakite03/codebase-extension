import * as vscode from 'vscode';

export function getPrimaryWorkspacePath(): string {
   return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
}
