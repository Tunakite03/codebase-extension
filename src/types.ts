export const BINARY_NAME =
  process.platform === "win32"
    ? "codebase-memory-mcp.exe"
    : "codebase-memory-mcp";
export const LEGACY_BINARY_NAME =
  process.platform === "win32" ? "cbm.exe" : "cbm";
export const DISPLAY_NAME = "Codebase Memory";
export const GITHUB_REPO = "DeusData/codebase-memory-mcp";

export interface ProjectInfo {
  name: string;
  path: string;
  nodes: number;
  edges: number;
  files: number;
  displayName?: string;
  aliases?: string[];
}

export interface IndexStats {
  nodes: number;
  edges: number;
  files: number;
  projects: ProjectInfo[];
  startedAt: Date | null;
  lastIndexed: Date | null;
  isIndexing: boolean;
}
