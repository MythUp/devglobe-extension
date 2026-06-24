using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Microsoft.VisualStudio.Shell;
using Task = System.Threading.Tasks.Task;

namespace DevGlobe.Commands
{
    /// <summary>
    /// Prompts for a status message (max 100 chars) and calls CoreClient.SetStatus.
    /// </summary>
    internal static class SetStatusCommand
    {
        private static Func<CoreClient> _coreClientProvider;

        public static async Task InitializeAsync(AsyncPackage package, Func<CoreClient> coreClientProvider)
        {
            _coreClientProvider = coreClientProvider ?? throw new ArgumentNullException(nameof(coreClientProvider));

            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);
            var commandService = (Microsoft.VisualStudio.Shell.OleMenuCommandService)
                await package.GetServiceAsync(typeof(System.ComponentModel.Design.IMenuCommandService));
            if (commandService == null)
            {
                Log.Error("SetStatusCommand: IMenuCommandService unavailable");
                return;
            }

            var commandId = new System.ComponentModel.Design.CommandID(
                CommandIds.GuidDevGlobeCmdSet, CommandIds.SetStatusCommandId);
            var menuItem = new Microsoft.VisualStudio.Shell.OleMenuCommand(Execute, commandId);
            commandService.AddCommand(menuItem);
        }

        private static void Execute(object sender, EventArgs e)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            try
            {
                // No API key configured: nothing to do.
                if (string.IsNullOrEmpty(DevGlobeConfig.ReadApiKey()))
                {
                    Log.Info("command setStatus skipped: no api key");
                    return;
                }

                var dialog = new StatusInputDialog();
                var owner = Application.Current?.MainWindow;
                if (owner != null)
                {
                    dialog.Owner = owner;
                }

                var ok = dialog.ShowDialog();
                if (ok != true)
                {
                    // Cancelled: do nothing.
                    return;
                }

                var message = dialog.Message ?? string.Empty;
                if (message.Length > 100)
                {
                    message = message.Substring(0, 100);
                }

                Log.Info("command setStatus", new { length = message.Length, hasKey = true });
                _coreClientProvider()?.SetStatus(message);
            }
            catch (Exception ex)
            {
                Log.Error("command setStatus failed", new { error = ex.Message });
            }
        }
    }

    /// <summary>
    /// Modal WPF input dialog used by SetStatusCommand, limited to 100 characters.
    /// </summary>
    internal sealed class StatusInputDialog : Window
    {
        private readonly TextBox _input;

        /// <summary>Entered text (null if cancelled).</summary>
        public string Message { get; private set; }

        public StatusInputDialog()
        {
            Title = "DevGlobe — Set Status Message";
            Width = 420;
            Height = 170;
            WindowStartupLocation = WindowStartupLocation.CenterOwner;
            ResizeMode = ResizeMode.NoResize;
            ShowInTaskbar = false;

            var root = new StackPanel { Margin = new Thickness(16) };

            root.Children.Add(new TextBlock
            {
                Text = "What are you working on?",
                Margin = new Thickness(0, 0, 0, 6)
            });

            _input = new TextBox
            {
                MaxLength = 100,
                Margin = new Thickness(0, 0, 0, 4)
            };
            _input.KeyDown += (s, e) =>
            {
                if (e.Key == System.Windows.Input.Key.Enter) { Confirm(); }
                else if (e.Key == System.Windows.Input.Key.Escape) { DialogResult = false; }
            };
            root.Children.Add(_input);

            var counter = new TextBlock
            {
                Text = "0 / 100",
                FontSize = 11,
                Opacity = 0.7,
                HorizontalAlignment = HorizontalAlignment.Right,
                Margin = new Thickness(0, 0, 0, 10)
            };
            _input.TextChanged += (s, e) => counter.Text = $"{_input.Text.Length} / 100";
            root.Children.Add(counter);

            var buttons = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right
            };
            var okButton = new Button { Content = "Set", Width = 80, IsDefault = true, Margin = new Thickness(0, 0, 8, 0) };
            okButton.Click += (s, e) => Confirm();
            var cancelButton = new Button { Content = "Cancel", Width = 80, IsCancel = true };
            buttons.Children.Add(okButton);
            buttons.Children.Add(cancelButton);
            root.Children.Add(buttons);

            Content = root;
            Loaded += (s, e) => _input.Focus();
        }

        private void Confirm()
        {
            Message = _input.Text ?? string.Empty;
            DialogResult = true;
        }
    }
}
