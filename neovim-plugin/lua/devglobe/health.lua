local M = {}

function M.check()
  vim.health.start("DevGlobe")

  if vim.fn.has("nvim-0.9") == 1 then
    vim.health.ok("NeoVim " .. tostring(vim.version()))
  else
    vim.health.error("NeoVim 0.9+ required")
  end

  local config = require("devglobe.config")
  local node = config.options.node_path or "node"
  if vim.fn.executable(node) == 1 then
    local version = vim.trim(vim.fn.system({ node, "--version" }))
    vim.health.ok("Node.js found: " .. node .. " (" .. version .. ")")
  else
    vim.health.error("Node.js not found", {
      "Install Node.js 18+: https://nodejs.org",
      "Or set node_path in setup(): require('devglobe').setup({ node_path = '/path/to/node' })",
    })
  end

  local source = debug.getinfo(1, "S").source:sub(2)
  local plugin_root = vim.fn.fnamemodify(source, ":h:h:h:h")
  local core_path = plugin_root .. "/devglobe-core/dist/devglobe-core.js"
  if vim.fn.filereadable(core_path) == 1 then
    vim.health.ok("devglobe-core found")
  else
    vim.health.error("devglobe-core not built", {
      "Run: cd devglobe-core && npm install && npm run build",
    })
  end

  local key = config.read_api_key()
  if key then
    vim.health.ok("API key configured (" .. key:sub(1, 12) .. "...)")
  else
    vim.health.warn("No API key found", {
      "Run :DevGlobe setup devglobe_YOUR_KEY",
      "Or create ~/.devglobe/api_key",
    })
  end

  local daemon = require("devglobe.daemon")
  if daemon.is_running() then
    vim.health.ok("Daemon running")
  else
    vim.health.info("Daemon not started")
  end
end

return M
