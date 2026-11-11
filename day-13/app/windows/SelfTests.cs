using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Forms = System.Windows.Forms;

namespace StageInk;

internal static class SelfTests
{
    private static readonly List<object> Results = new();
    private static int failures;
    private static void Check(string name, bool passed)
    {
        Results.Add(new { check = name, passed, method = "Windows production component / UI smoke" });
        if (!passed) failures++;
    }
    public static int Run(string folder)
    {
        Directory.CreateDirectory(folder);
        try
        {
            RunChecks(folder);
        }
        catch (Exception ex)
        {
            Results.Add(new { check = "Unexpected test exception", passed = false, detail = ex.ToString() });
            failures++;
        }
        File.WriteAllText(Path.Combine(folder, "results.json"), JsonSerializer.Serialize(Results, new JsonSerializerOptions { WriteIndented = true }));
        File.WriteAllText(Path.Combine(folder, "summary.txt"), $"{Results.Count - failures}/{Results.Count} checks passed\nPhysical desktop mouse delivery and full-screen presentation behavior require a manual Windows check.\n");
        return failures == 0 ? 0 : 1;
    }
    private static void RunChecks(string folder)
    {
        var state = new Settings();
        var model = new DrawingModel(state) { Drawing = true };
        foreach (var tool in DrawingModel.Tools)
        {
            state.Tool = tool;
            model.Begin("test", new Point(240, 140));
            model.Move(new Point(190, 90));
            Check(tool + " commits through the production drawing model", model.End(new Point(80, 40)));
        }
        var marks = model.Marks("test/Desktop");
        Check("Five shapes are retained", marks.Count == 5);
        Check("Pen retains drag samples", marks[0].Points.Count == 3);
        Check("Geometric shapes retain two endpoints", marks.Skip(1).All(m => m.Points.Count == 2));
        Check("Reverse drag coordinates are retained", marks[3].Points[0].X > marks[3].Points[1].X);
        state.Color = "Green";
        state.Width = 16;
        Check("Existing strokes retain their original style", marks[0].Color == "Blue" && marks[0].Width == 6);
        model.Undo();
        Check("Undo removes the latest stroke", marks.Count == 4);
        state.Board = "Whiteboard";
        Check("Boards have separate drawing collections", model.Marks(model.Key("test")).Count == 0);
        model.Begin("test", new Point(10, 10));
        model.End(new Point(10, 10));
        Check("Single-click marks are retained", model.Marks("test/Whiteboard").Count == 1);
        model.Clear();
        Check("Clear preserves the other board", model.Marks("test/Whiteboard").Count == 0 && marks.Count == 4);
        model.Drawing = false;
        model.Begin("test", new Point(1, 1));
        Check("Interact mode rejects drawing", model.Draft is null);
        var store = new StateStore(Path.Combine(folder, "state"));
        Check("Settings save to a writable user folder", store.Save(state));
        var restored = store.Load();
        Check("Saved settings and drawings round trip", restored.Canvases["test/Desktop"].Count == 4 && restored.Color == "Green");
        var corrupt = new StateStore(Path.Combine(folder, "corrupt"));
        Directory.CreateDirectory(corrupt.Folder);
        File.WriteAllText(corrupt.FilePath, "bad JSON");
        Check("Damaged settings recover with a visible error", corrupt.Load().Tool == "Pen" && corrupt.Error is not null);
        var clock = new Countdown();
        Check("Timer accepts a three-second duration", clock.Set(3) && clock.Display == "00:03");
        Check("Timer rejects invalid values", !clock.Set(-1) && !clock.Set(double.NaN));
        var now = DateTimeOffset.UtcNow;
        clock.Toggle(now);
        clock.Tick(now.AddSeconds(1));
        Check("Timer counts down using elapsed time", clock.Display == "00:02");
        clock.Toggle(now.AddSeconds(1));
        Check("Timer pauses", clock.Deadline is null && clock.Remaining == 2);
        clock.Toggle(now.AddSeconds(5));
        clock.Tick(now.AddSeconds(8));
        Check("Timer finishes at zero", clock.Display == "00:00" && clock.Deadline is null);
        clock.Reset();
        Check("Timer reset restores the duration", clock.Display == "00:03");
        var invalid = new Settings { Tool = "Unknown", Width = double.PositiveInfinity, Board = "Unknown" };
        invalid.Normalize();
        Check("Older or invalid settings normalize", invalid.Tool == "Pen" && invalid.Width == 6 && invalid.Board == "Desktop");

        using var controller = new Controller(new StateStore(Path.Combine(folder, "ui")), show: false);
        controller.Palette.Show();
        controller.SetDrawing(true);
        Check("Palette enters Draw mode", controller.Model.Drawing);
        controller.SetDrawing(false);
        Check("Palette returns to Interact mode", !controller.Model.Drawing);
        var overlay = new Overlay(controller, Forms.Screen.PrimaryScreen!);
        overlay.Show();
        overlay.SetDrawing(false);
        Check("Interact window has the native pass-through style", (Native.GetWindowLongPtr(overlay.Handle, Native.ExtendedStyle).ToInt64() & Native.Transparent) != 0);
        overlay.SetDrawing(true);
        Check("Draw window removes the native pass-through style", (Native.GetWindowLongPtr(overlay.Handle, Native.ExtendedStyle).ToInt64() & Native.Transparent) == 0);
        overlay.Close();
        controller.Palette.Dispatcher.Invoke(() => { }, DispatcherPriority.Render);
        SaveVisual((FrameworkElement)controller.Palette.Content, Path.Combine(folder, "windows-controls.png"), 315, 480);
        controller.Model.Drawing = true;
        foreach (var tool in DrawingModel.Tools)
        {
            var i = Array.IndexOf(DrawingModel.Tools, tool);
            controller.Model.State.Tool = tool;
            controller.Model.Begin("render", new Point(40 + i * 120, 70));
            controller.Model.End(new Point(100 + i * 120, 160));
        }
        var surface = new DrawingSurface(controller, "render");
        var rendered = SaveVisual(surface, Path.Combine(folder, "windows-drawing-components.png"), 680, 260);
        var pixels = new byte[680 * 260 * 4];
        rendered.CopyPixels(pixels, 680 * 4, 0);
        var colored = 0;
        for (var i = 0; i < pixels.Length; i += 4)
            if (pixels[i + 3] > 50 && Math.Max(pixels[i], Math.Max(pixels[i + 1], pixels[i + 2])) - Math.Min(pixels[i], Math.Min(pixels[i + 1], pixels[i + 2])) > 25) colored++;
        Check("Production renderer produces colored strokes", colored > 100);
        Check("Production drawing renders to an image", new FileInfo(Path.Combine(folder, "windows-drawing-components.png")).Length > 500);
        var timer = new TimerWindow();
        timer.Show();
        timer.Clock.Set(600);
        Check("Native timer window opens", timer.IsVisible && timer.Clock.Display == "10:00");
        SaveVisual((FrameworkElement)timer.Content, Path.Combine(folder, "windows-timer.png"), 380, 250);
        timer.Close();
        controller.Palette.Hide();
    }
    private static RenderTargetBitmap SaveVisual(FrameworkElement element, string file, int width, int height)
    {
        element.Measure(new Size(width, height));
        element.Arrange(new Rect(0, 0, width, height));
        element.UpdateLayout();
        var image = new RenderTargetBitmap(width, height, 96, 96, PixelFormats.Pbgra32);
        var background = new DrawingVisual();
        using (var drawing = background.RenderOpen()) drawing.DrawRectangle(Brushes.White, null, new Rect(0, 0, width, height));
        image.Render(background);
        image.Render(element);
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(image));
        using var stream = File.Create(file);
        encoder.Save(stream);
        return image;
    }
}
