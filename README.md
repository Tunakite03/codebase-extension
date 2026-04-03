# Codebase Memory MCP — VS Code Extension

A VS Code extension that runs [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) as a local MCP server, giving GitHub Copilot and other AI agents deep, graph-based understanding of your codebase.

## Features

- **Sidebar panel** — start/stop the MCP server, index your repo, view stats and project info at a glance
- **Knowledge graph** — 24 K+ nodes, 50 K+ edges for a typical project; supports 66 languages
- **Sub-millisecond queries** — powered by an embedded SQLite graph store
- **Local DB storage** — all data stored in `.codebase/data/` inside your workspace (easy to delete)
- **Agent config setup** — auto-generates `.github/copilot-instructions.md` wiring the MCP server into Copilot
- **Graph UI** — built-in visual graph explorer at `http://localhost:9749` (UI-variant binary)

## Requirements

The extension ships with a pre-built binary for **Windows x64** (`bin/win32-x64/codebase-memory-mcp.exe`).  
On other platforms use **Install Binary** from the sidebar or download manually from the [releases page](https://github.com/DeusData/codebase-memory-mcp/releases).

## Getting Started

1. Install the `.vsix` via **Extensions → Install from VSIX…**
2. Open your project folder in VS Code
3. Click the **Codebase Memory** icon in the Activity Bar
4. Press **Start MCP Server**
5. Press **Index / Re-index** to build the knowledge graph
6. Press **Setup Agents** to inject the MCP config into Copilot instructions

## Sidebar Actions

| Button           | When visible          | What it does                                    |
| ---------------- | --------------------- | ----------------------------------------------- |
| Start MCP Server | Server stopped        | Starts the MCP server process                   |
| Stop Server      | Server running        | Stops the MCP server                            |
| Index / Re-index | Server running        | Indexes (or re-indexes) the workspace           |
| Setup Agents     | Always (binary found) | Writes agent config files                       |
| View Logs        | Always (binary found) | Opens `.codebase/codebase-memory.log` in editor |
| Install Binary   | Binary missing        | Downloads the binary for the current platform   |

## Graph UI

The bundled binary is the **UI variant** which includes an embedded web UI:

```
& ".\bin\win32-x64\codebase-memory-mcp.exe" --ui=true --port=9749
```

Then open **http://localhost:9749** in your browser to explore the knowledge graph visually.

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

## MCP Server Config

After running **Setup Agents**, a config snippet is placed in `.codebase/config.json`:

```json
{
   "mcpServers": {
      "codebase-memory": {
         "command": "<path-to-binary>",
         "args": []
      }
   }
}
```

Copy this into your `settings.json` (`github.copilot.chat.mcp.servers`) to activate the MCP tools in Copilot Chat.

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
