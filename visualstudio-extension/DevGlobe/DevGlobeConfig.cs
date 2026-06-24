using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;

namespace DevGlobe
{
    /// <summary>
    /// Manages DevGlobe configuration: the ~/.devglobe paths, reading/writing config.toml
    /// (api_key, debug, [privacy]) in a simple TOML format, and storing the secret in the
    /// Windows Credential Manager.
    ///
    /// Parsing rule: api_key and debug are read/written only until a [section] header is
    /// reached (`beforeSection`).
    /// </summary>
    public static class DevGlobeConfig
    {
        private const string TargetName = "DevGlobe:api_key";

        // ---- Paths ---------------------------------------------------------

        /// <summary>%USERPROFILE%\.devglobe (HOME sur POSIX).</summary>
        public static string DevGlobeDir =>
            Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".devglobe");

        /// <summary>%USERPROFILE%\.devglobe\config.toml</summary>
        public static string ConfigPath => Path.Combine(DevGlobeDir, "config.toml");

        /// <summary>%USERPROFILE%\.devglobe\devglobe.log</summary>
        public static string LogPath => Path.Combine(DevGlobeDir, "devglobe.log");

        // ---- api_key -------------------------------------------------------

        private static readonly Regex ApiKeyLine =
            new Regex("^api_key\\s*=\\s*\"([^\"]*)\"", RegexOptions.Compiled);

        /// <summary>
        /// Reads api_key from the section-less area of config.toml. Returns null if absent/empty.
        /// </summary>
        public static string? ReadApiKey()
        {
            if (!File.Exists(ConfigPath)) return null;

            var beforeSection = true;
            foreach (var rawLine in File.ReadAllLines(ConfigPath))
            {
                var line = rawLine.Trim();
                if (line.StartsWith("[")) beforeSection = false;
                if (!beforeSection) continue;

                var m = ApiKeyLine.Match(line);
                if (m.Success)
                {
                    var key = m.Groups[1].Value;
                    Log.Info("config api_key read", new { exists = true, length = key.Length });
                    return string.IsNullOrEmpty(key) ? null : key;
                }
            }

            Log.Info("config api_key read", new { exists = false });
            return null;
        }

        /// <summary>
        /// Writes/replaces the section-less api_key, preserving the rest of the file.
        /// </summary>
        public static void WriteApiKey(string key)
        {
            EnsureDir();

            var lines = ReadExistingLines();
            var updated = new List<string>();
            var inserted = false;
            var beforeSection = true;

            foreach (var rawLine in lines)
            {
                var line = rawLine.Trim();
                if (line.StartsWith("[")) beforeSection = false;

                if (beforeSection && line.StartsWith("api_key"))
                {
                    updated.Add($"api_key = \"{key}\"");
                    inserted = true;
                }
                else
                {
                    updated.Add(rawLine);
                }
            }

            if (!inserted) updated.Insert(0, $"api_key = \"{key}\"");

            WriteAllLinesRestricted(updated);
            Log.Info("config api_key written", new { length = key.Length });
        }

        /// <summary>Removes the section-less api_key line.</summary>
        public static void ClearApiKey()
        {
            if (!File.Exists(ConfigPath)) return;

            var updated = new List<string>();
            var beforeSection = true;
            foreach (var rawLine in ReadExistingLines())
            {
                var line = rawLine.Trim();
                if (line.StartsWith("[")) beforeSection = false;
                if (beforeSection && line.StartsWith("api_key")) continue;
                updated.Add(rawLine);
            }

            WriteAllLinesRestricted(updated);
            Log.Info("config api_key cleared");
        }

        // ---- debug ---------------------------------------------------------

        private static readonly Regex DebugLine =
            new Regex("^debug\\s*=\\s*(true|false)", RegexOptions.Compiled);

        /// <summary>True if debug = true in the section-less area.</summary>
        public static bool IsDebugEnabled()
        {
            if (!File.Exists(ConfigPath)) return false;

            var beforeSection = true;
            foreach (var rawLine in File.ReadAllLines(ConfigPath))
            {
                var line = rawLine.Trim();
                if (line.StartsWith("[")) beforeSection = false;
                if (!beforeSection) continue;

                var m = DebugLine.Match(line);
                if (m.Success) return m.Groups[1].Value == "true";
            }
            return false;
        }

