using System;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Task = System.Threading.Tasks.Task;

namespace DevGlobe.Commands
{
    /// <summary>Shows today's coding time.</summary>
    internal static class ShowCodingTimeCommand
    {
        private static Func<CoreClient> _coreClientProvider;
        private static AsyncPackage _package;

        public static async Task InitializeAsync(AsyncPackage package, Func<CoreClient> coreClientProvider)
        {
            _package = package ?? throw new ArgumentNullException(nameof(package));
            _coreClientProvider = coreClientProvider ?? throw new ArgumentNullException(nameof(coreClientProvider));

            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);
            var commandService = (OleMenuCommandService)
                await package.GetServiceAsync(typeof(System.ComponentModel.Design.IMenuCommandService));
            if (commandService == null)
            {
                Log.Error("ShowCodingTimeCommand: IMenuCommandService unavailable");
                return;
            }

            var commandId = new System.ComponentModel.Design.CommandID(
                CommandIds.GuidDevGlobeCmdSet, CommandIds.ShowCodingTimeCommandId);
            commandService.AddCommand(new OleMenuCommand(Execute, commandId));
        }

        private static void Execute(object sender, EventArgs e)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            try
            {
                var client = _coreClientProvider();
                var codingTime = client != null ? client.GetState().CodingTime : "0m";
                if (string.IsNullOrEmpty(codingTime))
                {
                    codingTime = "0m";
                }

                VsShellUtilities.ShowMessageBox(
                    _package,
                    $"DevGlobe: {codingTime} today",
                    "DevGlobe",
                    OLEMSGICON.OLEMSGICON_INFO,
                    OLEMSGBUTTON.OLEMSGBUTTON_OK,
                    OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);
            }
            catch (Exception ex)
            {
                Log.Error("command showCodingTime failed", new { error = ex.Message });
            }
        }
    }
}
