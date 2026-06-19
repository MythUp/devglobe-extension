package xyz.devglobe.eclipse.core;

import org.eclipse.jface.action.StatusLineManager;
import org.eclipse.swt.widgets.Display;
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
 * For important errors we also fall back to a dialog.</p>
 *
 * <p>Uses reflection to access the internal {@code WorkbenchWindow.getStatusLineManager()}
 * method to avoid "discouraged access" compile-time warnings.</p>
 */
public final class Notifier {

    private Notifier() {}

    // ── Public API ───────────────────────────────────────────────────────

    /** Show an informational message in the status line. Empty message clears the status. */
    public static void info(String message) {
        show(Severity.INFO, message);
    }

    /** Show a warning message in the status line. Empty message clears the status. */
    public static void warn(String message) {
        show(Severity.WARN, message);
    }

    /** Show an error — status line + dialog if the workbench is available. Empty message clears the status. */
    public static void error(String message) {
        show(Severity.ERROR, message);
    }

    // ── Implementation ───────────────────────────────────────────────────

    private enum Severity { INFO, WARN, ERROR }

    // Reflection cache for WorkbenchWindow.getStatusLineManager()
    private static Method statusLineManagerMethod;

    private static void show(Severity severity, String message) {
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
                if (window == null) return;

                // Use reflection to get StatusLineManager (avoids discouraged access warning)
                StatusLineManager slm = getStatusLineManager(window);
                if (slm == null) return;

                // Empty message clears the status line
                if (prefixed.isEmpty()) {
                    slm.setMessage(null);
                    slm.setErrorMessage(null);
                    return;
                }

                switch (severity) {
                    case INFO:
                        slm.setMessage(prefixed);
                        scheduleClear(display, slm);
                        break;
                    case WARN:
                        slm.setErrorMessage(prefixed);
                        scheduleClear(display, slm);
                        break;
                    case ERROR:
                        slm.setErrorMessage(prefixed);
                        scheduleClear(display, slm);
                        break;
                }
            } catch (Exception ignored) {
                // Workbench may not be fully initialized yet
            }
        };

        if (display.getThread() == Thread.currentThread()) {
            action.run();
        } else {
            display.asyncExec(action);
        }
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
            display.asyncExec(() -> {
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
