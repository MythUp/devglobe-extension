using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Task = System.Threading.Tasks.Task;

namespace DevGlobe.Commands
{
    /// <summary>Opens the config.toml file.</summary>
    internal static class OpenConfigFileCommand
    {
        private static AsyncPackage _package;

        public static async Task InitializeAsync(AsyncPackage package)
        {
            _package = package ?? throw new ArgumentNullException(nameof(package));

            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);
            var commandService = (OleMenuCommandService)
                await package.GetServiceAsync(typeof(System.ComponentModel.Design.IMenuCommandService));
            if (commandService == null)
            {
                Log.Error("OpenConfigFileCommand: IMenuCommandService unavailable");
                return;
            }

            var commandId = new System.ComponentModel.Design.CommandID(
                CommandIds.GuidDevGlobeCmdSet, CommandIds.OpenConfigFileCommandId);
            commandService.AddCommand(new OleMenuCommand(Execute, commandId));
        }

        private static void Execute(object sender, EventArgs e)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            try
            {
                var path = DevGlobeConfig.ConfigPath;
                if (!File.Exists(path))
                {
                    VsShellUtilities.ShowMessageBox(
                        _package,
                        "DevGlobe: no config file yet. Run setup first (open the DevGlobe tool window and connect).",
                        "DevGlobe",
                        OLEMSGICON.OLEMSGICON_WARNING,
                        OLEMSGBUTTON.OLEMSGBUTTON_OK,
                        OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);
                    return;
                }

                OpenInEditor(path);
                Log.Info("command openConfigFile", new { path });
            }
            catch (Exception ex)
            {
                Log.Error("command openConfigFile failed", new { error = ex.Message });
            }
        }

        private static void OpenInEditor(string path)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            try
            {
                VsShellUtilities.OpenDocument(
                    _package, path,
                    VSConstants.LOGVIEWID.Primary_guid,
                    out _, out _, out _);
            }
            catch (Exception ex)
            {
                Log.Warn("openConfigFile: in-IDE open failed, falling back to shell", new { error = ex.Message });
                System.Diagnostics.Process.Start(
                    new System.Diagnostics.ProcessStartInfo(path) { UseShellExecute = true });
            }
        }
    }
}
