using System;
using System.Diagnostics;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Shell;
using Task = System.Threading.Tasks.Task;

namespace DevGlobe.Commands
{
    /// <summary>Opens the globe in the default browser.</summary>
    internal static class OpenGlobeCommand
    {
        private const string GlobeUrl = "https://devglobe.app/space";

        public static async Task InitializeAsync(AsyncPackage package)
        {
            if (package == null) throw new ArgumentNullException(nameof(package));

            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);
            var commandService = (OleMenuCommandService)
                await package.GetServiceAsync(typeof(System.ComponentModel.Design.IMenuCommandService));
            if (commandService == null)
            {
                Log.Error("OpenGlobeCommand: IMenuCommandService unavailable");
                return;
            }

            var commandId = new System.ComponentModel.Design.CommandID(
                CommandIds.GuidDevGlobeCmdSet, CommandIds.OpenGlobeCommandId);
            commandService.AddCommand(new OleMenuCommand(Execute, commandId));
        }

        private static void Execute(object sender, EventArgs e)
        {
            try
            {
                Process.Start(new ProcessStartInfo(GlobeUrl) { UseShellExecute = true });
                Log.Info("command openGlobe", new { url = GlobeUrl });
            }
            catch (Exception ex)
            {
                Log.Error("command openGlobe failed", new { error = ex.Message });
            }
        }
    }
}
