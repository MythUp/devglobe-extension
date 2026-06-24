using System;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Task = System.Threading.Tasks.Task;

namespace DevGlobe.Commands
{
    /// <summary>Toggles debug mode in config.toml.</summary>
    internal static class ToggleDebugCommand
    {
        // VSConstants.MessageBoxResult.IDYES value, inlined to avoid the dependency.
        private const int IDYES = 6;
        private static AsyncPackage _package;

        public static async Task InitializeAsync(AsyncPackage package)
        {
            _package = package ?? throw new ArgumentNullException(nameof(package));

            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);
            var commandService = (OleMenuCommandService)
                await package.GetServiceAsync(typeof(System.ComponentModel.Design.IMenuCommandService));
            if (commandService == null)
            {
                Log.Error("ToggleDebugCommand: IMenuCommandService unavailable");
                return;
            }

            var commandId = new System.ComponentModel.Design.CommandID(
                CommandIds.GuidDevGlobeCmdSet, CommandIds.ToggleDebugCommandId);
            commandService.AddCommand(new OleMenuCommand(Execute, commandId));
        }

        private static void Execute(object sender, EventArgs e)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            try
            {
                var current = DevGlobeConfig.IsDebugEnabled();

                var result = VsShellUtilities.ShowMessageBox(
                    _package,
                    $"Enable DevGlobe debug logging?\n\nCurrent value: {(current ? "enabled" : "disabled")}.\n" +
                    "Yes = enable, No = disable.",
                    "DevGlobe Debug",
                    OLEMSGICON.OLEMSGICON_QUERY,
                    OLEMSGBUTTON.OLEMSGBUTTON_YESNOCANCEL,
                    OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);

                // Cancel or close: do nothing.
                if (result != IDYES && result != /* IDNO */ 7)
                {
                    return;
                }

                var enabled = result == IDYES;
                DevGlobeConfig.SetDebug(enabled);
                Log.Info("command toggleDebug", new { enabled });

                VsShellUtilities.ShowMessageBox(
                    _package,
                    $"DevGlobe: debug {(enabled ? "enabled" : "disabled")}. Restart tracking to apply.",
                    "DevGlobe",
                    OLEMSGICON.OLEMSGICON_INFO,
                    OLEMSGBUTTON.OLEMSGBUTTON_OK,
                    OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);
            }
            catch (Exception ex)
            {
                Log.Error("command toggleDebug failed", new { error = ex.Message });
            }
        }
    }
}
