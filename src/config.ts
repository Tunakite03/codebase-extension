import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DISPLAY_NAME, GITHUB_REPO } from './types';
import { state } from './state';
import { normalizePath } from './binary';

function getExtensionVersion(): string {
   try {
      const pkgPath = path.join(__dirname, '..', 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version || '0.0.0';
   } catch {
      return '0.0.0';
   }
}

/** Returns the local cache directory for DB storage: <workspace>/.codebase/data */
export function getLocalCacheDir(workspace: string): string {
   return path.join(workspace, '.codebase', 'data').replace(/\\/g, '/');
}

/** Initialize state.cacheDir to the workspace-local .codebase/data directory. */
export function initCacheDir(workspace: string): void {
   const dir = getLocalCacheDir(workspace);
   fs.mkdirSync(dir, { recursive: true });
   state.cacheDir = dir;
}

export function writeCodebaseDir(workspace: string): void {
   if (!workspace || !state.resolvedBinary) {
      return;
   }
   const dir = path.join(workspace, '.codebase');
   fs.mkdirSync(dir, { recursive: true });

   const normalizedWs = normalizePath(workspace);
   const project = state.stats.projects.find((p) => normalizePath(p.path) === normalizedWs);

   const status = {
      binary: state.resolvedBinary,
      binary_version: getExtensionVersion(),
      project_name: project?.name || path.basename(workspace),
      project_display_name: project?.displayName || path.basename(workspace),
      project_aliases: project?.aliases || [],
      root_path: normalizedWs,
      nodes: project?.nodes || state.stats.nodes,
      edges: project?.edges || state.stats.edges,
      size_bytes: project?.files || 0,
      last_indexed: state.stats.lastIndexed?.toISOString() || null,
      is_indexing: state.stats.isIndexing,
      cache_dir: path
         .join(state.cacheDir || getLocalCacheDir(workspace), '.cache', 'codebase-memory-mcp')
         .replace(/\\/g, '/'),
   };
   fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(status, null, 2) + '\n');

   const config = {
      mcp: {
         command: state.resolvedBinary,
         args: [] as string[],
         transport: 'stdio',
      },
      tools: [
         'index_repository',
         'list_projects',
         'delete_project',
         'index_status',
         'search_graph',
         'trace_call_path',
         'detect_changes',
         'query_graph',
         'get_graph_schema',
         'get_code_snippet',
         'get_architecture',
         'search_code',
         'manage_adr',
         'ingest_traces',
      ],
   };
   fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config, null, 2) + '\n');

   const gitignorePath = path.join(dir, '.gitignore');
   if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, 'status.json\ndata/\n');
   }
}

