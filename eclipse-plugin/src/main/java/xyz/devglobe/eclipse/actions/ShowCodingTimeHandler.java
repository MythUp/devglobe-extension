package xyz.devglobe.eclipse.actions;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.ui.handlers.HandlerUtil;

import xyz.devglobe.eclipse.core.DevGlobeTracker;
import xyz.devglobe.eclipse.core.TrackerState;

/**
 * Shows the current coding time in a dialog.
 * Mirrors ShowCodingTimeAction from the JetBrains plugin.
 */
public class ShowCodingTimeHandler extends AbstractHandler {
    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        TrackerState state = DevGlobeTracker.getInstance().getState();
        String time = state.codingTime != null ? state.codingTime : "0m";
        String lang = state.language != null ? state.language : "—";
        String msg = "You've coded " + time + " today.\nLanguage: " + lang;
        MessageDialog.openInformation(
                HandlerUtil.getActiveShell(event),
                "DevGlobe — Coding Time",
                msg);
        return null;
    }
}
