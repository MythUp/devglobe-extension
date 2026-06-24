using System;
using System.Windows.Threading;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Imaging;
using Microsoft.VisualStudio.Imaging.Interop;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;

namespace DevGlobe
{
    /// <summary>
    /// User notifications via the native VS info bar (IVsInfoBar). Info notifications auto-dismiss
    /// after a few seconds; warnings and errors stay until closed manually. The invalid-key error
    /// carries a "Get API key" action link.
    /// </summary>
    internal static class DevGlobeNotifications
    {
        private static IServiceProvider _serviceProvider;
        private static IVsInfoBarUIFactory _factory;
        private static IVsInfoBarHost _host;
        private static readonly TimeSpan InfoAutoDismiss = TimeSpan.FromSeconds(5);

        /// <summary>
        /// Call during package initialization. The host is not resolved here because the main window
        /// (and thus its info bar host) does not exist yet at package load; the factory and host are
        /// resolved lazily on first display.
        /// </summary>
        public static void Initialize(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        /// <summary>Resolves and caches the info bar factory and host. Must run on the UI thread.</summary>
        private static bool EnsureHost()
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            if (_serviceProvider == null) return false;

            if (_factory == null)
                _factory = _serviceProvider.GetService(typeof(SVsInfoBarUIFactory)) as IVsInfoBarUIFactory;

            if (_host == null)
            {
                var shell = _serviceProvider.GetService(typeof(SVsShell)) as IVsShell;
                if (shell != null &&
                    ErrorHandler.Succeeded(shell.GetProperty(
                        (int)__VSSPROPID7.VSSPROPID_MainWindowInfoBarHost, out object hostObj)))
                {
                    _host = hostObj as IVsInfoBarHost;
                }
            }

            return _factory != null && _host != null;
        }

        public static void Info(string message)
            => Show(message, KnownMonikers.StatusInformation, autoDismiss: true);

        public static void Warning(string message)
            => Show(message, KnownMonikers.StatusWarning, autoDismiss: false);

        public static void Error(string message)
            => Show(message, KnownMonikers.StatusError, autoDismiss: false);

        /// <summary>Error with an action link (e.g. "Get API key").</summary>
        public static void ErrorWithAction(string message, string actionText, Action onAction)
            => Show(message, KnownMonikers.StatusError, autoDismiss: false, actionText, onAction);

        private static void Show(string message, ImageMoniker icon, bool autoDismiss,
            string actionText = null, Action onAction = null)
        {
            _ = ThreadHelper.JoinableTaskFactory.RunAsync(async () =>
            {
                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                try
                {
                    if (!EnsureHost())
                    {
                        Log.Info("notify (no info bar host)", new { message });
                        return;
                    }

                    InfoBarModel model = actionText != null
                        ? new InfoBarModel(
                            new[] { new InfoBarTextSpan(message) },
                            new[] { new InfoBarHyperlink(actionText) },
                            icon, isCloseButtonVisible: true)
                        : new InfoBarModel(message, icon, isCloseButtonVisible: true);

                    var ui = _factory.CreateInfoBar(model);
                    var sink = new InfoBarEvents(onAction);
                    ui.Advise(sink, out uint cookie);
                    sink.Attach(cookie);
                    _host.AddInfoBar(ui);

                    if (autoDismiss)
                    {
                        var timer = new DispatcherTimer { Interval = InfoAutoDismiss };
                        timer.Tick += (s, e) =>
                        {
                            timer.Stop();
                            try { ui.Close(); } catch { /* already closed */ }
                        };
                        timer.Start();
                    }
                }
                catch (Exception ex)
                {
                    Log.Warn("DevGlobeNotifications: show failed", new { error = ex.Message });
                }
            });
        }

        /// <summary>Info bar event sink: runs the action, then unsubscribes on close.</summary>
        private sealed class InfoBarEvents : IVsInfoBarUIEvents
        {
            private readonly Action _onAction;
            private uint _cookie;

            public InfoBarEvents(Action onAction) => _onAction = onAction;

            public void Attach(uint cookie) => _cookie = cookie;

            public void OnClosed(IVsInfoBarUIElement infoBarUIElement)
            {
                try { infoBarUIElement.Unadvise(_cookie); } catch { /* best-effort */ }
            }

            public void OnActionItemClicked(IVsInfoBarUIElement infoBarUIElement, IVsInfoBarActionItem actionItem)
            {
                try { _onAction?.Invoke(); }
                catch (Exception ex) { Log.Warn("notify action failed", new { error = ex.Message }); }
                try { infoBarUIElement.Close(); } catch { /* best-effort */ }
            }
        }
    }
}
