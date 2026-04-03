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
exports.getCacheEnv = getCacheEnv;
exports.runCli = runCli;
exports.parseMcpEnvelope = parseMcpEnvelope;
exports.cliCommand = cliCommand;
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const state_1 = require("./state");
const logger_1 = require("./logger");
/**
 * Returns spawn/execFile env with cache redirection.
 * - CBM_CACHE_DIR: for patched binary (reads env var directly)
 * - HOME: for unpatched binary (uses $HOME/.cache/codebase-memory-mcp)
 *   We set HOME to the parent of .cache so the default path resolves locally.
 */
function getCacheEnv() {
    if (state_1.state.cacheDir) {
        // state.cacheDir = "<workspace>/.codebase/data"
        // Unpatched binary: HOME/.cache/codebase-memory-mcp → set HOME so that path resolves
        // to "<workspace>/.codebase/data/.cache/codebase-memory-mcp" (inside .codebase)
        const fakeHome = state_1.state.cacheDir.replace(/\\/g, '/');
        return {
            ...process.env,
            CBM_CACHE_DIR: path.join(state_1.state.cacheDir, '.cache', 'codebase-memory-mcp').replace(/\\/g, '/'),
            HOME: fakeHome,
        };
    }
    return process.env;
}
function runCli(binary, args, timeout = 15000) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.execFile)(binary, args, { encoding: 'utf8', timeout, env: getCacheEnv() }, (err, stdout, stderr) => {
            if (err) {
                (0, logger_1.log)(`[CLI ERROR] ${err.message}`);
                if (stderr) {
                    (0, logger_1.log)(`[CLI STDERR] ${stderr}`);
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
function parseMcpEnvelope(raw) {
    const envelope = JSON.parse(raw);
    const text = envelope?.content?.[0]?.text;
    if (typeof text === 'string') {
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    }
    return envelope;
}
async function cliCommand(tool, params) {
    if (!state_1.state.resolvedBinary) {
        throw new Error('Binary not found');
    }
    const raw = await runCli(state_1.state.resolvedBinary, ['cli', tool, JSON.stringify(params)]);
    return parseMcpEnvelope(raw);
}
//# sourceMappingURL=cli.js.map