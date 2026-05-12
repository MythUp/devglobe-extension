package xyz.devglobe.plugin.ui

import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPasswordField
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.JBUI
import xyz.devglobe.plugin.core.TrackerState
import java.awt.*
import java.awt.event.KeyAdapter
import java.awt.event.KeyEvent
import javax.swing.*

interface SidebarListener {
    fun onConnect(apiKey: String)
    fun onDisconnect()
    fun onStartTracking()
    fun onStopTracking()
    fun onSetStatus(message: String)
    fun onOpenExternal(url: String)
}

class SidebarPanel : JPanel() {

    var listener: SidebarListener? = null

    private val cardLayout = CardLayout()
    private val cards = JPanel(cardLayout)

    private val tokenField = JBPasswordField()
    private val connectButton = JButton("Connect")

    private val codingTimeLabel = JBLabel("0m")
    private val languageLabel = JBLabel("--")
    private val statusField = JBTextField()
    private val statusButton = JButton("Set")
    private val stopButton = JButton("Stop Tracking")
    private val startButton = JButton("Start Tracking")
    private val errorLabel = JBLabel()

    init {
        layout = BorderLayout()
        border = JBUI.Borders.empty(10)

        cards.isOpaque = false
        cards.add(buildLoginPanel(), "login")
        cards.add(buildDashboardPanel(), "dashboard")
        add(cards, BorderLayout.NORTH)

        wireEvents()
    }

    fun updateState(state: TrackerState) {
        if (state.configured) {
            cardLayout.show(cards, "dashboard")
            codingTimeLabel.text = state.codingTime.ifEmpty { "0m" }
            languageLabel.text = state.language ?: "--"
            stopButton.isEnabled = state.tracking
            startButton.isEnabled = !state.tracking

            if (state.error != null) {
                errorLabel.text = "<html><b>${state.error}</b></html>"
                errorLabel.foreground = UIManager.getColor("Label.errorForeground") ?: Color(0xCC, 0x33, 0x33)
                errorLabel.isVisible = true
            } else {
                errorLabel.isVisible = false
            }
        } else {
            cardLayout.show(cards, "login")
            tokenField.text = ""
            errorLabel.isVisible = false
        }
    }

    private fun buildLoginPanel(): JPanel {
        val panel = JPanel(GridBagLayout())
        panel.isOpaque = false
        val gbc = fillRow()
        var row = 0

        gbc.gridy = row++
        panel.add(sectionHeading("Connect to DevGlobe"), gbc)

        gbc.gridy = row++; gbc.insets = JBUI.insets(8, 0, 0, 0)
        tokenField.emptyText.text = "Paste your API key"
        panel.add(tokenField, gbc)

        gbc.gridy = row++; gbc.insets = JBUI.insets(6, 0, 0, 0)
        panel.add(connectButton, gbc)

        gbc.gridy = row++; gbc.insets = JBUI.insets(6, 0, 0, 0)
        panel.add(createLink("Get your API key on devglobe.app") {
            listener?.onOpenExternal("https://devglobe.app/dashboard/settings")
        }, gbc)

        return panel
    }

