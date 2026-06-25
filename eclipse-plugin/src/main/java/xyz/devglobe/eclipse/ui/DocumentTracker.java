package xyz.devglobe.eclipse.ui;

import java.util.Map;

import org.eclipse.jface.text.DocumentEvent;
import org.eclipse.jface.text.IDocument;
import org.eclipse.jface.text.IDocumentListener;
import org.eclipse.ui.IEditorInput;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.IPartListener2;
import org.eclipse.ui.IWorkbenchPartReference;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PlatformUI;
import org.eclipse.ui.texteditor.IDocumentProvider;
import org.eclipse.ui.texteditor.ITextEditor;

import xyz.devglobe.eclipse.core.DevGlobeTracker;

/**
 * Listens for document changes in Eclipse editors and sends activity
 * to the DevGlobe core. Mirrors the document listener from the JetBrains plugin.
 */
public class DocumentTracker {

    private static final long DEDUP_WINDOW_MS = 2000;

    /** File-extension → language display name (mirrors JetBrains LanguageService). */
    private static final Map<String, String> EXTENSION_MAP = Map.ofEntries(
            Map.entry("ts", "TypeScript"),
            Map.entry("tsx", "TypeScript JSX"),
            Map.entry("js", "JavaScript"),
            Map.entry("jsx", "JavaScript JSX"),
            Map.entry("mjs", "JavaScript"),
            Map.entry("cjs", "JavaScript"),
            Map.entry("py", "Python"),
            Map.entry("rb", "Ruby"),
            Map.entry("go", "Go"),
            Map.entry("rs", "Rust"),
            Map.entry("java", "Java"),
            Map.entry("kt", "Kotlin"),
            Map.entry("kts", "Kotlin"),
            Map.entry("c", "C"),
            Map.entry("h", "C++"),
            Map.entry("hpp", "C++"),
            Map.entry("hh", "C++"),
            Map.entry("hxx", "C++"),
            Map.entry("cpp", "C++"),
            Map.entry("cc", "C++"),
            Map.entry("cxx", "C++"),
            Map.entry("cs", "C#"),
            Map.entry("php", "PHP"),
            Map.entry("swift", "Swift"),
            Map.entry("scala", "Scala"),
            Map.entry("sh", "Shell"),
            Map.entry("bash", "Shell"),
            Map.entry("zsh", "Shell"),
            Map.entry("html", "HTML"),
            Map.entry("htm", "HTML"),
            Map.entry("css", "CSS"),
            Map.entry("scss", "SCSS"),
            Map.entry("sass", "SCSS"),
            Map.entry("less", "Less"),
            Map.entry("vue", "Vue"),
            Map.entry("svelte", "Svelte"),
            Map.entry("md", "Markdown"),
            Map.entry("markdown", "Markdown"),
            Map.entry("json", "JSON"),
            Map.entry("yaml", "YAML"),
            Map.entry("yml", "YAML"),
            Map.entry("toml", "TOML"),
            Map.entry("xml", "XML"),
            Map.entry("sql", "SQL"),
            Map.entry("lua", "Lua"),
            Map.entry("dart", "Dart"),
            Map.entry("ex", "Elixir"),
            Map.entry("exs", "Elixir"),
            Map.entry("elm", "Elm"),
            Map.entry("erl", "Erlang"),
            Map.entry("clj", "Clojure"),
            Map.entry("cljs", "Clojure"),
            Map.entry("hs", "Haskell"),
            Map.entry("ml", "OCaml"),
            Map.entry("mli", "OCaml"),
            Map.entry("r", "R"),
            Map.entry("pl", "Perl"),
            Map.entry("vim", "Vim Script"),
            Map.entry("tf", "Terraform"),
            Map.entry("graphql", "GraphQL"),
            Map.entry("gql", "GraphQL"),
            Map.entry("groovy", "Groovy"),
            Map.entry("gradle", "Groovy"),
            Map.entry("ps1", "PowerShell"),
            Map.entry("bat", "Batch"),
            Map.entry("dockerfile", "Dockerfile"),
            Map.entry("proto", "Protobuf"),
            Map.entry("properties", "Config"),
            Map.entry("ini", "INI"),
            Map.entry("csv", "CSV")
    );

    private long lastActivityTime = 0;
    private String lastActivityFile = "";
    private IPartListener2 partListener;
    private IWorkbenchWindow window;
    private IEditorPart trackedEditor;
    private IDocument trackedDocument;
    private IDocumentListener documentListener;

