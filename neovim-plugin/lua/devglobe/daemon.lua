local config = require("devglobe.config")

local M = {}

local state = {
  handle = nil,
  stdin = nil,
  stdout = nil,
  stderr = nil,
  connected = false,
  tracking = false,
  coding_time = "0m",
  language = nil,
  share_repo = false,
  anonymous_mode = false,
  status_message = "",
  offline = false,
  on_state_change = nil,
}

function M.get_state()
  return {
    connected = state.connected,
    tracking = state.tracking,
    coding_time = state.coding_time,
    language = state.language,
    share_repo = state.share_repo,
    anonymous_mode = state.anonymous_mode,
    status_message = state.status_message,
    offline = state.offline,
  }
end

function M.on_state_change(fn)
  state.on_state_change = fn
end

local function core_path()
  local source = debug.getinfo(1, "S").source:sub(2)
  local plugin_root = vim.fn.fnamemodify(source, ":h:h:h:h")
  return plugin_root .. "/devglobe-core/dist/devglobe-core.js"
end

local function handle_message(raw)
  local ok, msg = pcall(vim.fn.json_decode, raw)
  if not ok or type(msg) ~= "table" then return end

  if msg.event == "state" and type(msg.data) == "table" then
    local d = msg.data
    state.connected = d.connected or false
    state.tracking = d.tracking or false
    state.coding_time = d.coding_time or "0m"
    state.language = d.language
    state.share_repo = d.share_repo or false
    state.anonymous_mode = d.anonymous_mode or false
    state.status_message = d.status_message or ""
    state.offline = d.offline or false
    if state.on_state_change then state.on_state_change(M.get_state()) end
  elseif msg.event == "heartbeat_ok" and type(msg.data) == "table" then
    local secs = msg.data.today_seconds or 0
    local h = math.floor(secs / 3600)
    local m = math.floor((secs % 3600) / 60)
    state.coding_time = h > 0 and string.format("%dh %dm", h, m) or string.format("%dm", m)
    state.language = msg.data.language
    if state.on_state_change then state.on_state_change(M.get_state()) end
  elseif msg.event == "offline" then
    state.offline = true
    vim.schedule(function() vim.notify("[DevGlobe] Offline", vim.log.levels.WARN) end)
  elseif msg.event == "online" then
    state.offline = false
    vim.schedule(function() vim.notify("[DevGlobe] Back online", vim.log.levels.INFO) end)
  end
end

local function send(message)
  if state.stdin then
    state.stdin:write(vim.fn.json_encode(message) .. "\n")
  end
end

function M.start()
  if state.handle then return end

  local node = config.options.node_path or "node"
  local script = core_path()

  if vim.fn.filereadable(script) == 0 then
    vim.notify("[DevGlobe] devglobe-core not found. Run: cd devglobe-core && npm run build", vim.log.levels.ERROR)
    return
  end

  local stdin = vim.uv.new_pipe(false)
  local stdout = vim.uv.new_pipe(false)
  local stderr = vim.uv.new_pipe(false)

  local handle, pid = vim.uv.spawn(node, {
    args = { "--", script, "daemon" },
    stdio = { stdin, stdout, stderr },
    detached = false,
  }, function(code)
    vim.schedule(function()
      state.handle = nil
      state.stdin = nil
      state.connected = false
      state.tracking = false
      if code ~= 0 then
        vim.notify("[DevGlobe] Daemon exited with code " .. code, vim.log.levels.WARN)
      end
      stdin:close()
      stdout:close()
      stderr:close()
    end)
  end)

  if not handle then
    vim.notify("[DevGlobe] Failed to start daemon. Is Node.js installed?", vim.log.levels.ERROR)
    stdin:close()
    stdout:close()
    stderr:close()
    return
  end

  state.handle = handle
  state.stdin = stdin
  state.stdout = stdout
  state.stderr = stderr

  local buf = ""
  stdout:read_start(function(err, data)
    if err or not data then return end
    buf = buf .. data
    while true do
      local nl = buf:find("\n")
      if not nl then break end
      local line = buf:sub(1, nl - 1)
      buf = buf:sub(nl + 1)
      vim.schedule(function() handle_message(line) end)
    end
  end)

  local api_key = config.read_api_key()
  if api_key then
    local cfg = config.read_config()
    send({
      method = "init",
      params = {
        api_key = api_key,
        editor = "neovim",
        share_repo = cfg.shareRepo or false,
        anonymous_mode = cfg.anonymousMode ~= false,
        status_message = cfg.statusMessage or "",
      },
    })
  end
end

function M.stop()
  if not state.handle then return end
  send({ method = "shutdown" })
  state.handle:kill("sigterm")
  state.handle = nil
  state.stdin = nil
  state.connected = false
  state.tracking = false
end

function M.is_running()
  return state.handle ~= nil
end

function M.send_activity(file_path, cwd, language)
  if not state.handle then return end
  send({
    method = "activity",
    params = {
      file_path = file_path,
      cwd = cwd,
      language = language,
    },
  })
end

function M.send_resume()
  if not state.handle then return end
  send({ method = "resume" })
end

function M.send_pause()
  if not state.handle then return end
  send({ method = "pause" })
end

function M.send_set_config(share_repo, anonymous_mode)
  if not state.handle then return end
  local params = {}
  if share_repo ~= nil then params.share_repo = share_repo end
  if anonymous_mode ~= nil then params.anonymous_mode = anonymous_mode end
  send({ method = "set_config", params = params })
end

function M.send_set_status(message)
  if not state.handle then return end
  send({ method = "set_status", params = { message = message } })
end

return M
