import * as vscode from "vscode";
import * as path from "path";
import { spawn } from "child_process";
import { DISPLAY_NAME, ProjectInfo } from "./types";
import { state } from "./state";
import { log } from "./logger";
import { runCli, parseMcpEnvelope, getCacheEnv } from "./cli";
import { deriveProjectNameFromPath, normalizePath } from "./binary";
import { writeCodebaseDir } from "./config";
import { getPrimaryWorkspacePath } from "./workspace";

interface ListProjectsItem {
  name: string;
  root_path: string;
  nodes: number;
  edges: number;
  size_bytes: number;
  display_name?: string;
  aliases?: string[];
}

function isPathLike(value: string): boolean {
  return value.includes("/") || value.includes("\\") || value.includes(":");
}

function normalizeProjectKey(value: string): string {
  return normalizePath(value).replace(/\/+$/, "").toLowerCase();
}

function deriveLegacyProjectName(pathLike: string): string {
  return deriveProjectNameFromPath(pathLike);
}

function getProjectDisplayName(project: ProjectInfo): string {
  if (project.displayName && project.displayName.trim().length > 0) {
    return project.displayName;
  }
  const base = path.basename(project.path);
  return base || project.name;
}

function resolveProjectReference(projectRef: string): ProjectInfo | undefined {
  const ref = projectRef.trim();
  if (!ref) {
    return undefined;
  }

  const lowerRef = ref.toLowerCase();
  const normalizedRef = normalizeProjectKey(ref);

  const byExactName = state.stats.projects.find((p) => p.name === ref);
  if (byExactName) {
    return byExactName;
  }

  const byNameIgnoreCase = state.stats.projects.find(
    (p) => p.name.toLowerCase() === lowerRef,
  );
  if (byNameIgnoreCase) {
    return byNameIgnoreCase;
  }

  const byPath = state.stats.projects.find(
    (p) => normalizeProjectKey(p.path) === normalizedRef,
  );
  if (byPath) {
    return byPath;
  }

  const byDisplay = state.stats.projects.find(
    (p) => getProjectDisplayName(p).toLowerCase() === lowerRef,
  );
  if (byDisplay) {
    return byDisplay;
  }

  const byAlias = state.stats.projects.find((p) =>
    (p.aliases || []).some((alias) => {
      if (alias.toLowerCase() === lowerRef) {
        return true;
      }
      if (isPathLike(alias)) {
        return normalizeProjectKey(alias) === normalizedRef;
      }
      return false;
    }),
  );
  if (byAlias) {
    return byAlias;
  }

  if (isPathLike(ref)) {
    const legacyName = deriveLegacyProjectName(ref).toLowerCase();
    return state.stats.projects.find(
      (p) => p.name.toLowerCase() === legacyName,
    );
  }

  return undefined;
}

function resolveWorkspaceProject(workspace: string): ProjectInfo | undefined {
  const workspaceMatch = resolveProjectReference(workspace);
  if (workspaceMatch) {
    return workspaceMatch;
  }

  const workspaceBase = path.basename(normalizePath(workspace)).toLowerCase();
  const displayMatches = state.stats.projects.filter(
    (p) => getProjectDisplayName(p).toLowerCase() === workspaceBase,
  );
  if (displayMatches.length === 1) {
    return displayMatches[0];
  }
  if (displayMatches.length > 1) {
    log(
      `[WARN] Multiple projects match workspace basename "${workspaceBase}"; using legacy delete fallback for force reindex`,
    );
  }

  const legacyName = deriveLegacyProjectName(workspace).toLowerCase();
  return state.stats.projects.find((p) => p.name.toLowerCase() === legacyName);
}

function maybeAutoIndexWorkspace(workspace: string): void {
  if (!workspace || !state.isRunning || state.stats.isIndexing) {
    return;
  }

  const indexedWorkspace = resolveWorkspaceProject(workspace);
  if (indexedWorkspace) {
    log(`[INFO] Workspace already indexed as "${indexedWorkspace.name}"`);
    return;
  }

  log("[INFO] Workspace is not indexed yet — starting auto-index");
  void indexRepository(workspace);
}

