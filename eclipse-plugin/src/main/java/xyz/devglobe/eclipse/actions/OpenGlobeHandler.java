package xyz.devglobe.eclipse.actions;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.swt.program.Program;

/**
 * Opens the DevGlobe globe in the browser.
 * Mirrors OpenGlobeAction from the JetBrains plugin.
 */
public class OpenGlobeHandler extends AbstractHandler {
    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        Program.launch("https://devglobe.app/space");
        return null;
    }
}
