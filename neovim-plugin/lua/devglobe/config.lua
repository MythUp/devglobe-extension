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

function M.api_key_path()
  return M.config_dir() .. "/api_key"
end

function M.config_path()
  return M.config_dir() .. "/config.json"
end

function M.read_api_key()
  local env = os.getenv("DEVGLOBE_API_KEY")
  if env and env ~= "" then return vim.trim(env) end

  local path = M.api_key_path()
  if vim.fn.filereadable(path) == 1 then
    local lines = vim.fn.readfile(path)
    if #lines > 0 then return vim.trim(lines[1]) end
  end
  return nil
end

function M.read_config()
  local path = M.config_path()
  if vim.fn.filereadable(path) == 0 then return {} end
  local ok, data = pcall(vim.fn.json_decode, table.concat(vim.fn.readfile(path), "\n"))
  if ok and type(data) == "table" then return data end
  return {}
end

function M.write_config(data)
  vim.fn.mkdir(M.config_dir(), "p")
  vim.fn.writefile({ vim.fn.json_encode(data) }, M.config_path())
end

return M
