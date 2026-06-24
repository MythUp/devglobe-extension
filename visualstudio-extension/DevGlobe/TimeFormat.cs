namespace DevGlobe
{
    /// <summary>
    /// Formats a duration in seconds as a short label ("2h 15m" / "15m").
    /// </summary>
    public static class TimeFormat
    {
        public static string Format(long todaySeconds)
        {
            if (todaySeconds < 0)
            {
                todaySeconds = 0;
            }

            long hours = todaySeconds / 3600;
            long minutes = (todaySeconds % 3600) / 60;

            return hours > 0
                ? $"{hours}h {minutes}m"
                : $"{minutes}m";
        }
    }
}
