import * as vscode from 'vscode';
import * as path from 'path';
import { DISPLAY_NAME } from './types';
import { state } from './state';

export class CBMWebviewProvider implements vscode.WebviewViewProvider {
   public static readonly viewType = 'contextEngine.panel';
   private _view?: vscode.WebviewView;

   constructor(private readonly _extensionUri: vscode.Uri) {}

   resolveWebviewView(webviewView: vscode.WebviewView): void {
      this._view = webviewView;
      webviewView.webview.options = {
         enableScripts: true,
         localResourceRoots: [this._extensionUri],
      };
      webviewView.webview.html = this._getHtml();
      webviewView.webview.onDidReceiveMessage((msg: { command: string; project?: string }) => {
         if (msg.command === 'removeProject' && msg.project) {
            vscode.commands.executeCommand('contextEngine.removeRepo', msg.project);
            return;
         }
         const cmdMap: Record<string, string> = {
            startServer: 'contextEngine.startServer',
            stopServer: 'contextEngine.stopServer',
            indexRepo: 'contextEngine.indexRepo',
            forceReindex: 'contextEngine.forceReindex',
            setupAgents: 'contextEngine.setupAgents',
            installBinary: 'contextEngine.installBinary',
            viewLogs: 'contextEngine.viewLogs',
            addRepo: 'contextEngine.addRepo',
            removeRepo: 'contextEngine.removeRepo',
         };
         const cmd = cmdMap[msg.command];
         if (cmd) {
            vscode.commands.executeCommand(cmd);
         }
      });
   }

   update(): void {
      if (this._view) {
         this._view.webview.html = this._getHtml();
      }
   }

