using System;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Shell;
using Task = System.Threading.Tasks.Task;

namespace DevGlobe.Commands
{
    /// <summary>
    /// CommandSet GUID and command IDs shared between the .vsct and the handlers.
    /// Values must match the IDSymbol entries in DevGlobePackage.Commands.vsct exactly.
    /// </summary>
    internal static class CommandIds
    {
        public const string GuidDevGlobeCmdSetString = "7b5c1e40-9d36-40ac-bf8b-3c4d5e6f7081";
        public static readonly Guid GuidDevGlobeCmdSet = new Guid(GuidDevGlobeCmdSetString);

        public const int SetStatusCommandId      = 0x0101;
        public const int ShowCodingTimeCommandId = 0x0102;
        public const int OpenGlobeCommandId      = 0x0103;
        public const int ToggleDebugCommandId    = 0x0104;
        public const int OpenLogFileCommandId    = 0x0105;
        public const int OpenConfigFileCommandId = 0x0106;
        public const int OpenToolWindowCommandId = 0x0107;
    }

    /// <summary>
    /// Initializes all DevGlobe commands. Called once from DevGlobePackage.InitializeAsync.
    /// </summary>
    internal static class DevGlobeCommands
    {
        public static async Task InitializeAllAsync(AsyncPackage package, Func<CoreClient> coreClientProvider)
        {
            if (package == null) throw new ArgumentNullException(nameof(package));
            if (coreClientProvider == null) throw new ArgumentNullException(nameof(coreClientProvider));

            await SetStatusCommand.InitializeAsync(package, coreClientProvider);
            await ShowCodingTimeCommand.InitializeAsync(package, coreClientProvider);
            await OpenGlobeCommand.InitializeAsync(package);
            await ToggleDebugCommand.InitializeAsync(package);
            await OpenLogFileCommand.InitializeAsync(package);
            await OpenConfigFileCommand.InitializeAsync(package);
            await OpenToolWindowCommand.InitializeAsync(package);

            Log.Info("DevGlobe commands initialized", new { count = 7 });
        }
    }
}