export function startServer(context: vscode.ExtensionContext): void {
  if (state.mcpProcess) {
    vscode.window.showWarningMessage(
      `${DISPLAY_NAME}: Server already running.`,
    );
    return;
  }
  if (!state.resolvedBinary) {
    vscode.window.showErrorMessage(
      `${DISPLAY_NAME}: Binary not found. Install it first.`,
    );
    return;
  }
  log(`[INFO] Starting MCP server: ${state.resolvedBinary}`);
  state.mcpProcess = spawn(state.resolvedBinary, [], {
    stdio: ["pipe", "pipe", "pipe"],
    env: getCacheEnv(),
  });
  state.stats.startedAt = new Date();
  state.isRunning = true;
  state.mcpProcess.stderr?.on("data", (data: Buffer) =>
    log(`[SERVER] ${data.toString().trimEnd()}`),
  );
  state.mcpProcess.on("error", (err: Error) => {
    log(`[ERROR] ${err.message}`);
    stopServer();
  });
  state.mcpProcess.on("exit", (code: number | null) => {
    log(`[INFO] MCP server exited with code ${code}`);
    stopServer();
  });
  vscode.commands.executeCommand("setContext", "contextEngine.running", true);
  state.statusBarItem.text = `$(circuit-board) ${DISPLAY_NAME}: running`;
  state.webviewProvider.update();

  if (!state.pollTimer) {
    state.pollTimer = setInterval(() => {
      const workspace = getPrimaryWorkspacePath();
      if (workspace) {
        void pollStats(workspace);
      } else {
        state.webviewProvider.update();
      }
    }, 8000);
  }
  const workspace = getPrimaryWorkspacePath();
  if (!workspace) {
    return;
  }
  pollStats(workspace).then(() => {
    maybeAutoIndexWorkspace(workspace);
  });
}

export function stopServer(): void {
  const wasRunning = state.isRunning;
  if (state.mcpProcess) {
    state.mcpProcess.kill();
    state.mcpProcess = null;
  }
  if (!wasRunning) {
    return;
  }
  state.stats.startedAt = null;
  state.isRunning = false;
  vscode.commands.executeCommand("setContext", "contextEngine.running", false);
  state.statusBarItem.text = `$(circle-outline) ${DISPLAY_NAME}: stopped`;
  state.webviewProvider.update();
}

