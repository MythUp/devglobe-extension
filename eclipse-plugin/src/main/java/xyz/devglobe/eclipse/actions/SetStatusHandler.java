package xyz.devglobe.eclipse.actions;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.jface.dialogs.InputDialog;
import org.eclipse.jface.window.Window;
import org.eclipse.ui.handlers.HandlerUtil;

import xyz.devglobe.eclipse.core.DevGlobeTracker;

/**
 * Sets the DevGlobe status message.
 * Mirrors SetStatusAction from the JetBrains plugin.
 */
public class SetStatusHandler extends AbstractHandler {
    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        InputDialog dialog = new InputDialog(
                HandlerUtil.getActiveShell(event),
                "Set DevGlobe Status",
                "Enter your current status message:",
                "", null);
        if (dialog.open() == Window.OK) {
            String message = dialog.getValue();
            // Allow empty message to clear status
            DevGlobeTracker.getInstance().sendSetStatus(message != null ? message.trim() : "");
        }
        return null;
    }
}
