package xyz.devglobe.plugin.ui

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import xyz.devglobe.plugin.core.DevGlobeTracker
import xyz.devglobe.plugin.core.TrackerState

class DevGlobeStatusBarFactory : StatusBarWidgetFactory {

    override fun getId(): String = "devglobe.statusBar"

    override fun getDisplayName(): String = "DevGlobe"

    override fun isAvailable(project: Project): Boolean = true

    override fun createWidget(project: Project): StatusBarWidget = DevGlobeStatusBarWidget(project)
}

private class DevGlobeStatusBarWidget(private val project: Project) :
    StatusBarWidget, StatusBarWidget.TextPresentation {

    private var statusBar: StatusBar? = null
    private var currentText = ""

    private val stateListener: (TrackerState) -> Unit = { state ->
        currentText = if (state.configured && state.tracking) state.codingTime else ""
        statusBar?.updateWidget(ID())
    }

    override fun ID(): String = "devglobe.statusBar"

    override fun getPresentation(): StatusBarWidget.WidgetPresentation = this

    override fun install(statusBar: StatusBar) {
        this.statusBar = statusBar
        val tracker = DevGlobeTracker.getInstance()
        tracker.addStateListener(stateListener)

        val state = tracker.getState()
        currentText = if (state.configured && state.tracking) state.codingTime else ""
    }

    override fun dispose() {
        DevGlobeTracker.getInstance().removeStateListener(stateListener)
        statusBar = null
    }

    override fun getText(): String =
        if (currentText.isNotEmpty()) "\u23F1 $currentText" else ""

    override fun getTooltipText(): String =
        if (currentText.isNotEmpty()) "DevGlobe: $currentText coded today" else "DevGlobe"

    override fun getAlignment(): Float = 0f
}