export async function setupAgentConfigs(workspace: string): Promise<void> {
   if (!state.resolvedBinary) {
      vscode.window.showErrorMessage(`${DISPLAY_NAME}: Binary not found.`);
      return;
   }

   const targets = [
      '.vscode/mcp.json',
      '.github/copilot-instructions.md',
      'AGENTS.md',
      '.claude/CLAUDE.md',
      '.cursor/mcp.json',
      '.zed/settings.json',
   ];
   const existing = targets.filter((t) => fs.existsSync(path.join(workspace, t)));
   if (existing.length > 0) {
      const choice = await vscode.window.showWarningMessage(
         `${DISPLAY_NAME}: Will merge into existing files: ${existing.join(', ')}`,
         { modal: true },
         'Continue',
      );
      if (choice !== 'Continue') {
         return;
      }
   }

   const binaryCmd = state.resolvedBinary;

   const vscodeMcp = {
      servers: {
         'codebase-memory': {
            type: 'stdio',
            command: binaryCmd,
            args: [] as string[],
         },
      },
   };

   const cursorMcp = {
      mcpServers: {
         'codebase-memory': {
            command: binaryCmd,
            args: [] as string[],
         },
      },
   };

   const instructions = `## Codebase Memory MCP

**MANDATORY: use Codebase Memory MCP graph tools FIRST — before reading files or making code changes.**

This rule applies to every request involving this codebase.

### Workflow

1. Call \`get_architecture(project)\` FIRST to understand the codebase structure.
2. Use \`search_graph\` to find relevant symbols, \`trace_call_path\` for call chains.
3. Use \`get_code_snippet\` to read specific function implementations.
4. Only use \`read_file\` when you need exact raw content to edit a specific line.

### Available Tools (14 MCP tools)

**Indexing:**
- \`index_repository(repo_path)\` — Index a repository into the knowledge graph
- \`list_projects\` — List all indexed projects with node/edge counts
- \`delete_project(project)\` — Remove a project and all its graph data
- \`index_status(project)\` — Check indexing status

**Querying:**
- \`search_graph(name_pattern, label, file_pattern)\` — Structured search by label, name, file
- \`trace_call_path(function_name, direction, depth)\` — BFS call chain traversal
- \`detect_changes(project)\` — Map git diff to affected symbols + risk
- \`query_graph(query)\` — Execute Cypher-like graph queries (read-only)
- \`get_graph_schema(project)\` — Node/edge counts, relationship patterns
- \`get_code_snippet(qualified_name)\` — Read source code for a function
- \`get_architecture(project)\` — Codebase overview: languages, packages, routes, hotspots
- \`search_code(pattern, project)\` — Grep-like text search within indexed files
- \`manage_adr(action)\` — CRUD for Architecture Decision Records
- \`ingest_traces(traces)\` — Ingest runtime traces to validate HTTP edges
`;

   const workflowInstruction = `---
applyTo: '**'
---

## MANDATORY: Always use Codebase Memory MCP to read the codebase

**This rule applies to EVERY request that involves this codebase.**

### Rules

1. **Call \`mcp_codebase-memo_get_architecture\` FIRST** — before writing code, editing files, or answering any question about the codebase.
2. Use the returned context to make targeted, accurate changes.
3. **Do NOT use** \`grep_search\`, \`file_search\`, \`semantic_search\`, or \`read_file\` for initial codebase exploration.
4. Re-query only if additional context is needed during implementation.

### Workflow

\`\`\`
mcp_codebase-memo_get_architecture({ "project": "<project>" })   // start here
mcp_codebase-memo_search_graph({ "name_pattern": "<symbol>" })   // find symbols
mcp_codebase-memo_get_code_snippet({ "qualified_name": "<fn>" }) // read code
\`\`\`

### Why

- Pre-built index covers the entire codebase with relevance ranking.
- Faster and more accurate than manual file search.
- Prevents reading stale files or following ghost references.
`;

   const agentsContent = `## Codebase Memory MCP

**MANDATORY: use Codebase Memory MCP graph tools FIRST — before reading files or making code changes.**

This rule applies to every request involving this codebase.

### Workflow

1. Call \`get_architecture(project)\` FIRST to understand the codebase structure.
2. Use \`search_graph\` to find relevant symbols, \`trace_call_path\` for call chains.
3. Use \`get_code_snippet\` to read specific function implementations.
4. Only use \`read_file\` when you need exact raw content to edit a specific line.

### Available Tools (14 MCP tools)

**Indexing:**
- \`index_repository(repo_path)\` — Index a repository into the knowledge graph
- \`list_projects\` — List all indexed projects with node/edge counts
- \`delete_project(project)\` — Remove a project and all its graph data
- \`index_status(project)\` — Check indexing status

**Querying:**
- \`search_graph(name_pattern, label, file_pattern)\` — Structured search by label, name, file
- \`trace_call_path(function_name, direction, depth)\` — BFS call chain traversal
- \`detect_changes(project)\` — Map git diff to affected symbols + risk
- \`query_graph(query)\` — Execute Cypher-like graph queries (read-only)
- \`get_graph_schema(project)\` — Node/edge counts, relationship patterns
- \`get_code_snippet(qualified_name)\` — Read source code for a function
- \`get_architecture(project)\` — Codebase overview: languages, packages, routes, hotspots
- \`search_code(pattern, project)\` — Grep-like text search within indexed files
- \`manage_adr(action)\` — CRUD for Architecture Decision Records
- \`ingest_traces(traces)\` — Ingest runtime traces to validate HTTP edges
`;

   const zedSettings = {
      context_servers: {
         'codebase-memory': {
            command: binaryCmd,
            args: [] as string[],
         },
      },
   };

   const CBM_SECTION_MARKER = '## Codebase Memory MCP';

   /** Recursively deep-merge source into target, preserving sibling keys at every level. */
   const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> => {
      const result = { ...target };
      for (const key of Object.keys(source)) {
         if (
            typeof source[key] === 'object' &&
            source[key] !== null &&
            !Array.isArray(source[key]) &&
            typeof result[key] === 'object' &&
            result[key] !== null &&
            !Array.isArray(result[key])
         ) {
            result[key] = deepMerge(result[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
         } else {
            result[key] = source[key];
         }
      }
      return result;
   };

   const mergeJson = (dir: string, file: string, source: Record<string, unknown>) => {
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, file);
      let merged = source;
      if (fs.existsSync(filePath)) {
         try {
            const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            merged = deepMerge(existing, source);
         } catch {
            merged = source;
         }
      }
      fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
   };

   /**
    * Upsert a markdown section: if the CBM section already exists, replace it;
    * otherwise append to the end of the file.
    */
   const upsertMarkdown = (dir: string, file: string, content: string) => {
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, file);
      if (fs.existsSync(filePath)) {
         const existing = fs.readFileSync(filePath, 'utf8');
         const markerIdx = existing.indexOf(CBM_SECTION_MARKER);
         if (markerIdx !== -1) {
            // Find the end of the CBM section: next heading at the same or higher level, or EOF
            const afterMarker = existing.substring(markerIdx + CBM_SECTION_MARKER.length);
            const nextHeadingMatch = afterMarker.match(/\n(?=## (?!#))/);
            const sectionEnd = nextHeadingMatch
               ? markerIdx + CBM_SECTION_MARKER.length + (nextHeadingMatch.index as number)
               : existing.length;
            const before = existing.substring(0, markerIdx);
            const after = existing.substring(sectionEnd);
            fs.writeFileSync(filePath, before + content.trimEnd() + '\n' + after);
         } else {
            const separator = existing.endsWith('\n') ? '\n' : '\n\n';
            fs.writeFileSync(filePath, existing + separator + content);
         }
      } else {
         fs.writeFileSync(filePath, content);
      }
   };

   mergeJson(path.join(workspace, '.vscode'), 'mcp.json', vscodeMcp);
   upsertMarkdown(path.join(workspace, '.github'), 'copilot-instructions.md', instructions);
   upsertMarkdown(
      path.join(workspace, '.github', 'instructions'),
      'codebase-workflow.instructions.md',
      workflowInstruction,
   );
   upsertMarkdown(workspace, 'AGENTS.md', agentsContent);
   upsertMarkdown(path.join(workspace, '.claude'), 'CLAUDE.md', instructions);
   mergeJson(path.join(workspace, '.cursor'), 'mcp.json', cursorMcp);
   mergeJson(path.join(workspace, '.zed'), 'settings.json', zedSettings);

   vscode.window.showInformationMessage(
      `${DISPLAY_NAME}: Agent configs written to .vscode/, .github/, .github/instructions/, .claude/, .cursor/, .zed/`,
   );
}

export async function installBinary(): Promise<void> {
   const repoUrl = `https://github.com/${GITHUB_REPO}`;
   const choice = await vscode.window.showInformationMessage(
      `${DISPLAY_NAME}: Install codebase-memory-mcp binary?`,
      'Open Install Guide',
      'Run Install Script',
   );

   if (choice === 'Open Install Guide') {
      vscode.env.openExternal(vscode.Uri.parse(repoUrl + '#installation'));
   } else if (choice === 'Run Install Script') {
      const terminal = vscode.window.createTerminal(DISPLAY_NAME);
      if (process.platform === 'win32') {
         terminal.sendText(
            `powershell -c "irm https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.ps1 | iex"`,
         );
      } else {
         terminal.sendText(`curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.sh | bash`);
      }
      terminal.show();
   }
}
