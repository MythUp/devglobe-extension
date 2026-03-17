local config = require("devglobe.config")
local daemon = require("devglobe.daemon")

local M = {}

local started = false

function M.setup(opts)
  config.setup(opts)
  if config.options.auto_start and config.read_api_key() then
    M.start()
  end
end

function M.start()
  if started then return end
  daemon.start()
  daemon.send_resume()
  started = true
end

function M.stop()
  daemon.send_pause()
end

function M.shutdown()
  daemon.stop()
  started = false
end

function M.activity(buf, file)
  if not started then
    if config.read_api_key() then
      M.start()
    else
      return
    end
  end

  local path = file
  if not path or path == "" then
    path = vim.api.nvim_buf_get_name(buf)
  end
  if not path or path == "" then return end

  local ft = vim.bo[buf].filetype
  if not ft or ft == "" then return end

  local language = ft:sub(1, 1):upper() .. ft:sub(2)

  local cwd = vim.fn.fnamemodify(path, ":h")
  daemon.send_activity(path, cwd, language)
end

function M.command(args)
  local sub = args[1]

  if sub == "setup" then
    local key = args[2]
    if not key or not key:match("^devglobe_") then
      vim.notify("[DevGlobe] Usage: :DevGlobe setup devglobe_YOUR_KEY", vim.log.levels.WARN)
      return
    end
    vim.fn.mkdir(config.config_dir(), "p")
    vim.fn.writefile({ key }, config.api_key_path())
    local cfg = config.read_config()
    if not cfg.shareRepo and not cfg.anonymousMode then
      config.write_config({ shareRepo = false, anonymousMode = true })
    end
    vim.notify("[DevGlobe] API key saved. Start coding to appear on the globe!", vim.log.levels.INFO)
    if not started then M.start() end

  elseif sub == "status" then
    local msg = table.concat(args, " ", 2)
    daemon.send_set_status(msg)
    local cfg = config.read_config()
    cfg.statusMessage = msg
    config.write_config(cfg)
    vim.notify(msg ~= "" and ("[DevGlobe] Status: " .. msg) or "[DevGlobe] Status cleared", vim.log.levels.INFO)

  elseif sub == "anonymous" then
    local cfg = config.read_config()
    cfg.anonymousMode = not cfg.anonymousMode
    config.write_config(cfg)
    daemon.send_set_config(nil, cfg.anonymousMode)
    vim.notify("[DevGlobe] Anonymous mode " .. (cfg.anonymousMode and "enabled" or "disabled"), vim.log.levels.INFO)

  elseif sub == "share-repo" then
    local cfg = config.read_config()
    cfg.shareRepo = not cfg.shareRepo
    config.write_config(cfg)
    daemon.send_set_config(cfg.shareRepo, nil)
    vim.notify("[DevGlobe] Repo sharing " .. (cfg.shareRepo and "enabled" or "disabled"), vim.log.levels.INFO)

  elseif sub == "today" then
    local s = daemon.get_state()
    local lang = (s.language and s.language ~= vim.NIL) and (" — " .. s.language) or ""
    vim.notify("[DevGlobe] " .. s.coding_time .. " today" .. lang, vim.log.levels.INFO)

  elseif sub == "open" then
    local cmd = vim.fn.has("mac") == 1 and "open" or (vim.fn.has("win32") == 1 and "start" or "xdg-open")
    vim.fn.system({ cmd, "https://devglobe.xyz/explore" })

  else
    vim.notify(table.concat({
      "[DevGlobe] Commands:",
      "  :DevGlobe setup KEY      — Connect with your API key",
      "  :DevGlobe status MSG     — Set status message",
      "  :DevGlobe anonymous      — Toggle anonymous mode",
      "  :DevGlobe share-repo     — Toggle repo sharing",
      "  :DevGlobe today          — Show coding time",
      "  :DevGlobe open           — Open devglobe.xyz",
    }, "\n"), vim.log.levels.INFO)
  end
end

function M.statusline()
  local s = daemon.get_state()
  if not s.tracking then return "" end
  local lang = s.language and (" — " .. s.language) or ""
  return s.coding_time .. lang
  end

return M
