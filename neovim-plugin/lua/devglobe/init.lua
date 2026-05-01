local config = require("devglobe.config")
local daemon = require("devglobe.daemon")

local M = {}

local started = false

function M.setup(opts)
  config.setup(opts)
  if config.options.auto_start and config.has_api_key() then
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
    if config.has_api_key() then
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

local function open_in_editor(path, missing_msg)
  if vim.fn.filereadable(path) == 0 then
    vim.notify("[DevGlobe] " .. missing_msg, vim.log.levels.WARN)
    return
  end
  vim.cmd("edit " .. vim.fn.fnameescape(path))
end

function M.command(args)
  local sub = args[1]

  if sub == "setup" then
    local key = args[2]
    if not key then
      vim.notify("[DevGlobe] Usage: :DevGlobe setup YOUR_API_KEY", vim.log.levels.WARN)
      return
    end
    config.set_api_key(key)
    vim.notify("[DevGlobe] API key saved to " .. config.config_path(), vim.log.levels.INFO)
    if not started then M.start() end

  elseif sub == "status" then
    local msg = table.concat(args, " ", 2)
    daemon.send_set_status(msg)
    vim.notify(msg ~= "" and ("[DevGlobe] Status: " .. msg) or "[DevGlobe] Status cleared", vim.log.levels.INFO)

  elseif sub == "today" then
    local s = daemon.get_state()
    local lang = (s.language and s.language ~= vim.NIL) and (" — " .. s.language) or ""
    vim.notify("[DevGlobe] " .. s.coding_time .. " today" .. lang, vim.log.levels.INFO)

  elseif sub == "open" then
    local cmd = vim.fn.has("mac") == 1 and "open" or (vim.fn.has("win32") == 1 and "start" or "xdg-open")
    vim.fn.system({ cmd, "https://devglobe.xyz/space" })

  elseif sub == "debug" then
    local choice = args[2]
    if choice ~= "true" and choice ~= "false" then
      local current = config.is_debug_enabled()
      vim.notify(string.format(
        "[DevGlobe] debug is %s. Use :DevGlobe debug true|false",
        current and "enabled" or "disabled"
      ), vim.log.levels.INFO)
      return
    end
    config.set_debug(choice == "true")
    vim.notify(string.format(
      "[DevGlobe] debug %s. Restart Neovim to apply.",
      choice == "true" and "enabled" or "disabled"
    ), vim.log.levels.INFO)

  elseif sub == "log" then
    open_in_editor(config.log_path(), "log file is empty. Enable debug first (:DevGlobe debug true).")

  elseif sub == "config" then
    open_in_editor(config.config_path(), "no config file yet. Run :DevGlobe setup first.")

  else
    vim.notify(table.concat({
      "[DevGlobe] Commands:",
      "  :DevGlobe setup KEY      — Connect with your API key",
      "  :DevGlobe status MSG     — Set status message",
      "  :DevGlobe today          — Show coding time today",
      "  :DevGlobe open           — Open the globe at devglobe.xyz/space",
      "  :DevGlobe debug true|false — Toggle debug logging",
      "  :DevGlobe log            — Open ~/.devglobe/devglobe.log",
      "  :DevGlobe config         — Open ~/.devglobe/config.toml",
      "",
      "  Visibility settings (anonymous, share-repo, profile mode) are managed at",
      "  https://devglobe.xyz/dashboard/settings",
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
