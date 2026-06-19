package xyz.devglobe.eclipse.core;

import java.util.HashMap;
import java.util.Map;

/**
 * Detects the programming language from an Eclipse content type name.
 * Extension-based detection is delegated to devglobe-core.
 */
public final class LanguageService {

    private static final Map<String, String> CONTENT_TYPE_MAP = new HashMap<>();

    static {
        // Content type name mapping (Eclipse-specific)
        CONTENT_TYPE_MAP.put("org.eclipse.jdt.core.javaSource", "Java");
        CONTENT_TYPE_MAP.put("org.eclipse.wst.css.core.csssource", "CSS");
        CONTENT_TYPE_MAP.put("org.eclipse.wst.html.core.htmlsource", "HTML");
        CONTENT_TYPE_MAP.put("org.eclipse.wst.jsdt.core.jsSource", "JavaScript");
        CONTENT_TYPE_MAP.put("org.eclipse.wst.xml.core.xmlsource", "XML");
        CONTENT_TYPE_MAP.put("org.eclipse.wst.json.core.jsonsource", "JSON");
        CONTENT_TYPE_MAP.put("org.eclipse.cdt.core.cSource", "C");
        CONTENT_TYPE_MAP.put("org.eclipse.cdt.core.cHeader", "C");
        CONTENT_TYPE_MAP.put("org.eclipse.cdt.core.cppSource", "C++");
        CONTENT_TYPE_MAP.put("org.eclipse.cdt.core.cppHeader", "C++");
        CONTENT_TYPE_MAP.put("org.eclipse.php.core.phpSource", "PHP");
        CONTENT_TYPE_MAP.put("org.python.pydev.python", "Python");
        CONTENT_TYPE_MAP.put("org.rubypeople.rdt.core.ruby", "Ruby");
        CONTENT_TYPE_MAP.put("org.scala-ide.sdt.core.scala", "Scala");
        CONTENT_TYPE_MAP.put("org.eclipse.rust.core.rust", "Rust");
        CONTENT_TYPE_MAP.put("org.eclipse.dart.core.dart", "Dart");
        CONTENT_TYPE_MAP.put("org.eclipse.kotlin.core.kotlin", "Kotlin");
        CONTENT_TYPE_MAP.put("org.eclipse.go.core.go", "Go");
    }

    private LanguageService() {}

    /**
     * Detect the language from a file's extension.
     * Returns null to delegate extension-based detection to devglobe-core.
     */
    public static String detectLanguage(String filePath) {
        // Delegate to devglobe-core which has the complete language mapping
        return null;
    }

    /**
     * Detect the language from an Eclipse content type ID.
     */
    public static String detectFromContentType(String contentTypeId) {
        if (contentTypeId == null || contentTypeId.isEmpty()) return null;
        return CONTENT_TYPE_MAP.get(contentTypeId);
    }
}
