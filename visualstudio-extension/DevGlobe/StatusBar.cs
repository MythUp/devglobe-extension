using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;

namespace DevGlobe
{
    /// <summary>
    /// Shows today's coding time in the VS status bar via IVsStatusbar.
    /// </summary>
    public sealed class DevGlobeStatusBar
    {
        private readonly IVsStatusbar _statusbar;

        public DevGlobeStatusBar(IVsStatusbar statusbar)
        {
            _statusbar = statusbar;
        }

        /// <summary>Displays "⏱ 2h 15m".</summary>
        public void UpdateTime(long todaySeconds)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            string label = "⏱ " + TimeFormat.Format(todaySeconds);

            // Unfreeze the text area in case another component froze it.
            int frozen;
            _statusbar.IsFrozen(out frozen);
            if (frozen != 0)
            {
                _statusbar.FreezeOutput(0);
            }

            _statusbar.SetText(label);
        }

        /// <summary>Clears the status bar text.</summary>
        public void Hide()
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            int frozen;
            _statusbar.IsFrozen(out frozen);
            if (frozen != 0)
            {
                _statusbar.FreezeOutput(0);
            }

            _statusbar.Clear();
        }
    }
}
