# Codebase Memory MCP — VS Code Extension

A VS Code extension that runs [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) as a local MCP server, giving GitHub Copilot and other AI agents deep, graph-based understanding of your codebase.

## Features

- **Sidebar panel** — start/stop the MCP server, index your repo, view stats and project info at a glance
- **Knowledge graph** — 24 K+ nodes, 50 K+ edges for a typical project; supports 66 languages
- **Sub-millisecond queries** — powered by an embedded SQLite graph store
- **Local DB storage** — all data stored in `.codebase/data/` inside your workspace (easy to delete)
- **Agent config setup** — auto-generates config for Copilot, Claude, Cursor, and Zed; merges into existing files without overwriting your content

## Requirements

The extension ships with a pre-built binary for **Windows x64** (`bin/win32-x64/codebase-memory-mcp.exe`).  
On other platforms use **Install Binary** from the sidebar or download manually from the [releases page](https://github.com/DeusData/codebase-memory-mcp/releases).

## Getting Started

1. Install the `.vsix` via **Extensions → Install from VSIX…**
2. Open your project folder in VS Code
3. Click the **Codebase Memory** icon in the Activity Bar
4. Press **Start MCP Server**
5. Press **Index / Re-index** to build the knowledge graph
6. Press **Setup Agents** to inject MCP config into Copilot, Claude, Cursor, and Zed

## Sidebar Actions

| Button           | When visible          | What it does                                         |
| ---------------- | --------------------- | ---------------------------------------------------- |
| Start MCP Server | Server stopped        | Starts the MCP server process                        |
| Stop Server      | Server running        | Stops the MCP server                                 |
| Index / Re-index | Server running        | Indexes (or re-indexes) the workspace                |
| Setup Agents     | Always (binary found) | Writes/merges agent config files for multiple agents |
| View Logs        | Always (binary found) | Opens `.codebase/codebase-memory.log` in editor      |
| Install Binary   | Binary missing        | Downloads the binary for the current platform        |

## Local Storage

All data is kept inside your workspace under `.codebase/`:

```
.codebase/
  config.json              # MCP server config snippet
  codebase-memory.log      # Extension log (rotated at 1 MB)
  data/
    .cache/
      codebase-memory-mcp/
        <project>.db       # SQLite knowledge graph
```

The entire `.codebase/` directory is git-ignored by default.

## Setup Agents — Multi-Agent Config

Running **Setup Agents** writes MCP server configuration for multiple AI agents at once.
Existing files are **merged, not overwritten** — your custom settings and other MCP servers are preserved.

| File                                                     | Agent          | Merge strategy                             |
| -------------------------------------------------------- | -------------- | ------------------------------------------ |
| `.vscode/mcp.json`                                       | GitHub Copilot | Deep-merge JSON (preserves other servers)  |
| `.github/copilot-instructions.md`                        | GitHub Copilot | Upsert `## Codebase Memory MCP` section    |
| `.github/instructions/codebase-workflow.instructions.md` | GitHub Copilot | Upsert `## Codebase Memory MCP` section    |
| `AGENTS.md`                                              | GitHub Copilot | Upsert `## Codebase Memory MCP` section    |
| `.claude/CLAUDE.md`                                      | Claude Code    | Upsert `## Codebase Memory MCP` section    |
| `.cursor/mcp.json`                                       | Cursor         | Deep-merge JSON (preserves other servers)  |
| `.zed/settings.json`                                     | Zed            | Deep-merge JSON (preserves other settings) |

**JSON files**: recursively deep-merged — the `codebase-memory` server entry is added or updated while all sibling keys are kept intact.

**Markdown files**: if a `## Codebase Memory MCP` section already exists it is replaced in-place with the latest content; otherwise the section is appended to the end of the file.

A config snippet is also saved to `.codebase/config.json` for reference:

```json
{
   "mcp": {
      "command": "<path-to-binary>",
      "args": [],
      "transport": "stdio"
   }
}
```

## Commands

All commands are available via the Command Palette (`Ctrl+Shift+P`) under the `Codebase Memory` category:

- `Codebase Memory: Start MCP Server`
- `Codebase Memory: Stop MCP Server`
- `Codebase Memory: Index Repository`
- `Codebase Memory: Force Re-index`
- `Codebase Memory: Setup Agent Configs`
- `Codebase Memory: View Logs`
- `Codebase Memory: Install Binary`

## Building from Source

```bash
cd vscode-extension
npm install
npx tsc
npx @vscode/vsce package --no-dependencies
```

## License

MIT
