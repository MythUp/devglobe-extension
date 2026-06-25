package xyz.devglobe.eclipse.core;

import org.eclipse.ui.IStartup;
import org.eclipse.ui.IWorkbench;
import org.eclipse.ui.PlatformUI;

import xyz.devglobe.eclipse.auth.ConfigWriter;
import xyz.devglobe.eclipse.ui.DocumentTracker;

/**
 * Early-startup class that initializes DevGlobe tracking when Eclipse starts.
 * Registered via the org.eclipse.ui.startup extension point.
 */
public class DevGlobeStartup implements IStartup {

    private static DocumentTracker documentTracker;

    @Override
    public void earlyStartup() {
        DevGlobePlugin.log("DevGlobe early startup triggered");

        // Start document tracking
        documentTracker = new DocumentTracker();

        // If API key exists, auto-start tracking
        if (ConfigWriter.hasApiKey()) {
            DevGlobePlugin.log("API key found, auto-starting tracker");
            DevGlobeTracker.getInstance().start();
        }

        // Start document tracker regardless (it will send activity when tracker is ready)
        try {
            IWorkbench workbench = PlatformUI.getWorkbench();
            workbench.getDisplay().asyncExec(() -> {
                documentTracker.start();
                DevGlobePlugin.log("Document tracker started");
            });
        } catch (IllegalStateException e) {
            DevGlobePlugin.logWarning("Workbench not available during startup: " + e.getMessage());
        }
    }

    /**
     * Returns the document tracker instance for lifecycle management.
     */
    public static DocumentTracker getDocumentTracker() {
        return documentTracker;
    }

    /**
     * Stops the document tracker. Called from DevGlobePlugin.stop().
     */
    public static void stopDocumentTracker() {
        if (documentTracker != null) {
            documentTracker.stop();
            documentTracker = null;
            DevGlobePlugin.log("Document tracker stopped");
        }
    }
}
