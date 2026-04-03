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
exports.startServer = startServer;
exports.stopServer = stopServer;
exports.pollStats = pollStats;
exports.indexRepository = indexRepository;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const types_1 = require("./types");
const state_1 = require("./state");
const logger_1 = require("./logger");
const cli_1 = require("./cli");
const binary_1 = require("./binary");
const config_1 = require("./config");
function startServer(context) {
    if (state_1.state.mcpProcess) {
        vscode.window.showWarningMessage(`${types_1.DISPLAY_NAME}: Server already running.`);
        return;
    }
    if (!state_1.state.resolvedBinary) {
        vscode.window.showErrorMessage(`${types_1.DISPLAY_NAME}: Binary not found. Install it first.`);
        return;
    }
    (0, logger_1.log)(`[INFO] Starting MCP server: ${state_1.state.resolvedBinary}`);
    state_1.state.mcpProcess = (0, child_process_1.spawn)(state_1.state.resolvedBinary, [], { stdio: ['pipe', 'pipe', 'pipe'], env: (0, cli_1.getCacheEnv)() });
    state_1.state.stats.startedAt = new Date();
    state_1.state.isRunning = true;
    state_1.state.mcpProcess.stderr?.on('data', (data) => (0, logger_1.log)(`[SERVER] ${data.toString().trimEnd()}`));
    state_1.state.mcpProcess.on('error', (err) => {
        (0, logger_1.log)(`[ERROR] ${err.message}`);
        stopServer();
    });
    state_1.state.mcpProcess.on('exit', (code) => {
        (0, logger_1.log)(`[INFO] MCP server exited with code ${code}`);
        stopServer();
    });
    vscode.commands.executeCommand('setContext', 'contextEngine.running', true);
    state_1.state.statusBarItem.text = `$(circuit-board) ${types_1.DISPLAY_NAME}: running`;
    state_1.state.webviewProvider.update();
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    if (!state_1.state.pollTimer) {
        state_1.state.pollTimer = setInterval(() => pollStats(workspace), 8000);
    }
    pollStats(workspace);
}
function stopServer() {
    if (state_1.state.mcpProcess) {
        state_1.state.mcpProcess.kill();
        state_1.state.mcpProcess = null;
    }
    state_1.state.stats.startedAt = null;
    state_1.state.isRunning = false;
    vscode.commands.executeCommand('setContext', 'contextEngine.running', false);
    state_1.state.statusBarItem.text = `$(circle-outline) ${types_1.DISPLAY_NAME}: stopped`;
    state_1.state.webviewProvider.update();
}
async function pollStats(workspace) {
    if (!state_1.state.resolvedBinary) {
        return;
    }
    try {
        const raw = await (0, cli_1.runCli)(state_1.state.resolvedBinary, ['cli', 'list_projects', '{}']);
        const result = (0, cli_1.parseMcpEnvelope)(raw);
        const projects = (result.projects || []).map((p) => ({
            name: p.name,
            path: p.root_path,
            nodes: p.nodes,
            edges: p.edges,
            files: p.size_bytes,
        }));
        let totalNodes = 0;
        let totalEdges = 0;
        for (const p of projects) {
            totalNodes += p.nodes;
            totalEdges += p.edges;
        }
        state_1.state.stats.projects = projects;
        state_1.state.stats.nodes = totalNodes;
        state_1.state.stats.edges = totalEdges;
        state_1.state.stats.lastIndexed = new Date();
        state_1.state.statusBarItem.text = `$(circuit-board) ${totalNodes.toLocaleString()} nodes`;
        state_1.state.webviewProvider.update();
        (0, config_1.writeCodebaseDir)(workspace);
    }
    catch {
        // silently ignore poll errors
    }
}
async function indexRepository(workspace) {
    if (!state_1.state.resolvedBinary) {
        vscode.window.showErrorMessage(`${types_1.DISPLAY_NAME}: Binary not found.`);
        return;
    }
    if (!workspace) {
        vscode.window.showErrorMessage(`${types_1.DISPLAY_NAME}: No workspace folder open.`);
        return;
    }
    state_1.state.stats.isIndexing = true;
    state_1.state.statusBarItem.text = `$(sync~spin) ${types_1.DISPLAY_NAME}: indexing...`;
    state_1.state.webviewProvider.update();
    (0, logger_1.log)(`[INFO] Indexing: ${workspace}`);
    try {
        const out = await (0, cli_1.runCli)(state_1.state.resolvedBinary, ['cli', 'index_repository', JSON.stringify({ repo_path: (0, binary_1.normalizePath)(workspace) })], 600000); // 10 min timeout for large repos
        (0, logger_1.log)(`[INDEX] ${out.trim()}`);
        vscode.window.showInformationMessage(`${types_1.DISPLAY_NAME}: Indexing complete.`);
        state_1.state.stats.lastIndexed = new Date();
        await pollStats(workspace);
        (0, config_1.writeCodebaseDir)(workspace);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`${types_1.DISPLAY_NAME}: Indexing failed — ${msg}`);
        (0, logger_1.log)(`[INDEX ERROR] ${msg}`);
    }
    finally {
        state_1.state.stats.isIndexing = false;
        state_1.state.statusBarItem.text = state_1.state.isRunning
            ? `$(circuit-board) ${types_1.DISPLAY_NAME}: running`
            : `$(circuit-board) ${state_1.state.stats.nodes.toLocaleString()} nodes`;
        state_1.state.webviewProvider.update();
    }
}
//# sourceMappingURL=server.js.map