        /// <summary>
        /// Enables/disables debug. When enabled, inserts "debug = true" (after api_key if present).
        /// When disabled, removes any section-less debug line.
        /// </summary>
        public static void SetDebug(bool enabled)
        {
            EnsureDir();

            var lines = ReadExistingLines();
            var updated = new List<string>();
            var inserted = false;
            var beforeSection = true;

            foreach (var rawLine in lines)
            {
                var line = rawLine.Trim();
                if (line.StartsWith("[")) beforeSection = false;

                if (beforeSection && line.StartsWith("debug"))
                {
                    if (enabled) updated.Add("debug = true");
                    // when disabled: omit the line (= default)
                    inserted = true;
                }
                else
                {
                    updated.Add(rawLine);
                }
            }

            if (!inserted && enabled)
            {
                var apiKeyIdx = updated.FindIndex(l => l.Trim().StartsWith("api_key"));
                if (apiKeyIdx >= 0) updated.Insert(apiKeyIdx + 1, "debug = true");
                else updated.Insert(0, "debug = true");
            }

            WriteAllLinesRestricted(updated);
        }

        // ---- Internal TOML I/O --------------------------------------------

        private static void EnsureDir()
        {
            if (!Directory.Exists(DevGlobeDir)) Directory.CreateDirectory(DevGlobeDir);
        }

        private static IReadOnlyList<string> ReadExistingLines()
        {
            if (!File.Exists(ConfigPath)) return Array.Empty<string>();
            // Split on '\n' (not ReadAllLines) to preserve the content faithfully.
            var content = File.ReadAllText(ConfigPath);
            return content.Split('\n');
        }

        /// <summary>
        /// Writes the lines, collapsing triple newlines, guarantees a trailing '\n',
        /// then restricts permissions to the owner.
        /// </summary>
        private static void WriteAllLinesRestricted(IReadOnlyList<string> lines)
        {
            EnsureDir();

            var output = string.Join("\n", lines);
            output = Regex.Replace(output, "\\n{3,}", "\n\n");
            if (!output.EndsWith("\n")) output += "\n";

            File.WriteAllText(ConfigPath, output, new UTF8Encoding(false));
            RestrictToOwner(ConfigPath);
        }

        /// <summary>
        /// Windows equivalent of mode 0600: NTFS ACL without inheritance, granting full control
        /// to the current owner only. On POSIX: chmod 600 via reflection, since
        /// File.SetUnixFileMode does not exist on net472.
        /// </summary>
        private static void RestrictToOwner(string path)
        {
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    var fileInfo = new FileInfo(path);
                    var security = fileInfo.GetAccessControl();
                    security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);

