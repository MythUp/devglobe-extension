using System;
using System.Collections.Generic;

namespace DevGlobe
{
    /// <summary>
    /// Maps a language identifier to the canonical display name shown on the globe.
    /// VS does not expose a languageId, so <see cref="Map"/> accepts a VS content-type
    /// (e.g. "CSharp", "C/C++") OR a file extension (e.g. ".cs", "tsx") and returns the
    /// canonical name (e.g. "C#", "React TSX"), falling back to capitalizing the first
    /// letter for unknown identifiers.
    /// </summary>
    public static class LanguageMap
    {
        /// <summary>
        /// Canonical table shared with the other DevGlobe extensions.
        /// Key = language identifier, value = name displayed on the globe. Case-insensitive lookup.
        /// </summary>
        private static readonly Dictionary<string, string> LANG_MAP =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "javascript", "JavaScript" }, { "typescript", "TypeScript" },
            { "javascriptreact", "React JSX" }, { "typescriptreact", "React TSX" },
            { "vue", "Vue" }, { "svelte", "Svelte" }, { "astro", "Astro" }, { "angular", "Angular" },
            { "html", "HTML" }, { "css", "CSS" }, { "sass", "Sass" }, { "scss", "SCSS" },
            { "less", "Less" }, { "stylus", "Stylus" },
            { "graphql", "GraphQL" }, { "mdx", "MDX" },
            { "handlebars", "Handlebars" }, { "pug", "Pug" }, { "jade", "Pug" }, { "ejs", "EJS" },
            { "erb", "ERB" }, { "haml", "Haml" }, { "twig", "Twig" }, { "blade", "Blade" },
            { "django-html", "Django" }, { "jinja", "Jinja" }, { "liquid", "Liquid" },
            { "mustache", "Mustache" }, { "razor", "Razor" }, { "nunjucks", "Nunjucks" },
            { "c", "C" }, { "cpp", "C++" }, { "rust", "Rust" }, { "go", "Go" }, { "zig", "Zig" },
            { "d", "D" }, { "v", "V" }, { "odin", "Odin" }, { "carbon", "Carbon" }, { "mojo", "Mojo" },
            { "java", "Java" }, { "kotlin", "Kotlin" }, { "scala", "Scala" }, { "groovy", "Groovy" },
            { "csharp", "C#" }, { "fsharp", "F#" }, { "vb", "Visual Basic" },
            { "python", "Python" }, { "ruby", "Ruby" }, { "php", "PHP" }, { "lua", "Lua" },
            { "perl", "Perl" }, { "r", "R" }, { "julia", "Julia" }, { "matlab", "MATLAB" },
            { "swift", "Swift" }, { "dart", "Dart" }, { "objective-c", "Objective-C" },
            { "objective-cpp", "Objective-C++" },
            { "haskell", "Haskell" }, { "elixir", "Elixir" }, { "erlang", "Erlang" },
            { "ocaml", "OCaml" }, { "elm", "Elm" }, { "purescript", "PureScript" },
            { "clojure", "Clojure" }, { "racket", "Racket" }, { "scheme", "Scheme" },
            { "commonlisp", "Common Lisp" }, { "prolog", "Prolog" },
            { "gleam", "Gleam" }, { "roc", "Roc" }, { "idris", "Idris" }, { "agda", "Agda" },
            { "lean", "Lean" }, { "coq", "Coq" },
            { "nim", "Nim" }, { "crystal", "Crystal" }, { "haxe", "Haxe" },
            { "ada", "Ada" }, { "fortran", "Fortran" }, { "pascal", "Pascal" }, { "cobol", "COBOL" },
            { "vhdl", "VHDL" }, { "verilog", "Verilog" }, { "systemverilog", "SystemVerilog" },
            { "asm", "Assembly" }, { "arm64", "ARM64" }, { "cuda", "CUDA" },
            { "glsl", "GLSL" }, { "hlsl", "HLSL" }, { "wgsl", "WGSL" }, { "metal", "Metal" },
            { "shaderlab", "ShaderLab" },
            { "shellscript", "Bash" }, { "powershell", "PowerShell" }, { "fish", "Fish" },
            { "bat", "Batch" },
            { "terraform", "Terraform" }, { "bicep", "Bicep" }, { "pulumi", "Pulumi" },
            { "nix", "Nix" }, { "ansible", "Ansible" }, { "puppet", "Puppet" },
            { "dockerfile", "Docker" }, { "docker-compose", "Docker Compose" },
            { "makefile", "Makefile" }, { "cmake", "CMake" }, { "just", "Just" }, { "meson", "Meson" },
            { "sql", "SQL" }, { "plsql", "PL/SQL" }, { "mysql", "MySQL" }, { "pgsql", "PostgreSQL" },
            { "mongodb", "MongoDB" }, { "redis", "Redis" }, { "cypher", "Cypher" },
            { "sparql", "SPARQL" }, { "prisma", "Prisma" },
            { "solidity", "Solidity" }, { "vyper", "Vyper" }, { "move", "Move" }, { "cairo", "Cairo" },
            { "gdscript", "GDScript" }, { "gdresource", "Godot Resource" },
            { "gdshader", "Godot Shader" },
            { "json", "JSON" }, { "jsonc", "JSON" }, { "jsonnet", "Jsonnet" },
            { "yaml", "YAML" }, { "toml", "TOML" }, { "xml", "XML" }, { "ini", "INI" },
            { "dotenv", "Config" }, { "properties", "Config" },
            { "csv", "CSV" }, { "tsv", "TSV" },
            { "cue", "CUE" }, { "dhall", "Dhall" }, { "pkl", "Pkl" },
            { "proto", "Protobuf" }, { "protobuf", "Protobuf" }, { "thrift", "Thrift" },
            { "avro", "Avro" },
            { "markdown", "Markdown" }, { "restructuredtext", "reStructuredText" },
            { "latex", "LaTeX" }, { "tex", "LaTeX" }, { "bibtex", "BibTeX" }, { "typst", "Typst" },
            { "asciidoc", "AsciiDoc" }, { "plaintext", "Plain Text" },
            { "coffeescript", "CoffeeScript" }, { "tcl", "Tcl" }, { "awk", "AWK" }, { "sed", "Sed" },
            { "regex", "Regex" }, { "diff", "Diff" }, { "git-commit", "Git Commit" },
            { "git-rebase", "Git Rebase" },
            { "ignore", "Gitignore" }, { "editorconfig", "EditorConfig" },
            { "http", "HTTP" }, { "ssh_config", "SSH Config" },
            { "log", "Log" },
        };

        /// <summary>
        /// Visual Studio content-type (IContentType.TypeName) -> LANG_MAP key.
        /// Only covers content-types whose name differs from a canonical key. Any content-type
        /// that already matches a LANG_MAP key (e.g. "JavaScript", "TypeScript", "F#") is
        /// resolved by the direct lookup and needs no alias.
        /// </summary>
        private static readonly Dictionary<string, string> CONTENT_TYPE_ALIASES =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "csharp", "csharp" },
            { "c/c++", "cpp" },
            { "basic", "vb" },             // "Basic" -> Visual Basic
            { "htmlx", "html" },           // VS HTML editor
            { "razor", "razor" },
            { "css", "css" },
            { "less", "less" },
            { "scss", "scss" },
            { "json", "json" },
            { "jade", "pug" },
            { "xaml", "xml" },             // XAML rendered as XML on the globe
            { "code++.fortran", "fortran" },
            { "plain text", "plaintext" },
        };

        /// <summary>
        /// File extension (no leading dot, lowercase) -> LANG_MAP key.
        /// Used when the VS content-type is absent or generic ("plaintext").
        /// </summary>
        private static readonly Dictionary<string, string> EXTENSION_ALIASES =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "cs", "csharp" }, { "csx", "csharp" },
            { "vb", "vb" },
            { "fs", "fsharp" }, { "fsx", "fsharp" }, { "fsi", "fsharp" },
            { "ts", "typescript" }, { "mts", "typescript" }, { "cts", "typescript" },
            { "tsx", "typescriptreact" },
            { "js", "javascript" }, { "mjs", "javascript" }, { "cjs", "javascript" },
            { "jsx", "javascriptreact" },
            { "vue", "vue" }, { "svelte", "svelte" }, { "astro", "astro" },
            { "razor", "razor" }, { "cshtml", "razor" }, { "vbhtml", "razor" },
            { "html", "html" }, { "htm", "html" },
            { "css", "css" }, { "scss", "scss" }, { "sass", "sass" }, { "less", "less" },
            { "c", "c" }, { "h", "c" },
            { "cpp", "cpp" }, { "cc", "cpp" }, { "cxx", "cpp" }, { "hpp", "cpp" },
            { "hh", "cpp" }, { "hxx", "cpp" }, { "ino", "cpp" },
            { "rs", "rust" }, { "go", "go" }, { "zig", "zig" },
            { "java", "java" }, { "kt", "kotlin" }, { "kts", "kotlin" },
            { "scala", "scala" }, { "groovy", "groovy" },
            { "py", "python" }, { "pyw", "python" }, { "pyi", "python" },
            { "rb", "ruby" }, { "php", "php" }, { "lua", "lua" }, { "pl", "perl" }, { "pm", "perl" },
            { "r", "r" }, { "jl", "julia" }, { "m", "matlab" },
            { "swift", "swift" }, { "dart", "dart" },
            { "hs", "haskell" }, { "ex", "elixir" }, { "exs", "elixir" },
            { "erl", "erlang" }, { "ml", "ocaml" }, { "elm", "elm" }, { "clj", "clojure" },
            { "nim", "nim" }, { "cr", "crystal" }, { "hx", "haxe" },
            { "json", "json" }, { "jsonc", "jsonc" },
            { "yaml", "yaml" }, { "yml", "yaml" }, { "toml", "toml" },
            { "xml", "xml" }, { "xaml", "xml" }, { "ini", "ini" },
            { "sql", "sql" }, { "graphql", "graphql" }, { "gql", "graphql" },
            { "sh", "shellscript" }, { "bash", "shellscript" }, { "zsh", "shellscript" },
            { "ps1", "powershell" }, { "psm1", "powershell" },
            { "bat", "bat" }, { "cmd", "bat" },
            { "tf", "terraform" }, { "bicep", "bicep" },
            { "dockerfile", "dockerfile" },
            { "md", "markdown" }, { "markdown", "markdown" }, { "mdx", "mdx" },
            { "tex", "latex" }, { "proto", "proto" },
            { "txt", "plaintext" }, { "log", "log" },
        };

        /// <summary>
        /// Maps a Visual Studio content-type or file extension to the canonical name.
        /// Returns string.Empty for a null/empty input; for an unknown input, returns the
        /// input with its first letter capitalized.
        /// </summary>
        public static string Map(string contentTypeOrExtension)
        {
            if (string.IsNullOrWhiteSpace(contentTypeOrExtension))
            {
                return string.Empty;
            }

            // Normalize: trim and strip a leading dot (extension ".cs" -> "cs").
            string raw = contentTypeOrExtension.Trim();
            string key = raw.StartsWith(".", StringComparison.Ordinal) ? raw.Substring(1) : raw;

            // VS content-type alias -> canonical key.
            if (CONTENT_TYPE_ALIASES.TryGetValue(key, out string viaContentType) &&
                LANG_MAP.TryGetValue(viaContentType, out string nameFromContentType))
            {
                return nameFromContentType;
            }

            // File extension alias -> canonical key.
            if (EXTENSION_ALIASES.TryGetValue(key, out string viaExtension) &&
                LANG_MAP.TryGetValue(viaExtension, out string nameFromExtension))
            {
                return nameFromExtension;
            }

            // Direct lookup (the input is already a canonical key, e.g. "javascript").
            if (LANG_MAP.TryGetValue(key, out string direct))
            {
                return direct;
            }

            // Fallback: capitalize the first letter, leave the rest unchanged.
            return char.ToUpperInvariant(raw[0]) + raw.Substring(1);
        }
    }
}
