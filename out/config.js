"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocalCacheDir = getLocalCacheDir;
exports.initCacheDir = initCacheDir;
exports.writeCodebaseDir = writeCodebaseDir;
exports.setupAgentConfigs = setupAgentConfigs;
exports.installBinary = installBinary;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const types_1 = require("./types");
const state_1 = require("./state");
const binary_1 = require("./binary");
/** Returns the local cache directory for DB storage: <workspace>/.codebase/data */
function getLocalCacheDir(workspace) {
    return path.join(workspace, '.codebase', 'data').replace(/\\/g, '/');
}
/** Initialize state.cacheDir to the workspace-local .codebase/data directory. */
function initCacheDir(workspace) {
    const dir = getLocalCacheDir(workspace);
    fs.mkdirSync(dir, { recursive: true });
    state_1.state.cacheDir = dir;
}
function writeCodebaseDir(workspace) {
    if (!workspace || !state_1.state.resolvedBinary) {
        return;
    }
    const dir = path.join(workspace, '.codebase');
    fs.mkdirSync(dir, { recursive: true });
    const normalizedWs = (0, binary_1.normalizePath)(workspace);
    const project = state_1.state.stats.projects.find((p) => (0, binary_1.normalizePath)(p.path) === normalizedWs);
    const status = {
        binary: state_1.state.resolvedBinary,
        binary_version: '0.5.7',
        project_name: project?.name || path.basename(workspace),
        root_path: normalizedWs,
        nodes: project?.nodes || state_1.state.stats.nodes,
        edges: project?.edges || state_1.state.stats.edges,
        size_bytes: project?.files || 0,
        last_indexed: state_1.state.stats.lastIndexed?.toISOString() || null,
        is_indexing: state_1.state.stats.isIndexing,
        cache_dir: path
            .join(state_1.state.cacheDir || getLocalCacheDir(workspace), '.cache', 'codebase-memory-mcp')
            .replace(/\\/g, '/'),
    };
    fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(status, null, 2) + '\n');
    const config = {
        mcp: {
            command: state_1.state.resolvedBinary,
            args: [],
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
function setupAgentConfigs(workspace) {
    if (!state_1.state.resolvedBinary) {
        vscode.window.showErrorMessage(`${types_1.DISPLAY_NAME}: Binary not found.`);
        return;
    }
    const binaryCmd = state_1.state.resolvedBinary;
    const vscodeMcp = {
        servers: {
            'codebase-memory': {
                type: 'stdio',
                command: binaryCmd,
                args: [],
            },
        },
    };
    const cursorMcp = {
        mcpServers: {
            'codebase-memory': {
                command: binaryCmd,
                args: [],
            },
        },
    };
    const instructions = `## Codebase Memory MCP

Before reading files or making code changes, prefer using MCP graph tools.

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

### Workflow
1. Call \`get_graph_schema\` to understand the project structure
2. Use \`search_graph\` to find relevant symbols
3. Use \`trace_call_path\` to understand call chains
4. Use \`get_code_snippet\` to read specific function implementations
`;
    const write = (dir, file, content) => {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, file), content);
    };
    write(path.join(workspace, '.vscode'), 'mcp.json', JSON.stringify(vscodeMcp, null, 2));
    write(path.join(workspace, '.github'), 'copilot-instructions.md', instructions);
    write(path.join(workspace, '.claude'), 'CLAUDE.md', instructions);
    write(path.join(workspace, '.cursor'), 'mcp.json', JSON.stringify(cursorMcp, null, 2));
    vscode.window.showInformationMessage(`${types_1.DISPLAY_NAME}: Agent configs written to .vscode/, .github/, .claude/, .cursor/`);
}
async function installBinary() {
    const repoUrl = `https://github.com/${types_1.GITHUB_REPO}`;
    const choice = await vscode.window.showInformationMessage(`${types_1.DISPLAY_NAME}: Install codebase-memory-mcp binary?`, 'Open Install Guide', 'Run Install Script');
    if (choice === 'Open Install Guide') {
        vscode.env.openExternal(vscode.Uri.parse(repoUrl + '#installation'));
    }
    else if (choice === 'Run Install Script') {
        const terminal = vscode.window.createTerminal(types_1.DISPLAY_NAME);
        if (process.platform === 'win32') {
            terminal.sendText(`powershell -c "irm https://raw.githubusercontent.com/${types_1.GITHUB_REPO}/main/install.ps1 | iex"`);
        }
        else {
            terminal.sendText(`curl -fsSL https://raw.githubusercontent.com/${types_1.GITHUB_REPO}/main/install.sh | bash`);
        }
        terminal.show();
    }
}
//# sourceMappingURL=config.js.map