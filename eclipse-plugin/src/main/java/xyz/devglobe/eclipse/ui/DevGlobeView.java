package xyz.devglobe.eclipse.ui;

import org.eclipse.swt.SWT;
import org.eclipse.swt.events.KeyAdapter;
import org.eclipse.swt.events.KeyEvent;
import org.eclipse.swt.events.SelectionAdapter;
import org.eclipse.swt.events.SelectionEvent;
import org.eclipse.swt.graphics.Font;
import org.eclipse.swt.graphics.FontData;
import org.eclipse.swt.layout.GridData;
import org.eclipse.swt.layout.GridLayout;
import org.eclipse.swt.widgets.*;
import org.eclipse.ui.part.ViewPart;

import xyz.devglobe.eclipse.auth.ConfigWriter;
import xyz.devglobe.eclipse.core.DevGlobeTracker;
import xyz.devglobe.eclipse.core.Notifier;
import xyz.devglobe.eclipse.core.TrackerState;

/**
 * DevGlobe sidebar view — shows a polished login form when not configured,
 * and a dashboard with coding time, language, and status when connected.
 * Mirrors the SidebarPanel from the JetBrains plugin.
 */
public class DevGlobeView extends ViewPart {

    public static final String ID = "xyz.devglobe.eclipse.view";

    private Composite parent;
    private Composite loginCard;
    private Composite dashboardCard;

    // Login widgets
    private Text tokenText;
    private Button connectButton;
    private Label loginErrorLabel;

    // Dashboard widgets
    private Label codingTimeLabel;
    private Label languageLabel;
    private Label offlineLabel;
    private Text statusText;
    private Button setStatusButton;
    private Button startStopButton;
    private Label errorLabel;

    private final Runnable stateListener = this::updateUI;

    @Override
    public void createPartControl(Composite parent) {
        this.parent = parent;
        parent.setLayout(new GridLayout(1, false));

        createLoginCard(parent);
        createDashboardCard(parent);

        // Pre-fill API key if one is already saved — this way the user
        // sees their existing key and can choose to re-connect or change it.
        String existingKey = ConfigWriter.readApiKey();
        if (existingKey != null && !existingKey.isEmpty()) {
            tokenText.setText(existingKey);
        }

        // Show appropriate card
        updateUI();

        DevGlobeTracker.getInstance().addStateListener(stateListener);
    }

    @Override
    public void dispose() {
        DevGlobeTracker.getInstance().removeStateListener(stateListener);
        super.dispose();
    }

    @Override
    public void setFocus() {
        if (loginCard != null && loginCard.isVisible()) {
            tokenText.setFocus();
        }
    }

    // ── Login card ──────────────────────────────────────────────────────

