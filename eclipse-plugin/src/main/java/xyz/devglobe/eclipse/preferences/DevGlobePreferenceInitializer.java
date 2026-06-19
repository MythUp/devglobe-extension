package xyz.devglobe.eclipse.preferences;

import org.eclipse.core.runtime.preferences.AbstractPreferenceInitializer;
import org.eclipse.jface.preference.IPreferenceStore;

import xyz.devglobe.eclipse.core.DevGlobePlugin;

/**
 * Initializes default DevGlobe preference values.
 * Menu is visible by default.
 */
public class DevGlobePreferenceInitializer extends AbstractPreferenceInitializer {

    @Override
    public void initializeDefaultPreferences() {
        IPreferenceStore store = DevGlobePlugin.getDefault().getPreferenceStore();
        store.setDefault(DevGlobePreferencePage.SHOW_MENU_PREF, true);
    }
}