                    var owner = WindowsIdentity.GetCurrent().User;
                    if (owner != null)
                    {
                        // Purge existing rules, then add the owner only.
                        var rules = security.GetAccessRules(true, false, typeof(SecurityIdentifier));
                        foreach (FileSystemAccessRule r in rules)
                            security.RemoveAccessRule(r);

                        security.AddAccessRule(new FileSystemAccessRule(
                            owner,
                            FileSystemRights.FullControl,
                            AccessControlType.Allow));

                        fileInfo.SetAccessControl(security);
                    }
                }
                else
                {
                    // POSIX: chmod 600 via reflection to stay compilable on net472.
                    var modeType = Type.GetType("System.IO.UnixFileMode");
                    if (modeType != null)
                    {
                        var setMode = typeof(File).GetMethod("SetUnixFileMode",
                            new Type[] { typeof(string), modeType });
                        if (setMode != null)
                        {
                            // 0600 = UserRead | UserWrite = 0x100 | 0x80 = 384.
                            var mode = Enum.ToObject(modeType, 384);
                            setMode.Invoke(null, new object[] { path, mode });
                        }
                    }
                }
            }
            catch
            {
                // Permission restriction is best-effort: it must never block the write.
            }
        }

        // ---- Windows Credential Manager (P/Invoke) ------------------------

        private const int CRED_TYPE_GENERIC = 1;
        private const int CRED_PERSIST_LOCAL_MACHINE = 2;

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct CREDENTIAL
        {
            public int Flags;
            public int Type;
            public IntPtr TargetName;
            public IntPtr Comment;
            public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
            public int CredentialBlobSize;
            public IntPtr CredentialBlob;
            public int Persist;
            public int AttributeCount;
            public IntPtr Attributes;
            public IntPtr TargetAlias;
            public IntPtr UserName;
        }

        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode, EntryPoint = "CredWriteW")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CredWrite([In] ref CREDENTIAL credential, [In] uint flags);

        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode, EntryPoint = "CredReadW")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode, EntryPoint = "CredDeleteW")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CredDelete(string target, int type, int flags);

        [DllImport("advapi32.dll", EntryPoint = "CredFree")]
        private static extern void CredFree([In] IntPtr buffer);

        /// <summary>Stores (or replaces) the API key in the Windows Credential Manager.</summary>
        public static void StoreSecret(string key)
        {
            var blob = Encoding.Unicode.GetBytes(key ?? string.Empty);
            var blobPtr = Marshal.AllocHGlobal(blob.Length);
            var targetPtr = Marshal.StringToHGlobalUni(TargetName);
            try
            {
                Marshal.Copy(blob, 0, blobPtr, blob.Length);
                var cred = new CREDENTIAL
                {
                    Type = CRED_TYPE_GENERIC,
                    TargetName = targetPtr,
                    CredentialBlobSize = blob.Length,
                    CredentialBlob = blobPtr,
                    Persist = CRED_PERSIST_LOCAL_MACHINE,
                    AttributeCount = 0,
                    Attributes = IntPtr.Zero,
                    Comment = IntPtr.Zero,
                    TargetAlias = IntPtr.Zero,
                    UserName = IntPtr.Zero,
                };

                if (!CredWrite(ref cred, 0))
                {
                    var err = Marshal.GetLastWin32Error();
                    Log.Warn("CredWrite failed", new { error = err });
                }
            }
            finally
            {
                Marshal.FreeHGlobal(blobPtr);
                Marshal.FreeHGlobal(targetPtr);
            }
        }

        /// <summary>Reads the API key from the Credential Manager, or null if absent.</summary>
        public static string? GetSecret()
        {
            if (!CredRead(TargetName, CRED_TYPE_GENERIC, 0, out var credPtr))
                return null;

            try
            {
                var cred = Marshal.PtrToStructure<CREDENTIAL>(credPtr);
                if (cred.CredentialBlobSize == 0 || cred.CredentialBlob == IntPtr.Zero)
                    return null;

                var bytes = new byte[cred.CredentialBlobSize];
                Marshal.Copy(cred.CredentialBlob, bytes, 0, cred.CredentialBlobSize);
                return Encoding.Unicode.GetString(bytes);
            }
            finally
            {
                CredFree(credPtr);
            }
        }

        /// <summary>Removes the API key from the Credential Manager (no-op if absent).</summary>
        public static void DeleteSecret()
        {
            if (!CredDelete(TargetName, CRED_TYPE_GENERIC, 0))
            {
                var err = Marshal.GetLastWin32Error();
                // 1168 = ERROR_NOT_FOUND: already absent, non-fatal.
                if (err != 1168) Log.Warn("CredDelete failed", new { error = err });
            }
        }

        // ---- tracking_enabled ----------------------------------------------

        /// <summary>
        /// Reads tracking_enabled from config.toml (root section). Absent means true.
        /// Same parsing as ReadApiKey/IsDebugEnabled (stops at the first section).
        /// </summary>
        public static bool IsTrackingEnabled()
        {
            if (!File.Exists(ConfigPath)) return true;

            var beforeSection = true;
            foreach (var rawLine in File.ReadAllLines(ConfigPath))
            {
                var line = rawLine.Trim();
                if (line.StartsWith("[")) beforeSection = false;
                if (!beforeSection) continue;

                var m = Regex.Match(line, @"^tracking_enabled\s*=\s*(true|false)");
                if (m.Success) return m.Groups[1].Value == "true";
            }
            return true;
        }

        /// <summary>
        /// Writes/removes tracking_enabled in config.toml. When the value is the default (true)
        /// the line is omitted; when false it is written explicitly. Inserted just after api_key
        /// if present, otherwise at the top.
        /// </summary>
        public static void SetTrackingEnabled(bool enabled)
        {
            Directory.CreateDirectory(DevGlobeDir);

            var content = File.Exists(ConfigPath) ? File.ReadAllText(ConfigPath) : string.Empty;
            var lines = content.Split('\n');
            var updated = new List<string>();
            var beforeSection = true;
            var handled = false;

            foreach (var rawLine in lines)
            {
                var line = rawLine.Trim();
                if (line.StartsWith("[")) beforeSection = false;

                if (beforeSection && line.StartsWith("tracking_enabled"))
                {
                    // false => write the line; true (default) => omit it.
                    if (!enabled) updated.Add("tracking_enabled = false");
                    handled = true;
                }
                else
                {
                    updated.Add(rawLine);
                }
            }

            if (!handled && !enabled)
            {
                var apiKeyIdx = updated.FindIndex(l => l.Trim().StartsWith("api_key"));
                if (apiKeyIdx >= 0) updated.Insert(apiKeyIdx + 1, "tracking_enabled = false");
                else updated.Insert(0, "tracking_enabled = false");
            }

            var output = Regex.Replace(string.Join("\n", updated), @"\n{3,}", "\n\n");
            if (!output.EndsWith("\n")) output += "\n";
            File.WriteAllText(ConfigPath, output);
            Log.Info("config tracking_enabled written", new { enabled });
        }
    }
}
