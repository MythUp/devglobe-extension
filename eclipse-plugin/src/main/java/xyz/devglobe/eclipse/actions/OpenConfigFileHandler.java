package xyz.devglobe.eclipse.actions;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.swt.program.Program;
import org.eclipse.ui.handlers.HandlerUtil;

import xyz.devglobe.eclipse.auth.ConfigWriter;

import java.io.File;

/**
 * Opens the DevGlobe config file in the system editor.
 * Mirrors OpenConfigFileAction from the JetBrains plugin.
 */
public class OpenConfigFileHandler extends AbstractHandler {
    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        File configFile = ConfigWriter.configPath();
        if (configFile.exists()) {
            Program.launch(configFile.getAbsolutePath());
        } else {
            org.eclipse.jface.dialogs.MessageDialog.openWarning(
                    HandlerUtil.getActiveShell(event),
                    "DevGlobe — Config File",
                    "Config file not found at:\n" + configFile.getAbsolutePath());
        }
        return null;
    }
}
