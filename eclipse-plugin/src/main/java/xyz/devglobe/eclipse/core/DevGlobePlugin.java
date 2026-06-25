package xyz.devglobe.eclipse.core;

import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.Status;
import org.eclipse.ui.plugin.AbstractUIPlugin;
import org.osgi.framework.BundleContext;

/**
 * The DevGlobe Eclipse plug-in activator.
 * Manages the plugin lifecycle and provides logging utilities.
 */
public class DevGlobePlugin extends AbstractUIPlugin {

    public static final String PLUGIN_ID = "xyz.devglobe.eclipse";
    private static DevGlobePlugin instance;

    public DevGlobePlugin() {}

    @Override
    public void start(BundleContext context) throws Exception {
        super.start(context);
        instance = this;
        DevGlobePlugin.log("DevGlobe plugin starting");
        // Note: Auto-start and document tracking are handled by DevGlobeStartup
        // which runs via the org.eclipse.ui.startup extension point.
        // This ensures the workbench is fully initialized before we start tracking.
    }

    @Override
    public void stop(BundleContext context) throws Exception {
        DevGlobeStartup.stopDocumentTracker();
        DevGlobeTracker.getInstance().shutdown();
        instance = null;
        super.stop(context);
    }

    public static DevGlobePlugin getDefault() {
        return instance;
    }

    // ── Logging ──────────────────────────────────────────────────────────

    public static void log(String message) {
        if (instance != null) {
            instance.getLog().log(new Status(IStatus.INFO, PLUGIN_ID, message));
        }
    }

    public static void logError(String message, Throwable t) {
        if (instance != null) {
            instance.getLog().log(new Status(IStatus.ERROR, PLUGIN_ID, message, t));
        }
    }

    public static void logWarning(String message) {
        if (instance != null) {
            instance.getLog().log(new Status(IStatus.WARNING, PLUGIN_ID, message));
        }
    }
}
