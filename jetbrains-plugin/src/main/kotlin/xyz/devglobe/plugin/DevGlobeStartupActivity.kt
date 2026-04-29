package xyz.devglobe.plugin

import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import xyz.devglobe.plugin.auth.ApiKeyStorage
import xyz.devglobe.plugin.auth.ConfigWriter
import xyz.devglobe.plugin.core.DevGlobeTracker
import xyz.devglobe.plugin.settings.DevGlobeSettings

class DevGlobeStartupActivity : ProjectActivity {

    override suspend fun execute(project: Project) {
        migrateLegacyApiKey()

        if (!ConfigWriter.hasApiKey()) return

        val settings = DevGlobeSettings.getInstance()
        val tracker = DevGlobeTracker.getInstance()

        tracker.restoreConnected()
        if (settings.state.trackingEnabled) {
            tracker.start()
        }
    }

    private fun migrateLegacyApiKey() {
        if (ConfigWriter.hasApiKey()) return
        val legacy = ApiKeyStorage.get() ?: return
        ConfigWriter.writeApiKey(legacy)
        ApiKeyStorage.clear()
    }
}
