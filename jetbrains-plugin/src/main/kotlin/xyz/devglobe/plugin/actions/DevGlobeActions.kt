package xyz.devglobe.plugin.actions

import com.intellij.ide.BrowserUtil
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindowManager
import xyz.devglobe.plugin.core.DevGlobeTracker
import xyz.devglobe.plugin.settings.DevGlobeSettings

private fun notify(message: String) {
    NotificationGroupManager.getInstance()
        .getNotificationGroup("DevGlobe")
        .createNotification(message, NotificationType.INFORMATION)
        .notify(null)
}

class ToggleAnonymousAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val settings = DevGlobeSettings.getInstance()
        val tracker = DevGlobeTracker.getInstance()
        val newValue = !settings.state.anonymousMode
        settings.state.anonymousMode = newValue
        tracker.updatePreference("anonymousMode", newValue)
        notify("Anonymous mode ${if (newValue) "enabled" else "disabled"}")
    }

    override fun update(e: AnActionEvent) {
        val anonymous = DevGlobeSettings.getInstance().state.anonymousMode
        e.presentation.text = if (anonymous) "Disable Anonymous Mode" else "Enable Anonymous Mode"
    }
}

class ToggleShareRepoAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val settings = DevGlobeSettings.getInstance()
        val tracker = DevGlobeTracker.getInstance()
        val newValue = !settings.state.shareRepo
        settings.state.shareRepo = newValue
        tracker.updatePreference("shareRepo", newValue)
        notify("Repo sharing ${if (newValue) "enabled" else "disabled"}")
    }

    override fun update(e: AnActionEvent) {
        val sharing = DevGlobeSettings.getInstance().state.shareRepo
        e.presentation.text = if (sharing) "Disable Repo Sharing" else "Enable Repo Sharing"
    }
}

class SetStatusAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val tracker = DevGlobeTracker.getInstance()
        val current = tracker.getState().statusMessage
        val message = Messages.showInputDialog(
            "Set your DevGlobe status message:",
            "DevGlobe",
            null,
            current,
            null
        ) ?: return
        tracker.setStatusMessage(message)
        tracker.sendSetStatus(message)
        notify(if (message.isNotEmpty()) "Status: $message" else "Status cleared")
    }
}

class ShowCodingTimeAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val state = DevGlobeTracker.getInstance().getState()
        val lang = if (state.language != null) " — ${state.language}" else ""
        notify("${state.codingTime} today$lang")
    }
}

class OpenGlobeAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        BrowserUtil.browse("https://devglobe.xyz/explore")
    }
}

class OpenPanelAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        ToolWindowManager.getInstance(project).getToolWindow("DevGlobe")?.show()
    }
}
