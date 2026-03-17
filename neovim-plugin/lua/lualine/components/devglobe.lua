local lualine_require = require("lualine_require")
local M = lualine_require.require("lualine.component"):extend()

function M:init(options)
  M.super.init(self, options)
end

function M:update_status()
  local ok, devglobe = pcall(require, "devglobe")
  if not ok then return "" end
  return devglobe.statusline()
end

return M
