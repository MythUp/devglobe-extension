package xyz.devglobe.plugin

import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import xyz.devglobe.plugin.auth.ApiKeyStorage
import xyz.devglobe.plugin.core.DevGlobeTracker
import xyz.devglobe.plugin.settings.DevGlobeSettings

class DevGlobeStartupActivity : ProjectActivity {

    override suspend fun execute(project: Project) {
        val apiKey = ApiKeyStorage.get() ?: return
        val settings = DevGlobeSettings.getInstance()
        val tracker = DevGlobeTracker.getInstance()

        if (settings.state.trackingEnabled) {
            tracker.restoreConnected(apiKey)
            tracker.start(apiKey)
        } else {
            tracker.restoreConnected(apiKey)
        }
    }
}
