package xyz.devglobe.eclipse.actions;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.swt.program.Program;
import org.eclipse.ui.handlers.HandlerUtil;

import xyz.devglobe.eclipse.auth.ConfigWriter;

import java.io.File;

/**
 * Opens the DevGlobe log file in the system editor.
 * Mirrors OpenLogFileAction from the JetBrains plugin.
 */
public class OpenLogFileHandler extends AbstractHandler {
    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        File logFile = ConfigWriter.logPath();
        if (logFile.exists()) {
            Program.launch(logFile.getAbsolutePath());
        } else {
            org.eclipse.jface.dialogs.MessageDialog.openWarning(
                    HandlerUtil.getActiveShell(event),
                    "DevGlobe — Log File",
                    "Log file not found at:\n" + logFile.getAbsolutePath());
        }
        return null;
    }
}
