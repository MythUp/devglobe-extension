package xyz.devglobe.eclipse.ui;

import org.eclipse.ui.IEditorInput;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.IPartListener2;
import org.eclipse.ui.IWorkbenchPartReference;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PlatformUI;

import xyz.devglobe.eclipse.core.DevGlobeTracker;

/**
 * Listens for document changes in Eclipse editors and sends activity
 * to the DevGlobe core. Mirrors the document listener from the JetBrains plugin.
 */
public class DocumentTracker {

    private static final long DEDUP_WINDOW_MS = 2000;
    private static final long ACTIVITY_TIMEOUT_MS = 60000;

    private long lastActivityTime = 0;
    private String lastActivityFile = "";
    private IPartListener2 partListener;
    private IWorkbenchWindow window;

    public void start() {
        try {
            window = PlatformUI.getWorkbench().getActiveWorkbenchWindow();
        } catch (IllegalStateException e) {
            // Workbench not started yet
            return;
        }
        if (window == null) return;

        partListener = new IPartListener2() {
            @Override
            public void partOpened(IWorkbenchPartReference ref) {
                trackActiveEditor();
            }

            @Override
            public void partActivated(IWorkbenchPartReference ref) {
                trackActiveEditor();
            }

            @Override
            public void partBroughtToTop(IWorkbenchPartReference ref) {
                trackActiveEditor();
            }

            @Override
            public void partInputChanged(IWorkbenchPartReference ref) {
                trackActiveEditor();
            }

            @Override public void partClosed(IWorkbenchPartReference ref) {}
            @Override public void partDeactivated(IWorkbenchPartReference ref) {}
            @Override public void partHidden(IWorkbenchPartReference ref) {}
            @Override public void partVisible(IWorkbenchPartReference ref) {}
        };

        window.getPartService().addPartListener(partListener);
        trackActiveEditor();
    }

    public void stop() {
        if (window != null && partListener != null) {
            window.getPartService().removePartListener(partListener);
        }
    }

    private void trackActiveEditor() {
        if (window == null) return;
        IEditorPart editor = window.getActivePage() != null
                ? window.getActivePage().getActiveEditor()
                : null;
        if (editor == null) return;

        IEditorInput input = editor.getEditorInput();
        if (input == null) return;

        String filePath = null;
        try {
            var adapter = input.getAdapter(org.eclipse.core.resources.IFile.class);
            if (adapter instanceof org.eclipse.core.resources.IFile) {
                filePath = ((org.eclipse.core.resources.IFile) adapter).getLocation().toOSString();
            }
        } catch (Exception ignored) {}

        if (filePath == null) {
            // Fallback: use the editor input name
            String name = input.getName();
            if (name != null && !name.isEmpty()) {
                filePath = name;
            } else {
                return;
            }
        }

        sendActivity(filePath);
    }

    private void sendActivity(String filePath) {
        long now = System.currentTimeMillis();

        // Dedup: skip if same file within DEDUP_WINDOW_MS
        if (filePath.equals(lastActivityFile) && (now - lastActivityTime) < DEDUP_WINDOW_MS) {
            return;
        }

        // Activity timeout: skip if too recent with different file
        if (!filePath.equals(lastActivityFile) && (now - lastActivityTime) < ACTIVITY_TIMEOUT_MS) {
            // Still send — different file
        }

        lastActivityTime = now;
        lastActivityFile = filePath;

        // Pass null to delegate language detection to devglobe-core
        DevGlobeTracker.getInstance().sendActivity(filePath, null);
    }
}
