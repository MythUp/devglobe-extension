package xyz.devglobe.eclipse.ui;

import org.eclipse.swt.SWT;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Control;
import org.eclipse.swt.widgets.Label;
import org.eclipse.ui.menus.WorkbenchWindowControlContribution;

import xyz.devglobe.eclipse.core.DevGlobeTracker;
import xyz.devglobe.eclipse.core.TrackerState;

/**
 * Status bar contribution showing coding time.
 * Mirrors DevGlobeStatusBarFactory from the JetBrains plugin.
 *
 * Must extend WorkbenchWindowControlContribution when registered via
 * org.eclipse.ui.menus <control> in a trim toolbar.
 */
public class DevGlobeStatusBarContribution extends WorkbenchWindowControlContribution {

    private Label label;
    private final Runnable stateListener = this::updateLabel;

    public DevGlobeStatusBarContribution() {
        super("xyz.devglobe.eclipse.statusbar");
    }

    @Override
    protected Control createControl(Composite parent) {
        label = new Label(parent, SWT.NONE);
        label.setText("");
        label.setToolTipText("DevGlobe coding time");
        DevGlobeTracker.getInstance().addStateListener(stateListener);
        updateLabel();
        return label;
    }

    @Override
    public void dispose() {
        DevGlobeTracker.getInstance().removeStateListener(stateListener);
        super.dispose();
    }

    private void updateLabel() {
        if (label == null || label.isDisposed()) return;
        TrackerState s = DevGlobeTracker.getInstance().getState();
        label.getDisplay().asyncExec(() -> {
            if (label == null || label.isDisposed()) return;
            if (s.tracking && s.codingTime != null && !s.codingTime.isEmpty()) {
                label.setText("⏱ " + s.codingTime);
                label.setToolTipText("DevGlobe: " + s.codingTime + " coded today");
            } else {
                label.setText("");
                label.setToolTipText("DevGlobe");
            }
        });
    }

}
