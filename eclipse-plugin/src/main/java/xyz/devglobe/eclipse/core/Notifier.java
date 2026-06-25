package xyz.devglobe.eclipse.core;

import org.eclipse.jface.action.StatusLineManager;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Shell;
import org.eclipse.ui.IWorkbench;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PlatformUI;

import java.lang.reflect.Method;

/**
 * Shows brief toast-like notifications in the Eclipse status line,
 * mirroring the {@code vscode.window.showInformationMessage()} pattern
 * from the VS Code extension.
 *
 * <p>Eclipse doesn't have a built-in toast popup, so we use the
 * workbench status line which is the closest equivalent — it appears
 * at the bottom of the window and auto-clears after a few seconds.
 * If the status line is unavailable (reflection fails), we fall back
 * to a lightweight {@link MessageDialog}.</p>
 *
 * <p>Uses reflection to access the internal {@code WorkbenchWindow.getStatusLineManager()}
 * method to avoid "discouraged access" compile-time warnings.</p>
 */
public final class Notifier {

    private Notifier() {}

    // ── Public API ───────────────────────────────────────────────────────

    /** Show an informational message in the status line. Empty message clears the status. */
    public static void info(String message) {
        show(Severity.INFO, message, false);
    }

    /** Show a warning message in the status line. Empty message clears the status. */
    public static void warn(String message) {
        show(Severity.WARN, message, false);
    }

    /** Show an error — status line + dialog if the workbench is available. Empty message clears the status. */
    public static void error(String message) {
        show(Severity.ERROR, message, true);
    }

    /**
     * Show a confirmation notification that the user is guaranteed to see.
     * Uses the status line if available, but always falls back to a dialog
     * if the status line cannot be reached.
     */
    public static void confirm(String message) {
        show(Severity.INFO, message, true);
    }

    // ── Implementation ───────────────────────────────────────────────────

    private enum Severity { INFO, WARN, ERROR }

    // Reflection cache for WorkbenchWindow.getStatusLineManager()
    private static Method statusLineManagerMethod;

    // Track whether the status line approach has ever worked
    private static boolean statusLineAvailable = true;

    private static void show(Severity severity, String message, boolean forceDialog) {
        // Allow empty message to clear the status line
        String prefixed = message == null || message.isEmpty() ? "" : "DevGlobe: " + message;

        // Ensure we run on the UI thread
        Display display = PlatformUI.isWorkbenchRunning() ? PlatformUI.getWorkbench().getDisplay() : null;
        if (display == null || display.isDisposed()) return;

        Runnable action = () -> {
            try {
                IWorkbench workbench = PlatformUI.getWorkbench();
                IWorkbenchWindow window = workbench.getActiveWorkbenchWindow();
                if (window == null) {
                    // Try any window
                    IWorkbenchWindow[] windows = workbench.getWorkbenchWindows();
                    if (windows.length > 0) window = windows[0];
                }
                if (window == null) {
                    if (forceDialog) fallbackDialog(severity, prefixed);
                    return;
                }

                // Use reflection to get StatusLineManager (avoids discouraged access warning)
                StatusLineManager slm = getStatusLineManager(window);

                // Empty message clears the status line
                if (prefixed.isEmpty()) {
                    if (slm != null) {
                        slm.setMessage(null);
                        slm.setErrorMessage(null);
                    }
                    return;
                }

                // Always show dialog if forceDialog is true
                if (forceDialog) {
                    fallbackDialog(severity, prefixed);
                }

                if (slm != null && statusLineAvailable) {
                    switch (severity) {
                        case INFO:
                            slm.setMessage(prefixed);
                            scheduleClear(display, slm);
                            break;
                        case WARN:
                        case ERROR:
                            slm.setErrorMessage(prefixed);
                            scheduleClear(display, slm);
                            break;
                    }
                } else {
                    // Status line not available — fall back to dialog
                    statusLineAvailable = false;
                    if (severity == Severity.ERROR) {
                        fallbackDialog(severity, prefixed);
                    }
                }
            } catch (Exception e) {
                // Workbench may not be fully initialized yet
                statusLineAvailable = false;
                if (forceDialog || severity == Severity.ERROR) {
                    fallbackDialog(severity, prefixed);
                }
            }
        };

        if (display.getThread() == Thread.currentThread()) {
            action.run();
        } else {
            display.asyncExec(action);
        }
    }

    /**
     * Fallback: show a lightweight MessageDialog when the status line
     * is unavailable. This guarantees the user sees the notification.
     */
    private static void fallbackDialog(Severity severity, String message) {
        try {
            Shell shell = getShell();
            if (shell == null || shell.isDisposed()) return;
            switch (severity) {
                case INFO:
                    MessageDialog.openInformation(shell, "DevGlobe", message);
                    break;
                case WARN:
                    MessageDialog.openWarning(shell, "DevGlobe", message);
                    break;
                case ERROR:
                    MessageDialog.openError(shell, "DevGlobe", message);
                    break;
            }
        } catch (Exception ignored) {
            // Last resort — nothing we can do
        }
    }

    /** Get a usable shell from the workbench. */
    private static Shell getShell() {
        try {
            IWorkbenchWindow window = PlatformUI.getWorkbench().getActiveWorkbenchWindow();
            if (window != null && window.getShell() != null && !window.getShell().isDisposed()) {
                return window.getShell();
            }
            IWorkbenchWindow[] windows = PlatformUI.getWorkbench().getWorkbenchWindows();
            for (IWorkbenchWindow w : windows) {
                if (w.getShell() != null && !w.getShell().isDisposed()) {
                    return w.getShell();
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    /** Get StatusLineManager via reflection to avoid discouraged access warnings. */
    private static StatusLineManager getStatusLineManager(IWorkbenchWindow window) {
        try {
            if (statusLineManagerMethod == null) {
                // WorkbenchWindow is internal, but we can access it via reflection
                Class<?> workbenchWindowClass = Class.forName("org.eclipse.ui.internal.WorkbenchWindow");
                statusLineManagerMethod = workbenchWindowClass.getMethod("getStatusLineManager");
                statusLineManagerMethod.setAccessible(true);
            }
            return (StatusLineManager) statusLineManagerMethod.invoke(window);
        } catch (Exception e) {
            // Fallback: window might not be a WorkbenchWindow instance
            return null;
        }
    }

    /** Clear the status-line message after a short delay. */
    private static void scheduleClear(Display display, StatusLineManager slm) {
        Thread clearer = new Thread(() -> {
            try {
                Thread.sleep(5_000);
            } catch (InterruptedException ignored) {}
            // Check if display is still valid before using it
            Display currentDisplay = PlatformUI.isWorkbenchRunning() ? PlatformUI.getWorkbench().getDisplay() : null;
            if (currentDisplay == null || currentDisplay.isDisposed()) {
                return;
            }
            currentDisplay.asyncExec(() -> {
                try {
                    slm.setMessage(null);
                    slm.setErrorMessage(null);
                } catch (Exception ignored) {}
            });
        }, "DevGlobe-Notifier-Clear");
        clearer.setDaemon(true);
        clearer.start();
    }
}
