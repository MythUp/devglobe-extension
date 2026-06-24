using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Task = System.Threading.Tasks.Task;

namespace DevGlobe.Commands
{
    /// <summary>Opens the log file.</summary>
    internal static class OpenLogFileCommand
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
                Log.Error("OpenLogFileCommand: IMenuCommandService unavailable");
                return;
            }

            var commandId = new System.ComponentModel.Design.CommandID(
                CommandIds.GuidDevGlobeCmdSet, CommandIds.OpenLogFileCommandId);
            commandService.AddCommand(new OleMenuCommand(Execute, commandId));
        }

        private static void Execute(object sender, EventArgs e)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            try
            {
                var path = DevGlobeConfig.LogPath;
                if (!File.Exists(path))
                {
                    VsShellUtilities.ShowMessageBox(
                        _package,
                        "DevGlobe: log file is empty. Enable debug first (DevGlobe → Debug → Yes).",
                        "DevGlobe",
                        OLEMSGICON.OLEMSGICON_INFO,
                        OLEMSGBUTTON.OLEMSGBUTTON_OK,
                        OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);
                    return;
                }

                OpenInEditor(path);
                Log.Info("command openLogFile", new { path });
            }
            catch (Exception ex)
            {
                Log.Error("command openLogFile failed", new { error = ex.Message });
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
                // Fall back to the external shell handler if the in-IDE open fails.
                Log.Warn("openLogFile: in-IDE open failed, falling back to shell", new { error = ex.Message });
                System.Diagnostics.Process.Start(
                    new System.Diagnostics.ProcessStartInfo(path) { UseShellExecute = true });
            }
        }
    }
}
