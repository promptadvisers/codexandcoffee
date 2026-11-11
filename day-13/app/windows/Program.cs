using System;
using System.IO;
using System.Threading;
using System.Windows;

namespace StageInk;

internal static class Program
{
    [STAThread]
    public static int Main(string[] args)
    {
        var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
        if (args.Length > 0 && args[0] == "--self-test")
        {
            var folder = args.Length > 1 ? Path.GetFullPath(args[1]) : Path.Combine(Path.GetTempPath(), "StageInk-self-test");
            return SelfTests.Run(folder);
        }
        using var instance = new Mutex(true, "Local\\PromptAdvisers.StageInk", out var created);
        if (!created)
        {
            MessageBox.Show("StageInk is already running. Use its controls or press Ctrl+Alt+D.", "StageInk");
            return 0;
        }
        var folderPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "StageInk");
        using var controller = new Controller(new StateStore(folderPath));
        return app.Run();
    }
}