   private _getNonce(): string {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let nonce = '';
      for (let i = 0; i < 32; i++) {
         nonce += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return nonce;
   }

   private _getHtml(): string {
      const nonce = this._getNonce();
      const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
      const repoName = workspace ? path.basename(workspace) : 'No workspace';
      const uptime = state.stats.startedAt ? formatUptime(Date.now() - state.stats.startedAt.getTime()) : '\u2014';
      const lastIdx = state.stats.lastIndexed ? timeAgo(state.stats.lastIndexed) : '\u2014';
      const fmt = (n: number) => (n > 0 ? n.toLocaleString() : '\u2014');

      const binaryFound = state.resolvedBinary !== null;
      const running = state.isRunning;
      const indexing = state.stats.isIndexing;
      const isWorkspace = vscode.workspace.workspaceFile !== undefined;

      // --- Status indicator ---
      let statusDot: string;
      let statusLabel: string;
      if (!binaryFound) {
         statusDot = 'red';
         statusLabel = 'binary not found';
      } else if (indexing) {
         statusDot = 'yellow pulse';
         statusLabel = 'indexing\u2026';
      } else if (running) {
         statusDot = 'green';
         statusLabel = 'running';
      } else {
         statusDot = 'gray';
         statusLabel = 'stopped';
      }

      // --- Metric cards ---
      const metricsHtml = `
         <div class="metrics">
            <div class="metric-card">
               <div class="metric-value">${fmt(state.stats.nodes)}</div>
               <div class="metric-label">Nodes</div>
            </div>
            <div class="metric-card">
               <div class="metric-value">${fmt(state.stats.edges)}</div>
               <div class="metric-label">Edges</div>
            </div>
            <div class="metric-card">
               <div class="metric-value">${uptime}</div>
               <div class="metric-label">Uptime</div>
            </div>
         </div>`;

      // --- Action buttons (Index/Re-index only when running) ---
      let actionsHtml: string;
      if (!binaryFound) {
         actionsHtml = `
            <button class="btn btn-accent" data-cmd="installBinary">
               <svg class="btn-icon" viewBox="0 0 16 16"><path d="M8 1v9m0 0L5 7m3 3l3-3M3 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
               Install Binary
            </button>`;
      } else if (running) {
         actionsHtml = `
            <button class="btn btn-danger" data-cmd="stopServer">
               <svg class="btn-icon" viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor"/></svg>
               Stop Server
            </button>
            <button class="btn" data-cmd="indexRepo">
               <svg class="btn-icon" viewBox="0 0 16 16"><path d="M8 1.5v13M1.5 8h13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none" opacity="0"/></svg>
               Index / Re-index
            </button>`;
      } else {
         actionsHtml = `
            <button class="btn btn-primary" data-cmd="startServer">
               <svg class="btn-icon" viewBox="0 0 16 16"><polygon points="4,2 14,8 4,14" fill="currentColor"/></svg>
               Start MCP Server
            </button>`;
      }

      // Always show Setup Agents, Add/Remove Repo & View Logs when binary is found
      if (binaryFound) {
         if (isWorkspace) {
            actionsHtml += `
            <button class="btn btn-accent" data-cmd="addRepo">
               <svg class="btn-icon" viewBox="0 0 16 16"><path d="M8 1.5v13M1.5 8h13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>
               Add Repository
            </button>
            <button class="btn" data-cmd="removeRepo">
               <svg class="btn-icon" viewBox="0 0 16 16"><path d="M2 4h12M5.3 4V2.7a.7.7 0 01.7-.7h4a.7.7 0 01.7.7V4m1.3 0v9.3a1 1 0 01-1 1H5a1 1 0 01-1-1V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
               Remove Repository
            </button>`;
         }
         actionsHtml += `
            <button class="btn" data-cmd="setupAgents">
               <svg class="btn-icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M8 1v2m0 10v2M1 8h2m10 0h2M2.9 2.9l1.4 1.4m7.4 7.4l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>
               Setup Agents
            </button>
            <button class="btn" data-cmd="viewLogs">
               <svg class="btn-icon" viewBox="0 0 16 16"><path d="M3 3h10M3 6h8M3 9h10M3 12h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/></svg>
               View Logs
            </button>`;
      }

      // --- Project cards ---
      const projectsHtml =
         state.stats.projects.length > 0
            ? state.stats.projects
                 .map((p) => {
                    const displayName = p.displayName || p.name;
                    const canonicalHint =
                       p.displayName && p.displayName !== p.name
                          ? `<div class="project-canonical">${escHtml(p.name)}</div>`
                          : '';
                    return `
         <div class="project-card">
            <div class="project-header">
               <div class="project-dot-wrap"><span class="dot green"></span></div>
               <div class="project-info">
                  <div class="project-name">${escHtml(displayName)}</div>
                  ${canonicalHint}
                  <div class="project-path">${escHtml(p.path)}</div>
               </div>
               <button class="btn-remove" data-remove-project="${escHtml(p.name)}" title="Remove project">
                  <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 4h12M5.3 4V2.7a.7.7 0 01.7-.7h4a.7.7 0 01.7.7V4m1.3 0v9.3a1 1 0 01-1 1H5a1 1 0 01-1-1V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
               </button>
            </div>
            <div class="project-metrics">
               <span class="pm">${fmt(p.nodes)} <em>nodes</em></span>
               <span class="pm-sep">&middot;</span>
               <span class="pm">${fmt(p.edges)} <em>edges</em></span>
            </div>
         </div>`;
                 })
                 .join('')
            : workspace
              ? `
         <div class="project-card ${running ? '' : 'project-inactive'}">
            <div class="project-header">
               <div class="project-dot-wrap"><span class="dot ${running ? 'green' : 'gray'}"></span></div>
               <div class="project-info">
                  <div class="project-name">${escHtml(repoName)}</div>
                  <div class="project-path">${escHtml(workspace)}</div>
               </div>
            </div>
            <div class="project-metrics">
               <span class="pm">${fmt(state.stats.nodes)} <em>nodes</em></span>
               <span class="pm-sep">&middot;</span>
               <span class="pm">${fmt(state.stats.edges)} <em>edges</em></span>
            </div>
            ${state.stats.lastIndexed ? `<div class="project-last">Last indexed ${lastIdx}</div>` : ''}
         </div>`
              : '<div class="empty-state">No workspace open</div>';

      // --- Binary info bar ---
      const binaryInfo = binaryFound
         ? `<div class="info-bar"><span class="info-tag ok">v0.1.0</span> Binary ready</div>`
         : `<div class="info-bar"><span class="info-tag err">!</span> Binary not found &mdash; install to get started</div>`;

      return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
${CSS}
</style>
</head>
<body>

<div class="header">
   <div class="header-left">
      <div class="logo">
         <svg viewBox="0 0 20 20" width="18" height="18">
            <circle cx="10" cy="10" r="4" stroke="var(--accent)" stroke-width="1.5" fill="none"/>
            <circle cx="10" cy="3" r="1.5" fill="var(--accent)"/>
            <circle cx="10" cy="17" r="1.5" fill="var(--accent)"/>
            <circle cx="3" cy="10" r="1.5" fill="var(--accent)"/>
            <circle cx="17" cy="10" r="1.5" fill="var(--accent)"/>
            <line x1="10" y1="6" x2="10" y2="4.5" stroke="var(--accent)" stroke-width="1"/>
            <line x1="10" y1="14" x2="10" y2="15.5" stroke="var(--accent)" stroke-width="1"/>
            <line x1="6" y1="10" x2="4.5" y2="10" stroke="var(--accent)" stroke-width="1"/>
            <line x1="14" y1="10" x2="15.5" y2="10" stroke="var(--accent)" stroke-width="1"/>
         </svg>
      </div>
      <div>
         <div class="header-title">${DISPLAY_NAME}</div>
         <div class="header-sub">Knowledge Graph Engine</div>
      </div>
   </div>
   <div class="status-chip ${statusDot}"><span class="status-dot"></span>${statusLabel}</div>
</div>

${binaryInfo}
${metricsHtml}

<div class="section">
   <div class="section-title">Actions</div>
   <div class="actions">${actionsHtml}</div>
</div>

<div class="section">
   <div class="section-title">Projects</div>
   ${projectsHtml}
</div>

<script nonce="${nonce}">
   const vscode = acquireVsCodeApi();
   document.querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
         btn.classList.add('btn-click');
         setTimeout(() => btn.classList.remove('btn-click'), 150);
         vscode.postMessage({ command: btn.dataset.cmd });
      });
   });
   document.querySelectorAll('[data-remove-project]').forEach(btn => {
      btn.addEventListener('click', (e) => {
         e.stopPropagation();
         vscode.postMessage({ command: 'removeProject', project: btn.dataset.removeProject });
      });
   });