    private void createLoginCard(Composite parent) {
        loginCard = new Composite(parent, SWT.NONE);
        loginCard.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));
        GridLayout loginLayout = new GridLayout(1, false);
        loginLayout.marginWidth = 16;
        loginLayout.marginHeight = 16;
        loginLayout.verticalSpacing = 10;
        loginCard.setLayout(loginLayout);

        // ── Title ─────────────────────────────────────────────────────
        Label title = new Label(loginCard, SWT.CENTER);
        title.setText("🌍  DevGlobe");
        Font baseFont = parent.getDisplay().getSystemFont();
        FontData[] titleFd = baseFont.getFontData();
        for (FontData f : titleFd) {
            f.setHeight(f.getHeight() + 4);
            f.setStyle(SWT.BOLD);
        }
        title.setFont(new Font(parent.getDisplay(), titleFd));
        title.setLayoutData(new GridData(SWT.CENTER, SWT.CENTER, true, false));

        // ── Subtitle ──────────────────────────────────────────────────
        Label desc = new Label(loginCard, SWT.WRAP | SWT.CENTER);
        desc.setText("Track your coding activity across all your projects.\nConnect your account to get started.");
        desc.setLayoutData(new GridData(SWT.CENTER, SWT.CENTER, true, false));

        // Spacer
        new Label(loginCard, SWT.NONE).setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));

        // ── Form ──────────────────────────────────────────────────────
        Composite form = new Composite(loginCard, SWT.NONE);
        form.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));
        GridLayout formLayout = new GridLayout(1, false);
        formLayout.marginWidth = 0;
        formLayout.marginHeight = 0;
        formLayout.verticalSpacing = 8;
        form.setLayout(formLayout);

        Label tokenLabel = new Label(form, SWT.NONE);
        tokenLabel.setText("API Key");
        FontData[] labelFd = baseFont.getFontData();
        for (FontData f : labelFd) {
            f.setStyle(SWT.BOLD);
        }
        tokenLabel.setFont(new Font(parent.getDisplay(), labelFd));

        tokenText = new Text(form, SWT.BORDER | SWT.PASSWORD);
        tokenText.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));
        tokenText.setMessage("Enter your DevGlobe API key...");
        // Allow Enter key to submit
        tokenText.addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (e.keyCode == SWT.CR || e.keyCode == SWT.KEYPAD_CR) {
                    connectButton.notifyListeners(SWT.Selection, new Event());
                }
            }
        });

        // Show/hide toggle
        Button showKeyToggle = new Button(form, SWT.CHECK);
        showKeyToggle.setText("Show API key");
        showKeyToggle.setLayoutData(new GridData(SWT.BEGINNING, SWT.CENTER, false, false));
        showKeyToggle.addSelectionListener(new SelectionAdapter() {
            @Override
            public void widgetSelected(SelectionEvent e) {
                tokenText.setEchoChar(showKeyToggle.getSelection() ? '\0' : '•');
            }
        });

        connectButton = new Button(form, SWT.PUSH);
        connectButton.setText("🔗  Connect");
        connectButton.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));
        connectButton.addSelectionListener(new SelectionAdapter() {
            @Override
            public void widgetSelected(SelectionEvent e) {
                String apiKey = tokenText.getText().trim();
                if (apiKey.isEmpty()) {
                    loginErrorLabel.setText("⚠ Please enter an API key");
                    Notifier.warn("API key is empty");
                    return;
                }
                loginErrorLabel.setText("");
                connectButton.setEnabled(false);
                connectButton.setText("⏳  Connecting...");
                DevGlobeTracker.getInstance().saveApiKeyAndStart(apiKey);
            }
        });

        // Error label
        loginErrorLabel = new Label(form, SWT.WRAP);
        loginErrorLabel.setForeground(parent.getDisplay().getSystemColor(SWT.COLOR_RED));
        loginErrorLabel.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));

        // Spacer
        new Label(form, SWT.NONE).setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false, 1, 1));

        // Get key link
        Link getLink = new Link(form, SWT.NONE);
        getLink.setText("Don't have an API key? <a href=\"https://devglobe.app/settings\">Get one at devglobe.app/settings</a>");
        getLink.setLayoutData(new GridData(SWT.CENTER, SWT.CENTER, true, false));
        getLink.addSelectionListener(new SelectionAdapter() {
            @Override
            public void widgetSelected(SelectionEvent e) {
                org.eclipse.swt.program.Program.launch("https://devglobe.app/settings");
            }
        });
    }

    // ── Dashboard card ───────────────────────────────────────────────────

    private void createDashboardCard(Composite parent) {
        dashboardCard = new Composite(parent, SWT.NONE);
        dashboardCard.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));
        GridLayout dashLayout = new GridLayout(1, false);
        dashLayout.marginWidth = 16;
        dashLayout.marginHeight = 16;
        dashLayout.verticalSpacing = 10;
        dashboardCard.setLayout(dashLayout);

        // ── Title ─────────────────────────────────────────────────────
        Label dashTitle = new Label(dashboardCard, SWT.CENTER);
        dashTitle.setText("🌍  DevGlobe");
        Font baseFont = parent.getDisplay().getSystemFont();
        FontData[] titleFd = baseFont.getFontData();
        for (FontData f : titleFd) {
            f.setHeight(f.getHeight() + 4);
            f.setStyle(SWT.BOLD);
        }
        dashTitle.setFont(new Font(parent.getDisplay(), titleFd));
        dashTitle.setLayoutData(new GridData(SWT.CENTER, SWT.CENTER, true, false));

        // ── Coding time row ───────────────────────────────────────────
        Composite codingTimeRow = new Composite(dashboardCard, SWT.NONE);
        codingTimeRow.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));
        GridLayout rowLayout = new GridLayout(2, false);
        rowLayout.marginWidth = 0;
        rowLayout.marginHeight = 0;
        rowLayout.horizontalSpacing = 8;
        codingTimeRow.setLayout(rowLayout);

        Label ctIcon = new Label(codingTimeRow, SWT.NONE);
        ctIcon.setText("⏱");
        ctIcon.setLayoutData(new GridData(SWT.BEGINNING, SWT.CENTER, false, false));
        codingTimeLabel = new Label(codingTimeRow, SWT.NONE);
        codingTimeLabel.setText("0m coded today");
        codingTimeLabel.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));

        // ── Language row ──────────────────────────────────────────────
        Composite languageRow = new Composite(dashboardCard, SWT.NONE);
        languageRow.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));
        languageRow.setLayout(rowLayout);

        Label langIcon = new Label(languageRow, SWT.NONE);
        langIcon.setText("💻");
        langIcon.setLayoutData(new GridData(SWT.BEGINNING, SWT.CENTER, false, false));
        languageLabel = new Label(languageRow, SWT.NONE);
        languageLabel.setText("—");
        languageLabel.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));

        // ── Status row ────────────────────────────────────────────────
        Composite statusRow = new Composite(dashboardCard, SWT.NONE);
        statusRow.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));
        statusRow.setLayout(rowLayout);

        Label statusIcon = new Label(statusRow, SWT.NONE);
        statusIcon.setText("📡");
        statusIcon.setLayoutData(new GridData(SWT.BEGINNING, SWT.CENTER, false, false));
        offlineLabel = new Label(statusRow, SWT.NONE);
        offlineLabel.setText("Online");
        offlineLabel.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));

        // ── Separator ─────────────────────────────────────────────────
        Label sep1 = new Label(dashboardCard, SWT.SEPARATOR | SWT.HORIZONTAL);
        sep1.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));

        // ── Status message ────────────────────────────────────────────
        Label statusTitle = new Label(dashboardCard, SWT.NONE);
        statusTitle.setText("📝  Status Message");
        FontData[] labelFd = baseFont.getFontData();
        for (FontData f : labelFd) {
            f.setStyle(SWT.BOLD);
        }
        statusTitle.setFont(new Font(parent.getDisplay(), labelFd));

        statusText = new Text(dashboardCard, SWT.BORDER);
        statusText.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));
        statusText.setMessage("What are you working on?");
        // Allow Enter key to set status
        statusText.addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (e.keyCode == SWT.CR || e.keyCode == SWT.KEYPAD_CR) {
                    setStatusButton.notifyListeners(SWT.Selection, new Event());
                }
            }
        });

        setStatusButton = new Button(dashboardCard, SWT.PUSH);
        setStatusButton.setText("Set Status");
        setStatusButton.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));
        setStatusButton.addSelectionListener(new SelectionAdapter() {
            @Override
            public void widgetSelected(SelectionEvent e) {
                String msg = statusText.getText().trim();
                // Allow empty message to clear status
                DevGlobeTracker.getInstance().sendSetStatus(msg);
                statusText.setText(""); // Clear after sending
            }
        });

        // ── Separator ─────────────────────────────────────────────────
        Label sep2 = new Label(dashboardCard, SWT.SEPARATOR | SWT.HORIZONTAL);
        sep2.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));

        // ── Start / Stop tracking ─────────────────────────────────────
        startStopButton = new Button(dashboardCard, SWT.PUSH);
        startStopButton.setText("⏹  Stop Tracking");
        startStopButton.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));
        startStopButton.addSelectionListener(new SelectionAdapter() {
            @Override
            public void widgetSelected(SelectionEvent e) {
                DevGlobeTracker tracker = DevGlobeTracker.getInstance();
                if (tracker.getState().tracking) {
                    tracker.pause();
                } else {
                    tracker.resume();
                }
            }
        });

        // ── Links ─────────────────────────────────────────────────────
        Link globeLink = new Link(dashboardCard, SWT.NONE);
        globeLink.setText("🌍 <a href=\"https://devglobe.app/space\">View your globe</a>");
        globeLink.setLayoutData(new GridData(SWT.CENTER, SWT.CENTER, true, false));
        globeLink.addSelectionListener(new SelectionAdapter() {
            @Override
            public void widgetSelected(SelectionEvent e) {
                org.eclipse.swt.program.Program.launch("https://devglobe.app/space");
            }
        });

        Link disconnectLink = new Link(dashboardCard, SWT.NONE);
        disconnectLink.setText("<a>Disconnect</a>");
        disconnectLink.setLayoutData(new GridData(SWT.CENTER, SWT.CENTER, true, false));
        disconnectLink.addSelectionListener(new SelectionAdapter() {
            @Override
            public void widgetSelected(SelectionEvent e) {
                DevGlobeTracker.getInstance().reset();
                tokenText.setText("");
                // Notifier.info("Disconnected") is called by DevGlobeTracker.reset()
            }
        });

        // ── Error label ───────────────────────────────────────────────
        errorLabel = new Label(dashboardCard, SWT.WRAP);
        errorLabel.setForeground(parent.getDisplay().getSystemColor(SWT.COLOR_RED));
        errorLabel.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));
    }

    // ── UI update ────────────────────────────────────────────────────────

    private void updateUI() {
        if (parent == null || parent.isDisposed()) return;
        TrackerState s = DevGlobeTracker.getInstance().getState();

        parent.getDisplay().asyncExec(() -> {
            if (parent.isDisposed()) return;

            boolean configured = s.configured;
            loginCard.setVisible(!configured);
            dashboardCard.setVisible(configured);

            // Layout trick: hide/show
            GridData loginData = (GridData) loginCard.getLayoutData();
            GridData dashData = (GridData) dashboardCard.getLayoutData();
            loginData.exclude = configured;
            dashData.exclude = !configured;

            if (configured) {
                codingTimeLabel.setText(s.codingTime + " coded today");
                languageLabel.setText(s.language != null && !"null".equals(s.language) ? s.language : "—");
                offlineLabel.setText(s.offline ? "⚠ Offline" : "✅ Online");
                offlineLabel.setToolTipText(s.offline
                        ? "Cannot reach the DevGlobe API server"
                        : "Connected to the DevGlobe API server");
                offlineLabel.setForeground(
                        parent.getDisplay().getSystemColor(s.offline ? SWT.COLOR_RED : SWT.COLOR_DARK_GREEN));
                startStopButton.setText(s.tracking ? "⏹  Stop Tracking" : "▶  Start Tracking");
                errorLabel.setText(s.error != null ? s.error : "");
            } else {
                if (s.error != null) {
                    loginErrorLabel.setText(s.error);
                } else {
                    loginErrorLabel.setText("");
                }
                // Re-enable connect button and reset text
                connectButton.setEnabled(true);
                connectButton.setText("🔗  Connect");
            }

            parent.layout(true, true);
        });
    }
}
