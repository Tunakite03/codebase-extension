export const BINARY_NAME = process.platform === 'win32' ? 'cbm.exe' : 'cbm';
export const DISPLAY_NAME = 'Codebase Memory';
export const GITHUB_REPO = 'Tunakite03/codebase-memory-mcp';

export interface ProjectInfo {
   name: string;
   path: string;
   nodes: number;
   edges: number;
   files: number;
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
