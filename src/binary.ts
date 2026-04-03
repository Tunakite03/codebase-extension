import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { BINARY_NAME } from './types';

export function findBinary(context: vscode.ExtensionContext): string | null {
   const bundled = path.join(context.extensionPath, 'bin', `${process.platform}-${process.arch}`, BINARY_NAME);
   if (fs.existsSync(bundled)) {
      return bundled;
   }

   const home = os.homedir();
   const candidates: string[] = [];

   if (process.platform === 'win32') {
      candidates.push(
         path.join(home, '.local', 'bin', BINARY_NAME),
         path.join(home, 'AppData', 'Local', 'codebase-memory-mcp', BINARY_NAME),
         path.join(home, 'bin', BINARY_NAME),
      );
   } else if (process.platform === 'darwin') {
      candidates.push(
         path.join(home, '.local', 'bin', BINARY_NAME),
         '/usr/local/bin/' + BINARY_NAME,
         '/opt/homebrew/bin/' + BINARY_NAME,
         path.join(home, 'bin', BINARY_NAME),
      );
   } else {
      candidates.push(
         path.join(home, '.local', 'bin', BINARY_NAME),
         '/usr/local/bin/' + BINARY_NAME,
         path.join(home, 'bin', BINARY_NAME),
      );
   }

   for (const c of candidates) {
      if (fs.existsSync(c)) {
         return c;
      }
   }

   const pathDirs = (process.env.PATH || '').split(path.delimiter);
   for (const dir of pathDirs) {
      const candidate = path.join(dir, BINARY_NAME);
      if (fs.existsSync(candidate)) {
         return candidate;
      }
   }

   return null;
}

/** Normalize a Windows path for the CLI binary.
 * The binary's store validator rejects lowercase-drive backslash paths as "corrupt".
 * Convert to forward slashes with uppercase drive letter: e:\Foo\Bar → E:/Foo/Bar
 */
export function normalizePath(p: string): string {
   let normalized = p.replace(/\\/g, '/');
   if (/^[a-zA-Z]:/.test(normalized)) {
      normalized = normalized[0].toUpperCase() + normalized.slice(1);
   }
   return normalized;
}
