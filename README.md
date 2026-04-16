# Project Memory MCP

An MCP (Model Context Protocol) server that gives AI assistants persistent, **project-scoped** memory. Memories are stored as files inside your repository under `.github/memories/`, so they travel with the project and can be shared via version control.

> **Based on** the [official VS Code memory tool](https://github.com/microsoft/vscode-copilot-chat/blob/main/src/extension/tools/node/memoryTool.tsx), but redesigned to store memories **per-project** instead of globally — making them portable, version-controlled, and team-shareable.

## Features

- **Project-scoped** — memories live in `.github/memories/` inside your repo
- **Three memory scopes** — user, repo, and session memories with separate storage
- **VS Code compatible** — same `/memories/` path API as the built-in VS Code Copilot memory tool
- **Version-controlled** — commit and share context with your team
- **Full CRUD** — view, create, edit (string replace / insert), rename, and delete memory files
- **Path-safe** — validates all paths and blocks traversal attacks
- **Docker-ready** — run as a container with a single mount

## Setup

### ✨ One-Click Install

Install the MCP server directly into VS Code or VS Code Insiders:

> ⚠️ **Select 'Install in Workspace'**

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Project_Shared_Memory_MCP-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=project-shared-memory&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22project-shared-memory-mcp%22%5D%2C%22env%22%3A%7B%22PROJECT_ROOT%22%3A%22%24%7BworkspaceFolder%7D%22%7D%7D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_Project_Shared_Memory_MCP-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=project-shared-memory&quality=insiders&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22project-shared-memory-mcp%22%5D%2C%22env%22%3A%7B%22PROJECT_ROOT%22%3A%22%24%7BworkspaceFolder%7D%22%7D%7D)

#### 🐳 Docker

[![Install in VS Code (Docker)](https://img.shields.io/badge/VS_Code-Install_with_Docker-0098FF?style=flat-square&logo=docker&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=project-shared-memory&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22docker%22%2C%22args%22%3A%5B%22run%22%2C%22-i%22%2C%22--rm%22%2C%22-v%22%2C%22%24%7BworkspaceFolder%7D%3A%2Fproject%22%2C%22node%3A22-alpine%22%2C%22npx%22%2C%22-y%22%2C%22project-shared-memory-mcp%22%5D%7D)
[![Install in VS Code Insiders (Docker)](https://img.shields.io/badge/VS_Code_Insiders-Install_with_Docker-24bfa5?style=flat-square&logo=docker&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=project-shared-memory&quality=insiders&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22docker%22%2C%22args%22%3A%5B%22run%22%2C%22-i%22%2C%22--rm%22%2C%22-v%22%2C%22%24%7BworkspaceFolder%7D%3A%2Fproject%22%2C%22node%3A22-alpine%22%2C%22npx%22%2C%22-y%22%2C%22project-shared-memory-mcp%22%5D%7D)

> Requires only Docker — uses the official `node:22-alpine` image and installs the package via `npx` at runtime.

### Option A — Run with NPX

No need to clone — just add this to `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "project-shared-memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "project-shared-memory-mcp"],
      "env": {
        "PROJECT_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### Option B — Run from source

```bash
git clone git@github.com:doctorspider42/Project-Shared-Memory-MCP.git
cd Project-Shared-Memory-MCP
npm install
npm run build
```

Add to your VS Code **settings** (`.vscode/settings.json`):

```jsonc
{
  "mcp": {
    "servers": {
      "project-shared-memory": {
        "command": "node",
        "args": ["<path-to>/Project-Shared-Memory-MCP/dist/index.js"],
        "env": {
          "PROJECT_ROOT": "${workspaceFolder}"
        }
      }
    }
  }
}
```

### Option C — Run with Docker

```bash
# Build the image
docker build -t project-shared-memory-mcp .
```

Register in VS Code MCP settings:

```jsonc
{
  "mcp": {
    "servers": {
      "project-shared-memory": {
        "command": "docker",
        "args": [
          "run", "-i", "--rm",
          "-v", "${workspaceFolder}:/project",
          "project-shared-memory-mcp"
        ]
      }
    }
  }
}
```

The container expects the project to be mounted at `/project` (the default `PROJECT_ROOT`).

## How It Works

All memory paths are virtual and start with `/memories/`. The server maps them to `.github/memories/` inside the project root, organized by scope:

### Memory Scopes

| Scope | Virtual Path | Storage Path | Purpose |
|---|---|---|---|
| **User** | `/memories/notes.md` | `.github/memories/user/notes.md` | Personal notes, preferences, patterns — persistent across all projects |
| **Repo** | `/memories/repo/conventions.md` | `.github/memories/repo/conventions.md` | Repository conventions, build commands, project structure facts |
| **Session** | `/memories/session/progress.md` | `.github/memories/session/progress.md` | Current task context, in-progress notes, temporary working state |

This matches the [VS Code Copilot memory tool](https://github.com/microsoft/vscode-copilot-chat) API, so the paths are interchangeable.

### Examples

```
/memories/               →  lists all memories (merged view across scopes)
/memories/notes.md       →  .github/memories/user/notes.md
/memories/repo/          →  .github/memories/repo/
/memories/session/ctx.md →  .github/memories/session/ctx.md
```

When listing `/memories/`, user files appear at root level while `repo/` and `session/` show as scope directories — no implementation detail leaks.

You can instruct the AI to store notes, decisions, conventions, or any other context — and it will persist across sessions.

### Recommended `.gitignore`

User and session memories are personal — add them to `.gitignore` so only repo-scoped memories are shared with the team:

```gitignore
# Personal AI memories (not shared)
.github/memories/user/
.github/memories/session/
```

## Available Tools

| Tool | Description |
|---|---|
| `memory_view` | View a file's contents or list a directory |
| `memory_create` | Create a new memory file |
| `memory_str_replace` | Replace an exact string in a memory file |
| `memory_insert` | Insert text at a specific line |
| `memory_delete` | Delete a file or directory |
| `memory_rename` | Rename / move a file or directory |

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `PROJECT_ROOT` | `/project` | Absolute path to the project root. In VS Code's stdio mode, set this to `${workspaceFolder}`. |

## License

[MIT](LICENSE)