export async function pollStats(workspace: string): Promise<void> {
  if (!state.resolvedBinary) {
    return;
  }
  try {
    const raw = await runCli(state.resolvedBinary, [
      "cli",
      "list_projects",
      "{}",
    ]);
    const result = parseMcpEnvelope(raw) as {
      projects?: ListProjectsItem[];
    };
    const projects = (result.projects || []).map(
      (p): ProjectInfo => ({
        name: p.name,
        path: p.root_path,
        nodes: p.nodes,
        edges: p.edges,
        files: p.size_bytes,
        displayName:
          typeof p.display_name === "string"
            ? p.display_name
            : path.basename(p.root_path) || p.name,
        aliases: Array.isArray(p.aliases)
          ? p.aliases.filter(
              (alias): alias is string =>
                typeof alias === "string" && alias.trim().length > 0,
            )
          : undefined,
      }),
    );
    let totalNodes = 0;
    let totalEdges = 0;
    for (const p of projects) {
      totalNodes += p.nodes;
      totalEdges += p.edges;
    }
    state.stats.projects = projects;
    state.stats.nodes = totalNodes;
    state.stats.edges = totalEdges;
    if (totalNodes > 0) {
      state.stats.lastIndexed = new Date();
    }
    state.statusBarItem.text =
      totalNodes > 0
        ? `$(circuit-board) ${totalNodes.toLocaleString()} nodes`
        : `$(circuit-board) ${DISPLAY_NAME}: running`;
    state.webviewProvider.update();
    writeCodebaseDir(workspace);
  } catch (err: unknown) {
    log(`[POLL ERROR] ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function addRepository(): Promise<void> {
  if (!state.resolvedBinary) {
    vscode.window.showErrorMessage(`${DISPLAY_NAME}: Binary not found.`);
    return;
  }
  if (!vscode.workspace.workspaceFolders) {
    vscode.window.showWarningMessage(`${DISPLAY_NAME}: No workspace open.`);
    return;
  }
  const uris = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: "Add Repository",
    title: `${DISPLAY_NAME}: Select a repository folder to add`,
  });
  if (!uris || uris.length === 0) {
    return;
  }
  const repoUri = uris[0];
  const repoPath = repoUri.fsPath;

  // Add to VS Code workspace (multi-root) if not already present
  const alreadyInWorkspace = vscode.workspace.workspaceFolders.some(
    (f) => normalizePath(f.uri.fsPath) === normalizePath(repoPath),
  );
  if (!alreadyInWorkspace) {
    const addedOk = vscode.workspace.updateWorkspaceFolders(
      vscode.workspace.workspaceFolders.length,
      0,
      {
        uri: repoUri,
        name: path.basename(repoPath),
      },
    );
    if (!addedOk) {
      vscode.window.showErrorMessage(
        `${DISPLAY_NAME}: Failed to add folder to workspace.`,
      );
      return;
    }
    log(`[INFO] Added to workspace: ${repoPath}`);
  }

  // Index the repository
  log(`[INFO] Adding repository: ${repoPath}`);
  await indexRepository(repoPath);
}

export async function removeRepository(projectName?: string): Promise<void> {
  if (!state.resolvedBinary) {
    vscode.window.showErrorMessage(`${DISPLAY_NAME}: Binary not found.`);
    return;
  }
  if (state.stats.projects.length === 0) {
    vscode.window.showInformationMessage(
      `${DISPLAY_NAME}: No indexed projects to remove.`,
    );
    return;
  }

  let selectedLabel: string;
  let selectedDisplay: string;
  let selectedPath: string;

  if (projectName) {
    // Called from webview/command with project name, display name, or root path.
    const project = resolveProjectReference(projectName);
    if (!project) {
      vscode.window.showErrorMessage(
        `${DISPLAY_NAME}: Project "${projectName}" not found.`,
      );
      return;
    }
    selectedLabel = project.name;
    selectedDisplay = getProjectDisplayName(project);
    selectedPath = project.path;
  } else {
    // Show quick pick
    const items = state.stats.projects.map((p) => ({
      label: getProjectDisplayName(p),
      description: p.name,
      detail: `${p.path} · ${p.nodes.toLocaleString()} nodes · ${p.edges.toLocaleString()} edges`,
      project: p,
    }));
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a project to remove",
      title: `${DISPLAY_NAME}: Remove Repository`,
    });
    if (!selected) {
      return;
    }
    selectedLabel = selected.project.name;
    selectedDisplay = selected.label;
    selectedPath = selected.project.path;
  }

  try {
    await runCli(
      state.resolvedBinary,
      ["cli", "delete_project", JSON.stringify({ project: selectedLabel })],
      10000,
    );
    const shownName =
      selectedDisplay === selectedLabel
        ? selectedLabel
        : `${selectedDisplay} (${selectedLabel})`;
    vscode.window.showInformationMessage(
      `${DISPLAY_NAME}: Removed "${shownName}".`,
    );
    log(`[INFO] Removed project: ${selectedLabel}`);

    // Offer to remove from VS Code workspace if present
    if (selectedPath && vscode.workspace.workspaceFolders) {
      const wsIndex = vscode.workspace.workspaceFolders.findIndex(
        (f) => normalizePath(f.uri.fsPath) === normalizePath(selectedPath),
      );
      if (wsIndex >= 0 && vscode.workspace.workspaceFolders.length > 1) {
        const answer = await vscode.window.showInformationMessage(
          `Remove "${path.basename(selectedPath)}" from workspace folders too?`,
          "Yes",
          "No",
        );
        if (answer === "Yes") {
          vscode.workspace.updateWorkspaceFolders(wsIndex, 1);
          log(`[INFO] Removed from workspace: ${selectedPath}`);
        }
      }
    }

    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
    await pollStats(workspace);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(
      `${DISPLAY_NAME}: Failed to remove project — ${msg}`,
    );
    log(`[REMOVE ERROR] ${msg}`);
  }
}

export async function forceReindexRepository(workspace: string): Promise<void> {
  if (!workspace) {
    vscode.window.showErrorMessage(
      `${DISPLAY_NAME}: No workspace folder open.`,
    );
    return;
  }
  if (!state.resolvedBinary) {
    vscode.window.showErrorMessage(`${DISPLAY_NAME}: Binary not found.`);
    return;
  }

  await pollStats(workspace);

  const targetProject = resolveWorkspaceProject(workspace);
  if (targetProject) {
    try {
      await runCli(
        state.resolvedBinary,
        [
          "cli",
          "delete_project",
          JSON.stringify({ project: targetProject.name }),
        ],
        10000,
      );
      log(`[INFO] Force re-index: removed project "${targetProject.name}"`);
    } catch (err: unknown) {
      log(
        `[WARN] Force re-index: failed to remove "${targetProject.name}" — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  } else {
    const legacyName = deriveLegacyProjectName(workspace);
    try {
      await runCli(
        state.resolvedBinary,
        ["cli", "delete_project", JSON.stringify({ project: legacyName })],
        10000,
      );
      log(`[INFO] Force re-index: removed legacy project key "${legacyName}"`);
    } catch {
      log(
        `[INFO] Force re-index: no existing project matched workspace "${workspace}"; continuing with fresh index`,
      );
    }
  }

  await indexRepository(workspace);
}

export async function indexRepository(
  workspace: string,
  silent: boolean = false,
): Promise<void> {
  if (!state.resolvedBinary) {
    vscode.window.showErrorMessage(`${DISPLAY_NAME}: Binary not found.`);
    return;
  }
  if (!workspace) {
    vscode.window.showErrorMessage(
      `${DISPLAY_NAME}: No workspace folder open.`,
    );
    return;
  }
  if (state.stats.isIndexing) {
    log("[INFO] Indexing already in progress, skipping duplicate request");
    return;
  }

  state.stats.isIndexing = true;
  state.statusBarItem.text = `$(sync~spin) ${DISPLAY_NAME}: indexing...`;
  state.webviewProvider.update();
  log(`[INFO] Indexing: ${workspace}`);

  try {
    const out = await runCli(
      state.resolvedBinary,
      [
        "cli",
        "index_repository",
        JSON.stringify({ repo_path: normalizePath(workspace) }),
      ],
      600000,
    ); // 10 min timeout for large repos
    log(`[INDEX] ${out.trim()}`);
    if (!silent) {
      vscode.window.showInformationMessage(
        `${DISPLAY_NAME}: Indexing complete.`,
      );
    }
    state.stats.lastIndexed = new Date();
    await pollStats(workspace);
    writeCodebaseDir(workspace);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`${DISPLAY_NAME}: Indexing failed — ${msg}`);
    log(`[INDEX ERROR] ${msg}`);
  } finally {
    state.stats.isIndexing = false;
    state.statusBarItem.text =
      state.stats.nodes > 0
        ? `$(circuit-board) ${state.stats.nodes.toLocaleString()} nodes`
        : state.isRunning
          ? `$(circuit-board) ${DISPLAY_NAME}: running`
          : `$(circle-outline) ${DISPLAY_NAME}: stopped`;
    state.webviewProvider.update();
  }
}
