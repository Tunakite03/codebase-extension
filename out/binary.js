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
exports.findBinary = findBinary;
exports.normalizePath = normalizePath;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const types_1 = require("./types");
function findBinary(context) {
    const bundled = path.join(context.extensionPath, 'bin', `${process.platform}-${process.arch}`, types_1.BINARY_NAME);
    if (fs.existsSync(bundled)) {
        return bundled;
    }
    const home = os.homedir();
    const candidates = [];
    if (process.platform === 'win32') {
        candidates.push(path.join(home, '.local', 'bin', types_1.BINARY_NAME), path.join(home, 'AppData', 'Local', 'codebase-memory-mcp', types_1.BINARY_NAME), path.join(home, 'bin', types_1.BINARY_NAME));
    }
    else if (process.platform === 'darwin') {
        candidates.push(path.join(home, '.local', 'bin', types_1.BINARY_NAME), '/usr/local/bin/' + types_1.BINARY_NAME, '/opt/homebrew/bin/' + types_1.BINARY_NAME, path.join(home, 'bin', types_1.BINARY_NAME));
    }
    else {
        candidates.push(path.join(home, '.local', 'bin', types_1.BINARY_NAME), '/usr/local/bin/' + types_1.BINARY_NAME, path.join(home, 'bin', types_1.BINARY_NAME));
    }
    for (const c of candidates) {
        if (fs.existsSync(c)) {
            return c;
        }
    }
    const pathDirs = (process.env.PATH || '').split(path.delimiter);
    for (const dir of pathDirs) {
        const candidate = path.join(dir, types_1.BINARY_NAME);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}
/** Normalize a Windows path for the CLI binary.
 * The binary's store validator rejects lowercase-drive backslash paths as "corrupt".
 * Convert to forward slashes with uppercase drive letter: e:\Foo\Bar → E:/Foo/Bar
 */
function normalizePath(p) {
    let normalized = p.replace(/\\/g, '/');
    if (/^[a-zA-Z]:/.test(normalized)) {
        normalized = normalized[0].toUpperCase() + normalized.slice(1);
    }
    return normalized;
}
//# sourceMappingURL=binary.js.map