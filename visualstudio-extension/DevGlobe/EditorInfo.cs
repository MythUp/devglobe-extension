namespace DevGlobe
{
    /// <summary>
    /// Editor identity sent to the core (the `editor` field of the `init` message) and used
    /// as a tag in logs.
    /// </summary>
    public static class EditorInfo
    {
        /// <summary>Identifier recognized by devglobe.app (icon/name on the globe).</summary>
        public const string EditorId = "visualstudio";

        /// <summary>Always returns "visualstudio".</summary>
        public static string DetectEditor() => EditorId;
    }
}
