import * as fs from 'fs';
import * as path from 'path';
import { state } from './state';

export function log(line: string): void {
   const stamped = `${new Date().toISOString()} ${line}`;
   state.logChannel.appendLine(stamped);
   if (state.logFilePath) {
      try {
         fs.appendFileSync(state.logFilePath, stamped + '\n');
      } catch {
         // ignore file write errors
      }
   }
}

export function initLogFile(workspace: string): void {
   const dir = path.join(workspace, '.codebase');
   fs.mkdirSync(dir, { recursive: true });
   state.logFilePath = path.join(dir, 'codebase-memory.log');
   try {
      const stat = fs.statSync(state.logFilePath);
      if (stat.size > 1024 * 1024) {
         fs.renameSync(state.logFilePath, state.logFilePath + '.old');
      }
   } catch {
      // file doesn't exist yet
   }
}