</script>
</body>
</html>`;
   }
}

// --- Helpers ---

function escHtml(s: string): string {
   return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatUptime(ms: number): string {
   const s = Math.floor(ms / 1000);
   if (s < 60) {
      return `${s}s`;
   }
   const m = Math.floor(s / 60);
   if (m < 60) {
      return `${m}m ${s % 60}s`;
   }
   return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function timeAgo(date: Date): string {
   const s = Math.floor((Date.now() - date.getTime()) / 1000);
   if (s < 60) {
      return 'just now';
   }
   const m = Math.floor(s / 60);
   if (m < 60) {
      return `${m}m ago`;
   }
   return `${Math.floor(m / 60)}h ago`;
}

const CSS = `
:root {
   --accent: #58a6ff;
   --accent-green: #3fb950;
   --accent-red: #f85149;
   --accent-yellow: #d29922;
   --surface: rgba(255,255,255,0.03);
   --surface-hover: rgba(255,255,255,0.06);
   --border: rgba(255,255,255,0.08);
   --border-hover: rgba(255,255,255,0.15);
   --text-primary: var(--vscode-foreground);
   --text-secondary: var(--vscode-descriptionForeground);
   --radius: 6px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
   font-family: var(--vscode-font-family);
   font-size: var(--vscode-font-size);
   color: var(--text-primary);
   background: transparent;
   padding: 0 0 20px;
   -webkit-font-smoothing: antialiased;
}

