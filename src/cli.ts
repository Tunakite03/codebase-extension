import { execFile } from "child_process";
import { state } from "./state";
import { log } from "./logger";

/** Returns the process environment unchanged so the binary uses its default cache directory. */
export function getCacheEnv(): NodeJS.ProcessEnv {
  return process.env;
}

export function runCli(
  binary: string,
  args: string[],
  timeout = 15000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      binary,
      args,
      { encoding: "utf8", timeout, env: getCacheEnv() },
      (err, stdout, stderr) => {
        if (err) {
          log(`[CLI ERROR] ${err.message}`);
          if (stderr) {
            log(`[CLI STDERR] ${stderr}`);
          }
          reject(err);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

/** Parse the MCP tool result envelope that CLI outputs.
 * All tools return: {"content":[{"type":"text","text":"<inner json>"}]}
 */
export function parseMcpEnvelope(raw: string): unknown {
  const envelope = JSON.parse(raw);
  const text = envelope?.content?.[0]?.text;
  if (typeof text === "string") {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return envelope;
}

export async function cliCommand(
  tool: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  if (!state.resolvedBinary) {
    throw new Error("Binary not found");
  }
  const raw = await runCli(state.resolvedBinary, [
    "cli",
    tool,
    JSON.stringify(params),
  ]);
  return parseMcpEnvelope(raw);
}
