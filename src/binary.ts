import type * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { BINARY_NAME, LEGACY_BINARY_NAME } from "./types";

function existsExecutable(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function findBinary(context: vscode.ExtensionContext): string | null {
  const platformDir = path.join(
    context.extensionPath,
    "bin",
    `${process.platform}-${process.arch}`,
  );
  const bundledCandidates = [
    path.join(platformDir, BINARY_NAME),
    path.join(platformDir, LEGACY_BINARY_NAME),
  ];
  for (const bundled of bundledCandidates) {
    if (existsExecutable(bundled)) {
      return bundled;
    }
  }

  const home = os.homedir();
  const candidates: string[] = [];

  if (process.platform === "win32") {
    candidates.push(
      path.join(home, ".local", "bin", BINARY_NAME),
      path.join(home, "AppData", "Local", "codebase-memory-mcp", BINARY_NAME),
      path.join(home, "bin", BINARY_NAME),
      path.join(home, ".local", "bin", LEGACY_BINARY_NAME),
      path.join(
        home,
        "AppData",
        "Local",
        "codebase-memory-mcp",
        LEGACY_BINARY_NAME,
      ),
      path.join(home, "bin", LEGACY_BINARY_NAME),
      path.join(home, ".cargo", "bin", BINARY_NAME),
      path.join(home, ".cargo", "bin", LEGACY_BINARY_NAME),
    );
  } else if (process.platform === "darwin") {
    candidates.push(
      path.join(home, ".local", "bin", BINARY_NAME),
      "/usr/local/bin/" + BINARY_NAME,
      "/opt/homebrew/bin/" + BINARY_NAME,
      path.join(home, "bin", BINARY_NAME),
      path.join(home, ".local", "bin", LEGACY_BINARY_NAME),
      "/usr/local/bin/" + LEGACY_BINARY_NAME,
      "/opt/homebrew/bin/" + LEGACY_BINARY_NAME,
      path.join(home, "bin", LEGACY_BINARY_NAME),
      path.join(home, ".cargo", "bin", BINARY_NAME),
      path.join(home, ".cargo", "bin", LEGACY_BINARY_NAME),
    );
  } else {
    candidates.push(
      path.join(home, ".local", "bin", BINARY_NAME),
      "/usr/local/bin/" + BINARY_NAME,
      path.join(home, "bin", BINARY_NAME),
      path.join(home, ".local", "bin", LEGACY_BINARY_NAME),
      "/usr/local/bin/" + LEGACY_BINARY_NAME,
      path.join(home, "bin", LEGACY_BINARY_NAME),
      path.join(home, ".cargo", "bin", BINARY_NAME),
      path.join(home, ".cargo", "bin", LEGACY_BINARY_NAME),
    );
  }

  for (const c of candidates) {
    if (existsExecutable(c)) {
      return c;
    }
  }

  const pathDirs = (process.env.PATH || "").split(path.delimiter);
  for (const dir of pathDirs) {
    for (const name of [BINARY_NAME, LEGACY_BINARY_NAME]) {
      const candidate = path.join(dir, name);
      if (existsExecutable(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

/** Normalize a Windows path for the CLI binary.
 * The binary's store validator rejects lowercase-drive backslash paths as "corrupt".
 * Convert to forward slashes with uppercase drive letter: e:\Foo\Bar → E:/Foo/Bar
 */
export function normalizePath(p: string): string {
  let normalized = p.replace(/\\/g, "/");
  if (/^[a-zA-Z]:/.test(normalized)) {
    normalized = normalized[0].toUpperCase() + normalized.slice(1);
  }
  return normalized;
}

export function deriveProjectNameFromPath(pathLike: string): string {
  return normalizePath(pathLike)
    .split(/[/:\\]+/)
    .filter((part) => part.length > 0)
    .join("-");
}
