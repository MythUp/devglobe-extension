package xyz.devglobe.eclipse.actions;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.ui.handlers.HandlerUtil;

import xyz.devglobe.eclipse.auth.ConfigWriter;

/**
 * Toggles debug mode in the DevGlobe config.
 * Mirrors ToggleDebugAction from the JetBrains plugin.
 */
public class ToggleDebugHandler extends AbstractHandler {
    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        boolean current = ConfigWriter.isDebugEnabled();
        boolean newValue = !current;
        ConfigWriter.setDebug(newValue);
        MessageDialog.openInformation(
                HandlerUtil.getActiveShell(event),
                "DevGlobe — Debug Mode",
                "Debug mode is now " + (newValue ? "enabled" : "disabled") + ".");
        return null;
    }
}
