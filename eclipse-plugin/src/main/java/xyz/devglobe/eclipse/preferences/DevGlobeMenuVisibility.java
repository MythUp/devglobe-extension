package xyz.devglobe.eclipse.preferences;

import org.eclipse.ui.PlatformUI;
import org.eclipse.ui.activities.IActivityManager;
import org.eclipse.ui.activities.IWorkbenchActivitySupport;

import xyz.devglobe.eclipse.core.DevGlobePlugin;

/**
 * Controls the visibility of the DevGlobe menu via Eclipse activities.
 * When the activity is enabled, the menu is hidden (activities act as
 * "capability filters" — enabling an activity that matches a menu ID
 * causes that menu to be filtered out).
 *
 * We invert the logic: the preference "showMenu=true" means we DISABLE
 * the activity (so the menu is visible), and "showMenu=false" means we
 * ENABLE the activity (so the menu is hidden).
 */
public final class DevGlobeMenuVisibility {

    private static final String ACTIVITY_ID = "xyz.devglobe.eclipse.activity.devGlobeMenu";

    private DevGlobeMenuVisibility() {}

    /**
     * Sets whether the DevGlobe menu should be visible.
     *
     * @param visible true to show the menu, false to hide it
     */
    public static void setMenuVisible(boolean visible) {
        try {
            IWorkbenchActivitySupport support = PlatformUI.getWorkbench().getActivitySupport();
            IActivityManager manager = support.getActivityManager();

            if (visible) {
                // Disable the activity → menu is visible
                java.util.Set<String> enabled = new java.util.HashSet<>(manager.getEnabledActivityIds());
                enabled.remove(ACTIVITY_ID);
                support.setEnabledActivityIds(enabled);
            } else {
                // Enable the activity → menu is hidden
                java.util.Set<String> enabled = new java.util.HashSet<>(manager.getEnabledActivityIds());
                enabled.add(ACTIVITY_ID);
                support.setEnabledActivityIds(enabled);
            }
        } catch (Exception e) {
            DevGlobePlugin.log("Failed to toggle menu visibility: " + e.getMessage());
        }
    }

    /**
     * Applies the current preference value to the activity system.
     * Call this at startup to sync the preference with the actual menu state.
     */
    public static void applyPreference() {
        try {
            boolean showMenu = DevGlobePlugin.getDefault().getPreferenceStore()
                    .getBoolean(DevGlobePreferencePage.SHOW_MENU_PREF);
            setMenuVisible(showMenu);
        } catch (Exception e) {
            DevGlobePlugin.log("Failed to apply menu visibility preference: " + e.getMessage());
        }
    }
}
