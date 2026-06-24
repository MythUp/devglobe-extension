using System;
using System.Windows.Controls;
using System.Windows.Input;

namespace DevGlobe.ToolWindow
{
    /// <summary>
    /// Dashboard view. ApplyState() updates the displayed state when configured.
    /// </summary>
    public partial class DashboardView : UserControl
    {
        public event Action StartRequested;
        public event Action StopRequested;
        public event Action<string> SetStatusRequested;
        public event Action DisconnectRequested;

        public DashboardView()
        {
            InitializeComponent();
        }

        /// <summary>
        /// Pushes state into the view: coding time, language, and the enabled state of the buttons.
        /// </summary>
        public void ApplyState(TrackerState state)
        {
            CodingTimeText.Text = string.IsNullOrEmpty(state.CodingTime) ? "0m" : state.CodingTime;
            LanguageText.Text = string.IsNullOrEmpty(state.Language) ? "--" : state.Language;
            StopButton.IsEnabled = state.Tracking;
            StartButton.IsEnabled = !state.Tracking;
        }

        private void StatusBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                RaiseSetStatus();
                e.Handled = true;
            }
        }

        private void SetStatusButton_Click(object sender, System.Windows.RoutedEventArgs e)
        {
            RaiseSetStatus();
        }

        private void RaiseSetStatus()
        {
            // Send the message as-is; the core validates and trims it.
            SetStatusRequested?.Invoke(StatusBox.Text ?? string.Empty);
        }

        private void StartButton_Click(object sender, System.Windows.RoutedEventArgs e)
        {
            StartRequested?.Invoke();
        }

        private void StopButton_Click(object sender, System.Windows.RoutedEventArgs e)
        {
            StopRequested?.Invoke();
        }

        private void DisconnectLink_Click(object sender, System.Windows.RoutedEventArgs e)
        {
            DisconnectRequested?.Invoke();
        }
    }
}
