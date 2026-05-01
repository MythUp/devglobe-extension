package xyz.devglobe.plugin.actions

import com.intellij.ide.BrowserUtil
import com.intellij.notification.Notification
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindowManager
import xyz.devglobe.plugin.core.DevGlobeTracker

private fun notify(message: String) {
    Notification("DevGlobe", "DevGlobe", message, NotificationType.INFORMATION).notify(null)
}

class SetStatusAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val tracker = DevGlobeTracker.getInstance()
        val message = Messages.showInputDialog(
            "Set your DevGlobe status message:",
            "DevGlobe",
            null,
            "",
            null
        ) ?: return
        tracker.sendSetStatus(message)
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
        BrowserUtil.browse("https://devglobe.xyz/space")
    }
}

class OpenPanelAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        ToolWindowManager.getInstance(project).getToolWindow("DevGlobe")?.show()
    }
}
