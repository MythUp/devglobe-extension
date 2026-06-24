using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DevGlobe
{
    /// <summary>
    /// Bootstraps the core binary, caching it at
    /// %LOCALAPPDATA%\DevGlobe\core\&lt;CoreTag&gt;\devglobe-core-win-x64.exe.
    /// If absent, resolves the pinned GitHub release, downloads the asset, writes the cache,
    /// and purges old versions.
    /// </summary>
    public static class CoreBootstrap
    {
        public const string CoreRepo = "Nako0/devglobe-extension";
        // Pinned; bump manually when a new core is published.
        public const string CoreTag = "core-v2.0.0";
        public const string AssetName = "devglobe-core-win-x64.exe";

        // Cache subtree under %LOCALAPPDATA%.
        private const string CacheVendorDir = "DevGlobe";
        private const string CacheCoreDir = "core";

        // Combined timeout for download plus metadata; the binary is tens of MB.
        private static readonly TimeSpan HttpTimeout = TimeSpan.FromMinutes(5);

        // Single reused HttpClient to avoid socket exhaustion.
        private static readonly HttpClient Http = CreateHttpClient();

        private static HttpClient CreateHttpClient()
        {
            var client = new HttpClient { Timeout = HttpTimeout };
            // GitHub requires a User-Agent; Accept json for the releases API.
            client.DefaultRequestHeaders.UserAgent.ParseAdd("DevGlobe-VisualStudio");
            client.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
            return client;
        }

        /// <summary>
        /// Resolves the cache path &lt;rootLocalAppData&gt;\DevGlobe\core\&lt;CoreTag&gt;\&lt;AssetName&gt;.
        /// </summary>
        public static string ResolveCachePath(string rootLocalAppData)
        {
            if (string.IsNullOrEmpty(rootLocalAppData))
                throw new ArgumentException("rootLocalAppData must not be empty", nameof(rootLocalAppData));

            return Path.Combine(rootLocalAppData, CacheVendorDir, CacheCoreDir, CoreTag, AssetName);
        }

        /// <summary>
        /// Ensures the core binary is cached and returns its absolute path, downloading from
        /// GitHub Releases on first run. Throws with a clear message on failure.
        /// </summary>
        public static async Task<string> EnsureBinaryAsync(CancellationToken ct)
        {
            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (string.IsNullOrEmpty(localAppData))
                throw new InvalidOperationException("Could not resolve %LOCALAPPDATA% for the core cache.");

            var cachePath = ResolveCachePath(localAppData);

            // Fast path: already cached.
            if (File.Exists(cachePath))
            {
                Log.Info("CoreBootstrap: binary already cached", new { path = cachePath });
                return cachePath;
            }

            Log.Info("CoreBootstrap: binary missing, downloading from GitHub",
                new { repo = CoreRepo, tag = CoreTag, asset = AssetName });

            var versionDir = Path.GetDirectoryName(cachePath)!;
            Directory.CreateDirectory(versionDir);

            // Purge old versions before writing the new one (best-effort).
            PurgeOldVersions(Path.Combine(localAppData, CacheVendorDir, CacheCoreDir), keepDir: versionDir);

            var downloadUrl = await ResolveAssetUrlAsync(ct).ConfigureAwait(false);
            await DownloadToAsync(downloadUrl, cachePath, ct).ConfigureAwait(false);

            Log.Info("CoreBootstrap: binary ready", new { path = cachePath });
            return cachePath;
        }

        /// <summary>
        /// Queries the GitHub releases API for the pinned tag and returns the
        /// browser_download_url of AssetName.
        /// </summary>
        private static async Task<string> ResolveAssetUrlAsync(CancellationToken ct)
        {
            var apiUrl = $"https://api.github.com/repos/{CoreRepo}/releases/tags/{CoreTag}";

            string json;
            try
            {
                using var resp = await Http.GetAsync(apiUrl, ct).ConfigureAwait(false);
                if (!resp.IsSuccessStatusCode)
                {
                    throw new InvalidOperationException(
                        $"GitHub API returned {(int)resp.StatusCode} {resp.ReasonPhrase} for release '{CoreTag}'.");
                }
                json = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex) when (ex is HttpRequestException || ex is TaskCanceledException)
            {
                throw new InvalidOperationException(
                    $"Failed to reach GitHub to resolve the DevGlobe core release '{CoreTag}'. " +
                    "Check your network connection and try again.", ex);
            }

            string? downloadUrl = null;
            try
            {
                var root = JObject.Parse(json);
                if (root["assets"] is JArray assets)
                {
                    foreach (var asset in assets)
                    {
                        if (string.Equals((string?)asset["name"], AssetName, StringComparison.Ordinal))
                        {
                            downloadUrl = (string?)asset["browser_download_url"];
                            break;
                        }
                    }
                }
            }
            catch (JsonException ex)
            {
                throw new InvalidOperationException(
                    $"Could not parse the GitHub release metadata for '{CoreTag}'.", ex);
            }

            if (string.IsNullOrEmpty(downloadUrl))
            {
                throw new InvalidOperationException(
                    $"Asset '{AssetName}' was not found in the GitHub release '{CoreTag}'.");
            }

            return downloadUrl!;
        }

        /// <summary>
        /// Downloads the asset to a temp file then moves it into destPath, avoiding a
        /// half-written binary if the IDE closes mid-download.
        /// </summary>
        private static async Task DownloadToAsync(string url, string destPath, CancellationToken ct)
        {
            var tmpPath = destPath + ".download";

            try
            {
                using (var resp = await Http
                    .GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct)
                    .ConfigureAwait(false))
                {
                    if (!resp.IsSuccessStatusCode)
                    {
                        throw new InvalidOperationException(
                            $"Download of '{AssetName}' failed with {(int)resp.StatusCode} {resp.ReasonPhrase}.");
                    }

                    using var src = await resp.Content.ReadAsStreamAsync().ConfigureAwait(false);
                    using var dst = new FileStream(
                        tmpPath, FileMode.Create, FileAccess.Write, FileShare.None,
                        bufferSize: 81920, useAsync: true);
                    await src.CopyToAsync(dst, 81920, ct).ConfigureAwait(false);
                }

                if (File.Exists(destPath))
                    File.Delete(destPath);
                File.Move(tmpPath, destPath);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                TryDelete(tmpPath);
                throw;
            }
            catch (Exception ex) when (ex is HttpRequestException || ex is TaskCanceledException || ex is IOException)
            {
                TryDelete(tmpPath);
                throw new InvalidOperationException(
                    $"Failed to download the DevGlobe core binary from '{url}'. " +
                    "Check your network connection and try again.", ex);
            }
        }

        /// <summary>
        /// Deletes version folders other than keepDir under the core cache dir (best-effort:
        /// an error here must not fail the bootstrap).
        /// </summary>
        private static void PurgeOldVersions(string coreCacheDir, string keepDir)
        {
            try
            {
                if (!Directory.Exists(coreCacheDir))
                    return;

                var keepFull = Path.GetFullPath(keepDir);
                foreach (var dir in Directory.GetDirectories(coreCacheDir))
                {
                    if (string.Equals(Path.GetFullPath(dir), keepFull, StringComparison.OrdinalIgnoreCase))
                        continue;
                    try
                    {
                        Directory.Delete(dir, recursive: true);
                        Log.Info("CoreBootstrap: purged old core version", new { dir });
                    }
                    catch (Exception ex)
                    {
                        Log.Warn("CoreBootstrap: could not purge old core version", new { dir, error = ex.Message });
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Warn("CoreBootstrap: purge step failed", new { error = ex.Message });
            }
        }

        private static void TryDelete(string path)
        {
            try
            {
                if (File.Exists(path))
                    File.Delete(path);
            }
            catch
            {
                // best-effort
            }
        }
    }
}
