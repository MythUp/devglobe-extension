if vim.g.loaded_devglobe then
  return
end
vim.g.loaded_devglobe = true

vim.api.nvim_create_user_command("DevGlobe", function(opts)
  require("devglobe").command(opts.fargs)
end, {
  nargs = "*",
  complete = function()
    return { "setup", "status", "today", "open", "debug", "log", "config" }
  end,
  desc = "DevGlobe activity tracker",
})

local group = vim.api.nvim_create_augroup("DevGlobe", { clear = true })

vim.api.nvim_create_autocmd("BufEnter", {
  group = group,
  callback = function(ev)
    require("devglobe").activity(ev.buf, ev.file)
  end,
})

vim.api.nvim_create_autocmd({ "TextChanged", "TextChangedI" }, {
  group = group,
  callback = function(ev)
    require("devglobe").activity(ev.buf)
  end,
})

vim.api.nvim_create_autocmd("BufWritePost", {
  group = group,
  callback = function(ev)
    require("devglobe").activity(ev.buf, ev.file)
  end,
})

vim.api.nvim_create_autocmd("VimLeavePre", {
  group = group,
  callback = function()
    require("devglobe").shutdown()
  end,
})
