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
  subdir = "neovim-plugin",
  event = "BufEnter",
  build = "cd devglobe-core && npm install && npm run build",
  opts = {},
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
:DevGlobe setup devglobe_YOUR_KEY_HERE
```

Or manually:

**macOS / Linux:**

```bash
mkdir -p ~/.devglobe
echo -n "devglobe_YOUR_KEY_HERE" > ~/.devglobe/api_key
echo '{"shareRepo": false, "anonymousMode": true}' > ~/.devglobe/config.json
```

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.devglobe"
"devglobe_YOUR_KEY_HERE" | Out-File -NoNewline "$env:USERPROFILE\.devglobe\api_key"
'{"shareRepo": false, "anonymousMode": true}' | Out-File "$env:USERPROFILE\.devglobe\config.json"
```

## Commands

| Command | Description |
|---------|-------------|
| `:DevGlobe setup KEY` | Configure your API key |
| `:DevGlobe status MSG` | Set your status message |
| `:DevGlobe anonymous` | Toggle anonymous mode |
| `:DevGlobe share-repo` | Toggle repo sharing |
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

The plugin spawns a `devglobe-core` daemon process that handles heartbeats, geolocation, git detection, and offline recovery. NeoVim communicates with the daemon via JSONL over stdin/stdout. Activity is detected through NeoVim autocommands (`BufEnter`, `TextChanged`, `BufWritePost`).

Heartbeats are sent every 30 seconds while you're actively coding. After 1 minute of inactivity, heartbeats pause automatically.

## Privacy

No source code, file contents, or keystrokes are sent. Only language name, city-level location, and editor name. See [PRIVACY.md](../PRIVACY.md).
