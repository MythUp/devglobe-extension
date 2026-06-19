package xyz.devglobe.eclipse.preferences;

import org.eclipse.jface.preference.BooleanFieldEditor;
import org.eclipse.jface.preference.FieldEditorPreferencePage;
import org.eclipse.ui.IWorkbench;
import org.eclipse.ui.IWorkbenchPreferencePage;

import xyz.devglobe.eclipse.core.DevGlobePlugin;

/**
 * DevGlobe preference page.
 * Allows toggling the DevGlobe menu visibility in the main menu bar.
 */
public class DevGlobePreferencePage extends FieldEditorPreferencePage
        implements IWorkbenchPreferencePage {

    public static final String SHOW_MENU_PREF = "xyz.devglobe.eclipse.showMenu";

    public DevGlobePreferencePage() {
        super(GRID);
        setPreferenceStore(DevGlobePlugin.getDefault().getPreferenceStore());
        setDescription("DevGlobe Plugin Preferences");
    }

    @Override
    public void createFieldEditors() {
        addField(new BooleanFieldEditor(
                SHOW_MENU_PREF,
                "&Show DevGlobe menu in menu bar",
                getFieldEditorParent()));
    }

    @Override
    public void init(IWorkbench workbench) {
        // no-op
    }

    @Override
    public boolean performOk() {
        return super.performOk();
    }
}
