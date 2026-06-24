using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Shell;

namespace DevGlobe.ToolWindow
{
    /// <summary>
    /// DevGlobe tool window hosting the WPF control that toggles between Login and Dashboard.
    /// Registered via [ProvideToolWindow] and instantiated by the VS shell (hence the
    /// parameterless constructor). The control binds itself to <see cref="DevGlobeShell"/>,
    /// so it stays functional even when VS recreates the window without going through the package.
    /// </summary>
    [Guid(WindowGuidString)]
    public sealed class DevGlobeToolWindow : ToolWindowPane
    {
        // Stable GUID (contract). Must match the value used in the package and .vsct.
        public const string WindowGuidString = "6a4b0d3f-8c25-4f9b-ae7a-2b3c4d5e6f70";

        /// <summary>Parameterless constructor required by the VS shell.</summary>
        public DevGlobeToolWindow() : base(null)
        {
            Caption = "DevGlobe";
            Content = new DevGlobeToolWindowControl();
        }
    }
}
