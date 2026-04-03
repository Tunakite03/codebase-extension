import * as path from 'path';
import { execFile } from 'child_process';
import { state } from './state';
import { log } from './logger';

/**
 * Returns spawn/execFile env with cache redirection.
 * - CBM_CACHE_DIR: for patched binary (reads env var directly)
 * - HOME: for unpatched binary (uses $HOME/.cache/codebase-memory-mcp)
 *   We set HOME to the parent of .cache so the default path resolves locally.
 */
export function getCacheEnv(): NodeJS.ProcessEnv {
   if (state.cacheDir) {
      // state.cacheDir = "<workspace>/.codebase/data"
      // Unpatched binary: HOME/.cache/codebase-memory-mcp → set HOME so that path resolves
      // to "<workspace>/.codebase/data/.cache/codebase-memory-mcp" (inside .codebase)
      const fakeHome = state.cacheDir.replace(/\\/g, '/');
      return {
         ...process.env,
         CBM_CACHE_DIR: path.join(state.cacheDir, '.cache', 'codebase-memory-mcp').replace(/\\/g, '/'),
         HOME: fakeHome,
      };
   }
   return process.env;
}

export function runCli(binary: string, args: string[], timeout = 15000): Promise<string> {
   return new Promise((resolve, reject) => {
      execFile(binary, args, { encoding: 'utf8', timeout, env: getCacheEnv() }, (err, stdout, stderr) => {
         if (err) {
            log(`[CLI ERROR] ${err.message}`);
            if (stderr) {
               log(`[CLI STDERR] ${stderr}`);
            }
            reject(err);
            return;
         }
         resolve(stdout);
      });
   });
}

/** Parse the MCP tool result envelope that CLI outputs.
 * All tools return: {"content":[{"type":"text","text":"<inner json>"}]}
 */
export function parseMcpEnvelope(raw: string): unknown {
   const envelope = JSON.parse(raw);
   const text = envelope?.content?.[0]?.text;
   if (typeof text === 'string') {
      try {
         return JSON.parse(text);
      } catch {
         return text;
      }
   }
   return envelope;
}

export async function cliCommand(tool: string, params: Record<string, unknown>): Promise<unknown> {
   if (!state.resolvedBinary) {
      throw new Error('Binary not found');
   }
   const raw = await runCli(state.resolvedBinary, ['cli', tool, JSON.stringify(params)]);
   return parseMcpEnvelope(raw);
}