    public void start() {
        try {
            window = PlatformUI.getWorkbench().getActiveWorkbenchWindow();
        } catch (IllegalStateException e) {
            // Workbench not started yet
            return;
        }
        if (window == null) return;

        partListener = new IPartListener2() {
            @Override
            public void partOpened(IWorkbenchPartReference ref) {
                trackActiveEditor();
            }

            @Override
            public void partActivated(IWorkbenchPartReference ref) {
                trackActiveEditor();
            }

            @Override
            public void partBroughtToTop(IWorkbenchPartReference ref) {
                trackActiveEditor();
            }

            @Override
            public void partInputChanged(IWorkbenchPartReference ref) {
                trackActiveEditor();
            }

            @Override public void partClosed(IWorkbenchPartReference ref) {
                if (ref.getPart(false) == trackedEditor) {
                    detachDocumentListener();
                    trackedEditor = null;
                }
            }
            @Override public void partDeactivated(IWorkbenchPartReference ref) {}
            @Override public void partHidden(IWorkbenchPartReference ref) {}
            @Override public void partVisible(IWorkbenchPartReference ref) {}
        };

        window.getPartService().addPartListener(partListener);
        trackActiveEditor();
    }

    public void stop() {
        if (window != null && partListener != null) {
            window.getPartService().removePartListener(partListener);
        }
        detachDocumentListener();
        trackedEditor = null;
    }

    private void trackActiveEditor() {
        if (window == null) return;
        IEditorPart editor = window.getActivePage() != null
                ? window.getActivePage().getActiveEditor()
                : null;
        if (editor == null) return;

        if (editor != trackedEditor) {
            attachDocumentListener(editor);
            trackedEditor = editor;
        }

        IEditorInput input = editor.getEditorInput();
        if (input == null) return;

        String filePath = null;
        try {
            var adapter = input.getAdapter(org.eclipse.core.resources.IFile.class);
            if (adapter instanceof org.eclipse.core.resources.IFile) {
                filePath = ((org.eclipse.core.resources.IFile) adapter).getLocation().toOSString();
            }
        } catch (Exception ignored) {}

        if (filePath == null) {
            // Fallback: use the editor input name
            String name = input.getName();
            if (name != null && !name.isEmpty()) {
                filePath = name;
            } else {
                return;
            }
        }

        String language = detectLanguage(filePath);
        sendActivity(filePath, language);
    }

    /**
     * Attaches a document listener to the given editor so that keystrokes —
     * not just editor switches — keep the activity stream alive. The core stops
     * emitting heartbeats after {@code ACTIVITY_TIMEOUT_MS} without an activity
     * message, so editing a single file must report activity as the user types.
     */
    private void attachDocumentListener(IEditorPart editor) {
        detachDocumentListener();
        if (!(editor instanceof ITextEditor)) return;
        ITextEditor textEditor = (ITextEditor) editor;
        IDocumentProvider provider = textEditor.getDocumentProvider();
        if (provider == null) return;
        IDocument document = provider.getDocument(textEditor.getEditorInput());
        if (document == null) return;

        documentListener = new IDocumentListener() {
            @Override
            public void documentAboutToBeChanged(DocumentEvent event) {}

            @Override
            public void documentChanged(DocumentEvent event) {
                trackActiveEditor();
            }
        };
        document.addDocumentListener(documentListener);
        trackedDocument = document;
    }

    private void detachDocumentListener() {
        if (trackedDocument != null && documentListener != null) {
            try {
                trackedDocument.removeDocumentListener(documentListener);
            } catch (Exception ignored) {}
        }
        trackedDocument = null;
        documentListener = null;
    }

    /** Detect language from file extension, mirroring JetBrains LanguageService. */
    static String detectLanguage(String filePath) {
        int dot = filePath.lastIndexOf('.');
        if (dot < 0 || dot == filePath.length() - 1) return null;
        String ext = filePath.substring(dot + 1).toLowerCase();
        String mapped = EXTENSION_MAP.get(ext);
        return mapped != null ? mapped : ext.substring(0, 1).toUpperCase() + ext.substring(1);
    }

    private void sendActivity(String filePath, String language) {
        long now = System.currentTimeMillis();

        if (filePath.equals(lastActivityFile) && (now - lastActivityTime) < DEDUP_WINDOW_MS) {
            return;
        }

        lastActivityTime = now;
        lastActivityFile = filePath;

        DevGlobeTracker.getInstance().sendActivity(filePath, language);
    }
}