    private fun buildDashboardPanel(): JPanel {
        val panel = JPanel(GridBagLayout())
        panel.isOpaque = false
        val gbc = fillRow()
        var row = 0
        gbc.gridy = row++; gbc.insets = JBUI.emptyInsets()
        errorLabel.isVisible = false
        errorLabel.font = errorLabel.font.deriveFont(Font.PLAIN, 11f)
        panel.add(errorLabel, gbc)
        gbc.gridy = row++; gbc.insets = JBUI.insets(4, 0, 0, 0)
        panel.add(sectionHeading("Dashboard"), gbc)

        gbc.gridy = row++; gbc.insets = JBUI.insets(4, 0, 0, 0)
        panel.add(statRow("Coding today", codingTimeLabel), gbc)

        gbc.gridy = row++; gbc.insets = JBUI.insets(2, 0, 0, 0)
        panel.add(statRow("Language", languageLabel), gbc)
        gbc.gridy = row++; gbc.insets = JBUI.insets(10, 0, 10, 0)
        panel.add(JSeparator(), gbc)
        gbc.gridy = row++; gbc.insets = JBUI.emptyInsets()
        panel.add(sectionHeading("Status Message"), gbc)

        gbc.gridy = row++; gbc.insets = JBUI.insets(4, 0, 0, 0)
        val statusRow = JPanel(BorderLayout(4, 0))
        statusRow.isOpaque = false
        statusField.emptyText.text = "What are you working on?"
        statusRow.add(statusField, BorderLayout.CENTER)
        statusRow.add(statusButton, BorderLayout.EAST)
        panel.add(statusRow, gbc)

        gbc.gridy = row++; gbc.insets = JBUI.insets(6, 0, 0, 0)
        val settingsHint = JBLabel("<html>Privacy &amp; visibility settings are managed on <a href='#'>devglobe.app</a>.</html>")
        settingsHint.font = settingsHint.font.deriveFont(Font.PLAIN, 11f)
        settingsHint.foreground = UIManager.getColor("Label.disabledForeground")
        settingsHint.cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
        settingsHint.addMouseListener(object : java.awt.event.MouseAdapter() {
            override fun mouseClicked(e: java.awt.event.MouseEvent) {
                listener?.onOpenExternal("https://devglobe.app/dashboard/settings")
            }
        })
        panel.add(settingsHint, gbc)
        gbc.gridy = row++; gbc.insets = JBUI.insets(10, 0, 10, 0)
        panel.add(JSeparator(), gbc)
        gbc.gridy = row++; gbc.insets = JBUI.emptyInsets()
        val buttonRow = JPanel(GridLayout(1, 2, 6, 0))
        buttonRow.isOpaque = false
        buttonRow.add(stopButton)
        buttonRow.add(startButton)
        panel.add(buttonRow, gbc)

        gbc.gridy = row++; gbc.insets = JBUI.insets(12, 0, 0, 0)
        gbc.fill = GridBagConstraints.NONE
        gbc.anchor = GridBagConstraints.CENTER
        panel.add(createLink("Disconnect") { listener?.onDisconnect() }, gbc)

        return panel
    }

    private fun wireEvents() {
        connectButton.addActionListener {
            val key = String(tokenField.password).trim()
            if (key.isNotEmpty()) listener?.onConnect(key)
        }
        tokenField.addKeyListener(object : KeyAdapter() {
            override fun keyPressed(e: KeyEvent) {
                if (e.keyCode == KeyEvent.VK_ENTER) connectButton.doClick()
            }
        })
        statusButton.addActionListener {
            listener?.onSetStatus(statusField.text)
        }
        statusField.addKeyListener(object : KeyAdapter() {
            override fun keyPressed(e: KeyEvent) {
                if (e.keyCode == KeyEvent.VK_ENTER) statusButton.doClick()
            }
        })
        stopButton.addActionListener { listener?.onStopTracking() }
        startButton.addActionListener { listener?.onStartTracking() }
    }

    private fun fillRow(): GridBagConstraints = GridBagConstraints().apply {
        gridx = 0
        weightx = 1.0
        fill = GridBagConstraints.HORIZONTAL
        anchor = GridBagConstraints.NORTHWEST
    }

    private fun sectionHeading(text: String): JBLabel {
        val label = JBLabel(text.uppercase())
        label.font = label.font.deriveFont(Font.BOLD, 11f)
        label.foreground = UIManager.getColor("Label.disabledForeground")
        return label
    }

    private fun statRow(labelText: String, valueLabel: JBLabel): JPanel {
        val row = JPanel(BorderLayout())
        row.isOpaque = false
        val label = JBLabel(labelText)
        label.foreground = UIManager.getColor("Label.disabledForeground")
        row.add(label, BorderLayout.WEST)
        valueLabel.font = valueLabel.font.deriveFont(Font.BOLD)
        row.add(valueLabel, BorderLayout.EAST)
        return row
    }

    private fun createLink(text: String, action: () -> Unit): JBLabel {
        val label = JBLabel("<html><a href='#'>$text</a></html>")
        label.cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
        label.addMouseListener(object : java.awt.event.MouseAdapter() {
            override fun mouseClicked(e: java.awt.event.MouseEvent) {
                action()
            }
        })
        return label
    }
}
