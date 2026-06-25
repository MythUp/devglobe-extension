package xyz.devglobe.eclipse.actions;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.ui.IWorkbenchPage;
import org.eclipse.ui.PartInitException;
import org.eclipse.ui.PlatformUI;

import xyz.devglobe.eclipse.core.DevGlobePlugin;
import xyz.devglobe.eclipse.ui.DevGlobeView;

/**
 * Opens the DevGlobe sidebar view in Eclipse.
 * Used by the vertical toolbar icon and the View → Show View menu.
 */
public class OpenDevGlobeViewHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        try {
            IWorkbenchPage page = PlatformUI.getWorkbench()
                    .getActiveWorkbenchWindow()
                    .getActivePage();
            page.showView(DevGlobeView.ID);
        } catch (PartInitException e) {
            DevGlobePlugin.log("Failed to open DevGlobe view: " + e.getMessage());
        }
        return null;
    }
}
