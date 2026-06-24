using System;
using System.ComponentModel.Design;
using System.Threading.Tasks;
using DevGlobe.ToolWindow;
using Microsoft.VisualStudio.Shell;
using Task = System.Threading.Tasks.Task;

namespace DevGlobe.Commands
{
    /// <summary>
    /// Opens (or reopens) the DevGlobe tool window, loading the package on first use if needed.
    /// </summary>
    internal static class OpenToolWindowCommand
    {
        public static async Task InitializeAsync(AsyncPackage package)
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            if (await package.GetServiceAsync(typeof(IMenuCommandService)) is OleMenuCommandService svc)
            {
                var id = new CommandID(CommandIds.GuidDevGlobeCmdSet, CommandIds.OpenToolWindowCommandId);
                svc.AddCommand(new MenuCommand((s, e) => Execute(package), id));
            }
        }

        private static void Execute(AsyncPackage package)
        {
            _ = package.JoinableTaskFactory.RunAsync(async () =>
            {
                await package.JoinableTaskFactory.SwitchToMainThreadAsync();
                await package.ShowToolWindowAsync(
                    typeof(DevGlobeToolWindow), id: 0, create: true, cancellationToken: package.DisposalToken);
            });
        }
    }
}