/* ── Header ── */
.header {
   display: flex;
   align-items: center;
   justify-content: space-between;
   padding: 14px 14px 10px;
}
.header-left {
   display: flex;
   align-items: center;
   gap: 10px;
}
.logo {
   width: 32px; height: 32px;
   display: flex; align-items: center; justify-content: center;
   background: rgba(88,166,255,0.08);
   border-radius: 8px;
   flex-shrink: 0;
}
.header-title {
   font-size: 13px;
   font-weight: 700;
   letter-spacing: -0.01em;
   line-height: 1.2;
}
.header-sub {
   font-size: 10px;
   color: var(--text-secondary);
   letter-spacing: 0.02em;
}

/* ── Status chip ── */
.status-chip {
   display: inline-flex;
   align-items: center;
   gap: 6px;
   padding: 3px 10px 3px 8px;
   font-size: 10px;
   font-weight: 600;
   letter-spacing: 0.03em;
   border-radius: 20px;
   text-transform: uppercase;
   white-space: nowrap;
}
.status-dot {
   width: 6px; height: 6px;
   border-radius: 50%;
   display: inline-block;
}
.status-chip.green { background: rgba(63,185,80,0.12); color: #3fb950; }
.status-chip.green .status-dot { background: #3fb950; box-shadow: 0 0 6px rgba(63,185,80,0.5); }
.status-chip.gray { background: rgba(110,118,129,0.12); color: #8b949e; }
.status-chip.gray .status-dot { background: #6e7681; }
.status-chip.red { background: rgba(248,81,73,0.12); color: #f85149; }
.status-chip.red .status-dot { background: #f85149; }
.status-chip.yellow { background: rgba(210,153,34,0.12); color: #d29922; }
.status-chip.yellow .status-dot { background: #d29922; }
.status-chip.pulse .status-dot {
   animation: pulse-glow 1.5s ease-in-out infinite;
}
@keyframes pulse-glow {
   0%, 100% { opacity: 1; box-shadow: 0 0 4px currentColor; }
   50% { opacity: 0.5; box-shadow: 0 0 10px currentColor; }
}

/* ── Info bar ── */
.info-bar {
   display: flex;
   align-items: center;
   gap: 8px;
   margin: 0 12px 10px;
   padding: 7px 10px;
   background: var(--surface);
   border: 1px solid var(--border);
   border-radius: var(--radius);
   font-size: 11px;
   color: var(--text-secondary);
}
.info-tag {
   display: inline-flex;
   align-items: center;
   justify-content: center;
   padding: 1px 6px;
   font-size: 10px;
   font-weight: 700;
   border-radius: 4px;
   letter-spacing: 0.02em;
}
.info-tag.ok {
   background: rgba(63,185,80,0.15);
   color: #3fb950;
}
.info-tag.err {
   background: rgba(248,81,73,0.15);
   color: #f85149;
   min-width: 16px;
   text-align: center;
}

/* ── Metrics ── */
.metrics {
   display: grid;
   grid-template-columns: repeat(3, 1fr);
   gap: 8px;
   padding: 0 12px 6px;
}
.metric-card {
   background: var(--surface);
   border: 1px solid var(--border);
   border-radius: var(--radius);
   padding: 10px 8px 8px;
   text-align: center;
}
.metric-value {
   font-size: 16px;
   font-weight: 800;
   letter-spacing: -0.02em;
   line-height: 1.1;
   color: var(--text-primary);
}
.metric-label {
   font-size: 9px;
   font-weight: 600;
   text-transform: uppercase;
   letter-spacing: 0.08em;
   color: var(--text-secondary);
   margin-top: 3px;
}

/* ── Section ── */
.section {
   margin-top: 4px;
}
.section-title {
   padding: 10px 14px 6px;
   font-size: 10px;
   font-weight: 700;
   letter-spacing: 0.1em;
   text-transform: uppercase;
   color: var(--text-secondary);
}

/* ── Actions ── */
.actions {
   padding: 0 10px;
   display: flex;
   flex-direction: column;
   gap: 4px;
}
.btn {
   display: flex;
   align-items: center;
   gap: 10px;
   width: 100%;
   padding: 8px 12px;
   font-family: var(--vscode-font-family);
   font-size: 12px;
   font-weight: 500;
   color: var(--text-primary);
   background: var(--surface);
   border: 1px solid var(--border);
   border-radius: var(--radius);
   cursor: pointer;
   text-align: left;
   transition: all 0.15s ease;
   position: relative;
   overflow: hidden;
}
.btn::after {
   content: '';
   position: absolute;
   inset: 0;
   background: transparent;
   transition: background 0.15s;
}
.btn:hover {
   background: var(--surface-hover);
   border-color: var(--border-hover);
   transform: translateY(-0.5px);
}
.btn:active, .btn.btn-click {
   transform: translateY(0.5px);
}
.btn-icon {
   width: 15px;
   height: 15px;
   flex-shrink: 0;
   opacity: 0.7;
}
.btn:hover .btn-icon { opacity: 0.9; }

.btn.btn-primary {
   background: rgba(63,185,80,0.1);
   border-color: rgba(63,185,80,0.3);
   color: var(--accent-green);
   font-weight: 600;
}
.btn.btn-primary:hover {
   background: rgba(63,185,80,0.18);
   border-color: rgba(63,185,80,0.45);
}
.btn.btn-primary .btn-icon { opacity: 1; }

.btn.btn-danger {
   background: rgba(248,81,73,0.08);
   border-color: rgba(248,81,73,0.25);
   color: var(--accent-red);
   font-weight: 600;
}
.btn.btn-danger:hover {
   background: rgba(248,81,73,0.15);
   border-color: rgba(248,81,73,0.4);
}
.btn.btn-danger .btn-icon { opacity: 1; }

.btn.btn-accent {
   background: rgba(88,166,255,0.08);
   border-color: rgba(88,166,255,0.25);
   color: var(--accent);
   font-weight: 600;
}
.btn.btn-accent:hover {
   background: rgba(88,166,255,0.15);
   border-color: rgba(88,166,255,0.4);
}
.btn.btn-accent .btn-icon { opacity: 1; }

/* ── Project cards ── */
.project-card {
   margin: 4px 10px;
   padding: 12px 14px;
   background: var(--surface);
   border: 1px solid var(--border);
   border-radius: var(--radius);
   transition: border-color 0.15s;
}
.project-card:hover {
   border-color: var(--border-hover);
}
.project-inactive {
   opacity: 0.6;
}
.project-header {
   display: flex;
   align-items: flex-start;
   gap: 10px;
   margin-bottom: 8px;
}
.project-dot-wrap {
   padding-top: 3px;
}
.dot {
   width: 7px; height: 7px;
   border-radius: 50%;
   display: block;
   flex-shrink: 0;
}
.dot.green { background: #3fb950; box-shadow: 0 0 5px rgba(63,185,80,0.4); }
.dot.gray  { background: #484f58; }
.project-info { flex: 1; min-width: 0; }
.btn-remove {
   background: none;
   border: 1px solid transparent;
   border-radius: 4px;
   color: var(--text-secondary);
   cursor: pointer;
   padding: 3px;
   opacity: 0;
   transition: all 0.15s ease;
   flex-shrink: 0;
}
.project-card:hover .btn-remove { opacity: 0.6; }
.btn-remove:hover { opacity: 1 !important; color: var(--accent-red); border-color: rgba(248,81,73,0.3); background: rgba(248,81,73,0.08); }
.project-name {
   font-weight: 700;
   font-size: 12px;
   line-height: 1.3;
   word-break: break-word;
}
.project-canonical {
   font-size: 10px;
   color: var(--text-secondary);
   margin-top: 1px;
   word-break: break-word;
}
.project-path {
   font-size: 10px;
   color: var(--text-secondary);
   word-break: break-all;
   margin-top: 1px;
}
.project-metrics {
   display: flex;
   align-items: center;
   gap: 5px;
   margin-top: 4px;
   font-size: 11px;
   color: var(--text-secondary);
}
.project-metrics em {
   font-style: normal;
   opacity: 0.7;
}
.pm-sep { opacity: 0.3; }
.project-last {
   font-size: 10px;
   color: var(--text-secondary);
   margin-top: 4px;
   opacity: 0.7;
}

/* ── Empty state ── */
.empty-state {
   padding: 20px 14px;
   font-size: 11px;
   color: var(--text-secondary);
   text-align: center;
   opacity: 0.6;
}
`;
