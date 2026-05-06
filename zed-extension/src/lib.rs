use std::fs;
use zed_extension_api::{self as zed, Command, LanguageServerId, Result, Worktree};

const CORE_VERSION: &str = "2.0.0";
const CORE_REPO: &str = "Nako0/devglobe-extension";

struct DevGlobeExtension {
    cached_binary_path: Option<String>,
}

impl DevGlobeExtension {
    fn target_suffix(&self) -> Result<String> {
        let (platform, arch) = zed::current_platform();
        let suffix = match (platform, arch) {
            (zed::Os::Mac, zed::Architecture::Aarch64) => "darwin-arm64",
            (zed::Os::Mac, zed::Architecture::X8664) => "darwin-x64",
            (zed::Os::Linux, zed::Architecture::X8664) => "linux-x64",
            (zed::Os::Linux, zed::Architecture::Aarch64) => "linux-arm64",
            (zed::Os::Windows, zed::Architecture::X8664) => "win-x64.exe",
            _ => return Err(format!("unsupported platform: {platform:?} {arch:?}")),
        };
        Ok(suffix.to_string())
    }

    fn binary_path(&mut self, language_server_id: &LanguageServerId) -> Result<String> {
        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        if let Some(path) = &self.cached_binary_path {
            if fs::metadata(path).is_ok_and(|stat| stat.is_file()) {
                return Ok(path.clone());
            }
        }

        let suffix = self.target_suffix()?;
        let binary_name = format!("devglobe-core-{suffix}");
        let version_dir = format!("devglobe-core-{CORE_VERSION}");
        let binary_path = format!("{version_dir}/{binary_name}");

        if !fs::metadata(&binary_path).is_ok_and(|stat| stat.is_file()) {
            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::Downloading,
            );

            // Remove older versions before downloading the new one.
            if let Ok(entries) = fs::read_dir(".") {
                for entry in entries.flatten() {
                    if let Some(file_name) = entry.file_name().to_str() {
                        if file_name.starts_with("devglobe-core-") && file_name != version_dir {
                            fs::remove_dir_all(entry.path()).ok();
                        }
                    }
                }
            }

            fs::create_dir_all(&version_dir)
                .map_err(|err| format!("failed to create version directory: {err}"))?;

            let url = format!(
                "https://github.com/{CORE_REPO}/releases/download/core-v{CORE_VERSION}/{binary_name}"
            );

            zed::download_file(&url, &binary_path, zed::DownloadedFileType::Uncompressed)
                .map_err(|err| format!("failed to download core binary: {err}"))?;

            zed::make_file_executable(&binary_path)?;
        }

        self.cached_binary_path = Some(binary_path.clone());
        Ok(binary_path)
    }
}

impl zed::Extension for DevGlobeExtension {
    fn new() -> Self {
        Self {
            cached_binary_path: None,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<Command> {
        let binary = self.binary_path(language_server_id)?;
        Ok(Command {
            command: binary,
            args: vec!["lsp".to_string()],
            env: worktree.shell_env(),
        })
    }
}

zed::register_extension!(DevGlobeExtension);
