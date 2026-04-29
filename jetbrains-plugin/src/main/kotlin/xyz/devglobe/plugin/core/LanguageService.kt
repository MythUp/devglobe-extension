package xyz.devglobe.plugin.core

import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.wm.WindowManager

object LanguageService {

    fun detectLanguage(file: VirtualFile): String? {
        val typeName = file.fileType.name
        if (typeName.isNotBlank() && !isGenericFileType(typeName)) return typeName
        return file.extension?.let(::extensionToLanguage)
    }

    fun getFocusedProject(): Project? =
        ProjectManager.getInstance().openProjects.firstOrNull { project ->
            WindowManager.getInstance().getFrame(project)?.isActive == true
        }

    private fun isGenericFileType(name: String): Boolean = when (name.lowercase()) {
        "textmate", "plain_text", "unknown" -> true
        else -> false
    }

    private fun extensionToLanguage(ext: String): String? = when (ext.lowercase()) {
        "ts" -> "TypeScript"
        "tsx" -> "TypeScript JSX"
        "js" -> "JavaScript"
        "jsx" -> "JavaScript JSX"
        "mjs", "cjs" -> "JavaScript"
        "py" -> "Python"
        "rb" -> "Ruby"
        "go" -> "Go"
        "rs" -> "Rust"
        "java" -> "Java"
        "kt", "kts" -> "Kotlin"
        "c" -> "C"
        "h", "hpp", "hh", "hxx" -> "C++"
        "cpp", "cc", "cxx" -> "C++"
        "cs" -> "C#"
        "php" -> "PHP"
        "swift" -> "Swift"
        "scala" -> "Scala"
        "sh", "bash", "zsh" -> "Shell"
        "html", "htm" -> "HTML"
        "css" -> "CSS"
        "scss", "sass" -> "SCSS"
        "less" -> "Less"
        "vue" -> "Vue"
        "svelte" -> "Svelte"
        "md", "markdown" -> "Markdown"
        "json" -> "JSON"
        "yaml", "yml" -> "YAML"
        "toml" -> "TOML"
        "xml" -> "XML"
        "sql" -> "SQL"
        "lua" -> "Lua"
        "dart" -> "Dart"
        "ex", "exs" -> "Elixir"
        "elm" -> "Elm"
        "erl" -> "Erlang"
        "clj", "cljs" -> "Clojure"
        "hs" -> "Haskell"
        "ml", "mli" -> "OCaml"
        "r" -> "R"
        "pl" -> "Perl"
        "vim" -> "Vim Script"
        "dockerfile" -> "Dockerfile"
        "tf" -> "Terraform"
        "graphql", "gql" -> "GraphQL"
        else -> ext.uppercase()
    }
}
