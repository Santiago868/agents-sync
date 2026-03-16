# ConfigHub

A terminal-based CLI dashboard for managing and syncing team AGENT.MD and SKILL.MD files with a central Git repository. Built with [OpenTUI](https://github.com/anomalyco/opentui) React and [Bun](https://bun.sh).

## Install

```bash
bun install
```

## Run

```bash
bun run dev
```

Or directly:

```bash
bun run index.ts
```

## First-Time Setup

1. Launch the app — you'll see the **Settings** screen
2. Enter the Git remote URL for your team's central agents/skills repository
3. Press **Enter** — the repo will be cloned to `~/.team-agents-repo/`
4. If the repo has multiple top-level folders, you'll be prompted to select which folder maps to your current project (saved to `.agentrc.json`)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` | Open Settings (change Git remote URL) |
| `P` | Pull selected file from central repo to your local project |
| `U` | Push local changes — opens commit prompt, then commits & pushes |
| `D` | Show diff between local and central version (displayed in right pane) |
| `R` | Refresh — re-pull the central repo and update the file list |
| `Q` / `Esc` | Quit |
| `j` / `Down` | Move selection down in file explorer |
| `k` / `Up` | Move selection up in file explorer |
| `Enter` | Navigate into a folder (in explorer) |

## How It Works

### Layout

- **Header**: ASCII art "ConfigHub" title
- **Left pane**: File explorer showing the central repo contents
- **Right pane**: Live diff viewer comparing your local file vs the central repo version
- **Footer**: Hotkey hints and status messages

### Config Files

| File | Location | Purpose |
|------|----------|---------|
| `~/.agents-cli-config.json` | Home directory | Stores the Git remote URL |
| `~/.team-agents-repo/` | Home directory | Local clone of the central repo (hidden cache) |
| `.agentrc.json` | Project root | Maps your project to a folder in the central repo |

### Workflows

**Pulling a file**: Select a file in the explorer, press `P`. The file is copied from the central repo cache to your current working directory.

**Pushing changes**: Select a file, press `U`. Enter a commit message in the prompt. Your local file is copied into the central repo cache, committed, and pushed.

**Viewing diffs**: Select any file — the right pane automatically shows a split diff between your local version and the central repo version.

**Conflict resolution**: If a `git pull` encounters merge conflicts, a modal appears listing the conflicted files. Resolve them manually in `~/.team-agents-repo/`, then press `R` to retry.

## Build for Distribution

```bash
bun run build
```

Outputs to `dist/index.js`. The `package.json` `bin` field maps `agents-sync` to the entry point for global CLI installation.

## Tech Stack

- **Runtime**: Bun
- **UI**: @opentui/core + @opentui/react (terminal React renderer)
- **Git**: simple-git
- **Language**: TypeScript (.tsx)
