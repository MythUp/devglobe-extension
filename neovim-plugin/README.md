# DevGlobe — NeoVim Plugin

Show your live coding presence on the [DevGlobe](https://devglobe.xyz) world map from NeoVim.

## Requirements

- NeoVim 0.9+
- [Node.js](https://nodejs.org) 18+
- A DevGlobe API key from [devglobe.xyz](https://devglobe.xyz)

## Installation

### lazy.nvim

```lua
{
  "Nako0/devglobe-extension",
  event = "BufEnter",
  build = "cd devglobe-core && npm install && npm run build",
  config = function()
    vim.opt.rtp:append(vim.fn.stdpath("data") .. "/lazy/devglobe-extension/neovim-plugin")
    vim.cmd("runtime plugin/devglobe.lua")
    require("devglobe").setup()
  end,
}
```

### packer.nvim

```lua
use {
  "Nako0/devglobe-extension",
  rtp = "neovim-plugin",
  run = "cd devglobe-core && npm install && npm run build",
  config = function() require("devglobe").setup() end,
}
```

### vim-plug

```vim
Plug 'Nako0/devglobe-extension', { 'rtp': 'neovim-plugin', 'do': 'cd devglobe-core && npm install && npm run build' }
lua require("devglobe").setup()
```

devglobe-core is built automatically on install and update. Requires Node.js 18+.

## Setup

```vim
:DevGlobe setup YOUR_API_KEY
```

Or manually:

**macOS / Linux:**

```bash
mkdir -p ~/.devglobe
cat > ~/.devglobe/config.toml <<'EOF'
api_key = "YOUR_API_KEY"
EOF
```

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.devglobe"
@'
api_key = "YOUR_API_KEY"
'@ | Out-File -Encoding utf8 "$env:USERPROFILE\.devglobe\config.toml"
```

Visibility settings (anonymous mode, repo sharing, profile mode) are managed on [devglobe.xyz/dashboard/settings](https://devglobe.xyz/dashboard/settings).

## Commands

| Command | Description |
|---------|-------------|
| `:DevGlobe setup KEY` | Configure your API key |
| `:DevGlobe status MSG` | Set your status message |
| `:DevGlobe today` | Show your coding time today |
| `:DevGlobe open` | Open devglobe.xyz in your browser |

## Configuration

```lua
require("devglobe").setup({
  node_path = "node",     -- Path to Node.js binary
  auto_start = true,      -- Start tracking when NeoVim opens
})
```

## Lualine Integration

Add `"devglobe"` to your lualine sections:

```lua
require("lualine").setup({
  sections = {
    lualine_x = { "devglobe", "encoding", "fileformat", "filetype" },
  },
})
```

Displays: `2h 15m — TypeScript`

## Health Check

```vim
:checkhealth devglobe
```

Verifies Node.js, devglobe-core, API key, and daemon status.

## How it Works

The plugin spawns a `devglobe-core` daemon process that handles heartbeats, git detection, and offline recovery. NeoVim communicates with the daemon via JSONL over stdin/stdout. Activity is detected through NeoVim autocommands (`BufEnter`, `TextChanged`, `BufWritePost`).

Heartbeats are sent every 30 seconds while you're actively coding. After 1 minute of inactivity, heartbeats pause automatically.

## Privacy

The plugin sends programming language, editor name, OS, coding time, the origin remote URL of your current git repo (when present), branch name, and the file path **relative to your repo root** — never an absolute home path.

Files outside any git repository are not tracked beyond their language. We never read source code, file contents, keystrokes, or commit messages.

Local privacy flags can be toggled in `~/.devglobe/config.toml` under `[privacy]`: `hide_file_names`, `hide_branch_names`, `hide_project_names` (the project flag also hides branches).

Globe-side visibility (anonymous mode, repo sharing on the live globe, profile mode) is managed on [devglobe.xyz/dashboard/settings](https://devglobe.xyz/dashboard/settings).

See [PRIVACY.md](../PRIVACY.md) for full details.
