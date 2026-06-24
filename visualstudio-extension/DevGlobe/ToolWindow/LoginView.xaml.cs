using System;
using System.Diagnostics;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Navigation;

namespace DevGlobe.ToolWindow
{
    /// <summary>
    /// Login view. Raises ConnectRequested with the entered key; does not touch core or config.
    /// </summary>
    public partial class LoginView : UserControl
    {
        /// <summary>Raised when the user submits a non-empty key.</summary>
        public event Action<string> ConnectRequested;

        public LoginView()
        {
            InitializeComponent();
        }

        /// <summary>Clears the field and restores focus when switching back to Login.</summary>
        public void Clear()
        {
            KeyBox.Clear();
            KeyBox.Focus();
        }

        private void ConnectButton_Click(object sender, System.Windows.RoutedEventArgs e)
        {
            Submit();
        }

        private void KeyBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                Submit();
                e.Handled = true;
            }
        }

        private void Submit()
        {
            string key = (KeyBox.Password ?? string.Empty).Trim();
            if (key.Length == 0)
            {
                return;
            }

            ConnectRequested?.Invoke(key);
        }

        private void GetKeyLink_RequestNavigate(object sender, RequestNavigateEventArgs e)
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = e.Uri.AbsoluteUri,
                    UseShellExecute = true,
                });
            }
            catch (Exception ex)
            {
                Log.Info("LoginView: failed to open browser", ex.Message);
            }

            e.Handled = true;
        }
    }
}
