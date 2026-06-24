using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Editor;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.TextManager.Interop;
using Task = System.Threading.Tasks.Task;

namespace DevGlobe
{
    /// <summary>
    /// Detects editor activity and forwards it to the core (which debounces). Sources are the
    /// Running Document Table (open/show/save) and ITextBuffer.Changed (keystrokes) of the
    /// active document. Only real on-disk files are forwarded.
    /// </summary>
    public sealed class ActivityTracker : IVsRunningDocTableEvents3, IDisposable
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly CoreClient _coreClient;

        private IVsRunningDocumentTable _rdt;
        private IVsEditorAdaptersFactoryService _adapterFactory;
        private uint _rdtCookie;

        // Buffer of the active document currently watched for keystrokes.
        private ITextBuffer _activeBuffer;
        private bool _disposed;

        public ActivityTracker(IServiceProvider serviceProvider, CoreClient coreClient)
        {
            _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));
            _coreClient = coreClient ?? throw new ArgumentNullException(nameof(coreClient));
        }

        /// <summary>Subscribes to the RDT and captures the current active document. Call on the UI thread.</summary>
        public async Task InitializeAsync(CancellationToken ct)
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(ct);

            _rdt = _serviceProvider.GetService(typeof(SVsRunningDocumentTable)) as IVsRunningDocumentTable;
            if (_rdt == null)
            {
                Log.Error("ActivityTracker: SVsRunningDocumentTable unavailable");
                return;
            }

            // IVsEditorAdaptersFactoryService is a MEF export from the editor component.
            var componentModel = _serviceProvider.GetService(typeof(SComponentModel))
                as Microsoft.VisualStudio.ComponentModelHost.IComponentModel;
            _adapterFactory = componentModel?.GetService<IVsEditorAdaptersFactoryService>();
            if (_adapterFactory == null)
            {
                Log.Warn("ActivityTracker: IVsEditorAdaptersFactoryService unavailable; keystroke tracking disabled");
            }

            int hr = _rdt.AdviseRunningDocTableEvents(this, out _rdtCookie);
            ErrorHandler.ThrowOnFailure(hr);
            Log.Info("ActivityTracker: subscribed to RDT", new { cookie = _rdtCookie });

            // Capture the document already active at startup.
            TrackActiveDocument();
        }

        // ---- IVsRunningDocTableEvents3 ----

        // Document opened or active tab changed.
        public int OnBeforeDocumentWindowShow(uint docCookie, int fFirstShow, IVsWindowFrame pFrame)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            HandleDocumentEvent(docCookie);
            SubscribeToBuffer(docCookie);
            return VSConstants.S_OK;
        }

        // Document saved.
        public int OnAfterSave(uint docCookie)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            HandleDocumentEvent(docCookie);
            return VSConstants.S_OK;
        }

        // Rename or attribute change: the moniker may change, so re-forward.
        public int OnAfterAttributeChangeEx(
            uint docCookie,
            uint grfAttribs,
            IVsHierarchy pHierOld, uint itemidOld, string pszMkDocumentOld,
            IVsHierarchy pHierNew, uint itemidNew, string pszMkDocumentNew)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            if ((grfAttribs & (uint)__VSRDTATTRIB.RDTA_MkDocument) != 0)
            {
                HandleDocumentEvent(docCookie);
            }
            return VSConstants.S_OK;
        }

        // Unused RDT events.
        public int OnAfterFirstDocumentLock(uint docCookie, uint dwRDTLockType, uint dwReadLocksRemaining, uint dwEditLocksRemaining)
            => VSConstants.S_OK;
        public int OnBeforeLastDocumentUnlock(uint docCookie, uint dwRDTLockType, uint dwReadLocksRemaining, uint dwEditLocksRemaining)
            => VSConstants.S_OK;
        public int OnAfterAttributeChange(uint docCookie, uint grfAttribs)
            => VSConstants.S_OK;
        public int OnAfterDocumentWindowHide(uint docCookie, IVsWindowFrame pFrame)
            => VSConstants.S_OK;
        public int OnBeforeSave(uint docCookie)
            => VSConstants.S_OK;

        /// <summary>
        /// Forwards activity for an RDT document (open/show/save). Filters out non-files.
        /// Language is derived from the buffer content-type if available, otherwise the extension.
        /// </summary>
        private void HandleDocumentEvent(uint docCookie)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            try
            {
                string moniker = GetMoniker(docCookie);
                if (!IsRealFile(moniker)) return;

                ITextBuffer buffer = GetBufferForCookie(docCookie);
                ReportActivity(moniker, buffer);
            }
            catch (Exception ex)
            {
                Log.Warn("ActivityTracker: HandleDocumentEvent failed", new { error = ex.Message });
            }
        }

        /// <summary>
        /// Forwards an activity to the core. Language comes from the content-type when a buffer
        /// is available, otherwise from the file extension. The core debounces, so forward all.
        /// </summary>
        private void ReportActivity(string filePath, ITextBuffer buffer)
        {
            if (!IsRealFile(filePath)) return;

            string languageKey = buffer != null
                ? buffer.ContentType?.TypeName
                : Path.GetExtension(filePath);

            string language = string.IsNullOrEmpty(languageKey)
                ? null
                : LanguageMap.Map(languageKey);

            _coreClient.Activity(filePath, language);
        }

        /// <summary>Returns true only for real on-disk files; non-file monikers are rejected.</summary>
        private static bool IsRealFile(string moniker)
        {
            if (string.IsNullOrWhiteSpace(moniker)) return false;
            // Non-file monikers are URIs/pseudo-paths (e.g. "ext://", "Solution.sln") or are not
            // rooted absolute paths. Require a plausible absolute path.
            try
            {
                if (moniker.IndexOfAny(Path.GetInvalidPathChars()) >= 0) return false;
                if (!Path.IsPathRooted(moniker)) return false;
                // No URI scheme (file:// is already resolved to a path by the RDT; reject the rest).
                if (moniker.Contains("://")) return false;
                return true;
            }
            catch
            {
                return false;
            }
        }

        private string GetMoniker(uint docCookie)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            if (_rdt == null) return null;

            int hr = _rdt.GetDocumentInfo(
                docCookie,
                out _, out _, out _,
                out string moniker,
                out _, out _, out _);
            return ErrorHandler.Succeeded(hr) ? moniker : null;
        }

        /// <summary>
        /// Resolves the ITextBuffer for an RDT cookie via its IVsTextLines docData. Returns null
        /// when the document is not a text editor (designer, etc.).
        /// </summary>
        private ITextBuffer GetBufferForCookie(uint docCookie)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            if (_rdt == null || _adapterFactory == null) return null;

            int hr = _rdt.GetDocumentInfo(
                docCookie,
                out _, out _, out _,
                out _,
                out _, out _,
                out IntPtr docDataPtr);
            if (ErrorHandler.Failed(hr) || docDataPtr == IntPtr.Zero) return null;

            object docData = null;
            try
            {
                docData = Marshal.GetObjectForIUnknown(docDataPtr);
                if (docData is IVsTextLines textLines)
                {
                    return _adapterFactory.GetDocumentBuffer(textLines);
                }
                if (docData is IVsTextBufferProvider bufferProvider
                    && ErrorHandler.Succeeded(bufferProvider.GetTextBuffer(out IVsTextLines lines))
                    && lines != null)
                {
                    return _adapterFactory.GetDocumentBuffer(lines);
                }
                return null;
            }
            finally
            {
                if (docDataPtr != IntPtr.Zero) Marshal.Release(docDataPtr);
            }
        }

        /// <summary>Captures the active document at startup and subscribes to it.</summary>
        private void TrackActiveDocument()
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            var textManager = _serviceProvider.GetService(typeof(SVsTextManager)) as IVsTextManager;
            if (textManager == null) return;

            int hr = textManager.GetActiveView(1, null, out IVsTextView activeView);
            if (ErrorHandler.Failed(hr) || activeView == null) return;
            if (ErrorHandler.Failed(activeView.GetBuffer(out IVsTextLines lines)) || lines == null) return;
            if (_adapterFactory == null) return;

            ITextBuffer buffer = _adapterFactory.GetDocumentBuffer(lines);
            if (buffer == null) return;

            SetActiveBuffer(buffer);

            // Forward an initial activity for the already-open document.
            if (buffer.Properties.TryGetProperty(typeof(ITextDocument), out ITextDocument textDoc)
                && textDoc != null)
            {
                ReportActivity(textDoc.FilePath, buffer);
            }
        }

        /// <summary>Switches keystroke tracking to the ITextBuffer.Changed of the document for this cookie.</summary>
        private void SubscribeToBuffer(uint docCookie)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            ITextBuffer buffer = GetBufferForCookie(docCookie);
            if (buffer == null) return;
            SetActiveBuffer(buffer);
        }

        private void SetActiveBuffer(ITextBuffer buffer)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            if (ReferenceEquals(buffer, _activeBuffer)) return;

            if (_activeBuffer != null)
            {
                _activeBuffer.Changed -= OnActiveBufferChanged;
            }

            _activeBuffer = buffer;

            if (_activeBuffer != null)
            {
                _activeBuffer.Changed += OnActiveBufferChanged;
            }
        }

        /// <summary>Keystroke in the active document.</summary>
        private void OnActiveBufferChanged(object sender, TextContentChangedEventArgs e)
        {
            // ITextBuffer.Changed may fire off the UI thread depending on the source; stay defensive.
            try
            {
                if (sender is ITextBuffer buffer
                    && buffer.Properties.TryGetProperty(typeof(ITextDocument), out ITextDocument textDoc)
                    && textDoc != null)
                {
                    ReportActivity(textDoc.FilePath, buffer);
                }
            }
            catch (Exception ex)
            {
                Log.Warn("ActivityTracker: OnActiveBufferChanged failed", new { error = ex.Message });
            }
        }

        // ---- Cleanup ----

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

            try
            {
                ThreadHelper.JoinableTaskFactory.Run(async () =>
                {
                    await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

                    if (_activeBuffer != null)
                    {
                        _activeBuffer.Changed -= OnActiveBufferChanged;
                        _activeBuffer = null;
                    }

                    if (_rdt != null && _rdtCookie != 0)
                    {
                        _rdt.UnadviseRunningDocTableEvents(_rdtCookie);
                        _rdtCookie = 0;
                    }
                });
            }
            catch (Exception ex)
            {
                Log.Warn("ActivityTracker: Dispose failed", new { error = ex.Message });
            }
        }
    }
}
