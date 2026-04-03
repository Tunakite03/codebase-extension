"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.state = void 0;
exports.state = {
    mcpProcess: null,
    stats: {
        nodes: 0,
        edges: 0,
        files: 0,
        projects: [],
        startedAt: null,
        lastIndexed: null,
        isIndexing: false,
    },
    isRunning: false,
    statusBarItem: undefined,
    webviewProvider: undefined,
    logChannel: undefined,
    pollTimer: null,
    resolvedBinary: null,
    logFilePath: null,
    cacheDir: null,
};
//# sourceMappingURL=state.js.map