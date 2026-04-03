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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const types_1 = require("./types");
const state_1 = require("./state");
const logger_1 = require("./logger");
const binary_1 = require("./binary");
const cli_1 = require("./cli");
const server_1 = require("./server");
const webview_1 = require("./webview");
const config_1 = require("./config");
function activate(context) {
    state_1.state.logChannel = vscode.window.createOutputChannel(types_1.DISPLAY_NAME);
    context.subscriptions.push(state_1.state.logChannel);
    state_1.state.resolvedBinary = (0, binary_1.findBinary)(context);
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    if (workspace) {
        (0, logger_1.initLogFile)(workspace);
        (0, config_1.initCacheDir)(workspace);
    }
    if (state_1.state.resolvedBinary) {
        (0, logger_1.log)(`[INFO] Binary found: ${state_1.state.resolvedBinary}`);
    }
    else {
        (0, logger_1.log)('[WARN] codebase-memory-mcp binary not found');
    }
    state_1.state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
    state_1.state.statusBarItem.text = `$(circle-outline) ${types_1.DISPLAY_NAME}: stopped`;
    state_1.state.statusBarItem.command = 'contextEngine.startServer';
    state_1.state.statusBarItem.show();
    context.subscriptions.push(state_1.state.statusBarItem);
    const webviewProvider = new webview_1.CBMWebviewProvider(context.extensionUri);
    state_1.state.webviewProvider = webviewProvider;
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(webview_1.CBMWebviewProvider.viewType, webviewProvider));
    context.subscriptions.push(vscode.commands.registerCommand('contextEngine.startServer', () => (0, server_1.startServer)(context)), vscode.commands.registerCommand('contextEngine.stopServer', () => (0, server_1.stopServer)()), vscode.commands.registerCommand('contextEngine.indexRepo', () => (0, server_1.indexRepository)(workspace)), vscode.commands.registerCommand('contextEngine.forceReindex', () => {
        if (!workspace || !state_1.state.resolvedBinary) {
            return;
        }
        const projectName = path.basename((0, binary_1.normalizePath)(workspace));
        (0, cli_1.runCli)(state_1.state.resolvedBinary, ['cli', 'delete_project', JSON.stringify({ project: projectName })], 10000)
            .catch(() => {
            /* may not exist */
        })
            .then(() => (0, server_1.indexRepository)(workspace));
    }), vscode.commands.registerCommand('contextEngine.setupAgents', () => {
        if (!workspace) {
            vscode.window.showWarningMessage(`${types_1.DISPLAY_NAME}: No workspace folder open.`);
            return;
        }
        (0, config_1.setupAgentConfigs)(workspace);
    }), vscode.commands.registerCommand('contextEngine.installBinary', () => (0, config_1.installBinary)()), vscode.commands.registerCommand('contextEngine.viewLogs', () => {
        if (state_1.state.logFilePath) {
            const uri = vscode.Uri.file(state_1.state.logFilePath);
            vscode.window.showTextDocument(uri, { preview: true });
        }
        else {
            state_1.state.logChannel.show();
        }
    }), vscode.commands.registerCommand('contextEngine.refresh', () => {
        state_1.state.resolvedBinary = (0, binary_1.findBinary)(context);
        if (workspace) {
            (0, server_1.pollStats)(workspace);
        }
        else {
            state_1.state.webviewProvider.update();
        }
    }));
    if (state_1.state.resolvedBinary && workspace) {
        (0, server_1.pollStats)(workspace);
        if (!state_1.state.pollTimer) {
            state_1.state.pollTimer = setInterval(() => (0, server_1.pollStats)(workspace), 8000);
        }
    }
}
function deactivate() {
    if (state_1.state.pollTimer) {
        clearInterval(state_1.state.pollTimer);
        state_1.state.pollTimer = null;
    }
    (0, server_1.stopServer)();
}
//# sourceMappingURL=extension.js.map