local M = {}

local defaults = {
  node_path = "node",
  auto_start = true,
}

M.options = {}

function M.setup(user_opts)
  M.options = vim.tbl_deep_extend("force", {}, defaults, user_opts or {})
end

function M.config_dir()
  local home = vim.uv.os_homedir() or os.getenv("HOME") or os.getenv("USERPROFILE") or ""
  return home .. "/.devglobe"
end

function M.config_path()
  return M.config_dir() .. "/config.toml"
end

function M.log_path()
  return M.config_dir() .. "/devglobe.log"
end

-- Legacy file. The core auto-migrates it to config.toml on first read,
-- but we still consult it for `has_api_key()` so auto-start works after
-- a fresh install before the daemon has had a chance to migrate.
function M.legacy_api_key_path()
  return M.config_dir() .. "/api_key"
end

local function read_api_key_from_toml(path)
  if vim.fn.filereadable(path) == 0 then return nil end
  for _, raw in ipairs(vim.fn.readfile(path)) do
    local line = vim.trim(raw)
    if line:sub(1, 1) == "[" then break end
    local m = line:match('^api_key%s*=%s*"([^"]+)"')
    if m and m ~= "" then return m end
  end
  return nil
end

local function read_legacy_api_key()
  local path = M.legacy_api_key_path()
  if vim.fn.filereadable(path) == 0 then return nil end
  local lines = vim.fn.readfile(path)
  if #lines == 0 then return nil end
  local key = vim.trim(lines[1])
  return key ~= "" and key or nil
end

function M.has_api_key()
  if (os.getenv("DEVGLOBE_API_KEY") or "") ~= "" then return true end
  return read_api_key_from_toml(M.config_path()) ~= nil
      or read_legacy_api_key() ~= nil
end

function M.set_api_key(key)
  vim.fn.mkdir(M.config_dir(), "p")
  local path = M.config_path()
  local lines = vim.fn.filereadable(path) == 1 and vim.fn.readfile(path) or {}
  local replaced = false
  for i, raw in ipairs(lines) do
    local trimmed = vim.trim(raw)
    if trimmed:sub(1, 1) == "[" then break end
    if trimmed:match("^api_key") then
      lines[i] = string.format('api_key = "%s"', key)
      replaced = true
      break
    end
  end
  if not replaced then
    table.insert(lines, 1, string.format('api_key = "%s"', key))
  end
  vim.fn.writefile(lines, path)
  pcall(vim.uv.fs_chmod, path, 384) -- 0600
end

function M.is_debug_enabled()
  local path = M.config_path()
  if vim.fn.filereadable(path) == 0 then return false end
  for _, raw in ipairs(vim.fn.readfile(path)) do
    local line = vim.trim(raw)
    if line:sub(1, 1) == "[" then return false end
    local m = line:match("^debug%s*=%s*(%w+)")
    if m then return m == "true" end
  end
  return false
end

function M.set_debug(enabled)
  vim.fn.mkdir(M.config_dir(), "p")
  local path = M.config_path()
  local lines = vim.fn.filereadable(path) == 1 and vim.fn.readfile(path) or {}
  local existing_idx = -1
  local section_start = #lines + 1
  for i, raw in ipairs(lines) do
    local trimmed = vim.trim(raw)
    if trimmed:sub(1, 1) == "[" then section_start = i; break end
    if trimmed:match("^debug") then existing_idx = i; break end
  end

  if existing_idx > 0 then
    if enabled then lines[existing_idx] = "debug = true"
    else table.remove(lines, existing_idx) end
  elseif enabled then
    -- Insert just after api_key when present, else at the very top.
    local insert_at = 1
    for i = 1, section_start - 1 do
      if vim.trim(lines[i]):match("^api_key") then insert_at = i + 1; break end
    end
    table.insert(lines, insert_at, "debug = true")
  end

  vim.fn.writefile(lines, path)
  pcall(vim.uv.fs_chmod, path, 384) -- 0600
end

return M
