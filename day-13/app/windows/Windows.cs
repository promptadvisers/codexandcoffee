using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using Forms = System.Windows.Forms;

namespace StageInk;

public sealed class DrawingSurface : FrameworkElement
{
    private readonly Controller owner;
    public string ScreenId { get; }
    public DrawingSurface(Controller controller, string screenId)
    {
        owner = controller;
        ScreenId = screenId;
        Focusable = true;
        MouseLeftButtonDown += (_, e) => { if (!owner.Model.Drawing) return; Focus(); CaptureMouse(); owner.Model.Begin(ScreenId, e.GetPosition(this)); InvalidateVisual(); e.Handled = true; };
        MouseMove += (_, e) => { if (!IsMouseCaptured) return; owner.Model.Move(e.GetPosition(this)); InvalidateVisual(); };
        MouseLeftButtonUp += (_, e) => { if (!IsMouseCaptured) return; owner.Model.End(e.GetPosition(this)); ReleaseMouseCapture(); owner.Save(); owner.Refresh(); e.Handled = true; };
        LostMouseCapture += (_, _) => { owner.Model.Cancel(); InvalidateVisual(); };
        KeyDown += (_, e) => { if (e.Key == Key.Escape) { owner.SetDrawing(false); e.Handled = true; } };
    }
    protected override void OnRender(DrawingContext dc)
    {
        // One alpha unit gives the drawing window a hit-test surface while keeping the desktop visible.
        Brush background = new SolidColorBrush(Color.FromArgb(1, 0, 0, 0));
        if (owner.Model.State.Board == "Whiteboard" && owner.Model.Drawing) background = Brushes.White;
        if (owner.Model.State.Board == "Blackboard" && owner.Model.Drawing) background = new SolidColorBrush(Color.FromRgb(20, 20, 20));
        dc.DrawRectangle(background, null, new Rect(RenderSize));
        var key = owner.Model.Key(ScreenId);
        if (owner.Model.State.Board == "Desktop" || owner.Model.Drawing)
        {
            foreach (var mark in owner.Model.Marks(key)) StrokeRenderer.Paint(dc, mark);
            if (owner.Model.Draft is not null) StrokeRenderer.Paint(dc, owner.Model.Draft);
        }
    }
}

public sealed class Overlay : Window
{
    public DrawingSurface Surface { get; }
    public IntPtr Handle { get; private set; }
    public Overlay(Controller owner, Forms.Screen screen)
    {
        Title = "StageInk drawing canvas";
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        Topmost = true;
        ShowInTaskbar = false;
        ShowActivated = false;
        Width = screen.Bounds.Width;
        Height = screen.Bounds.Height;
        Left = screen.Bounds.Left;
        Top = screen.Bounds.Top;
        Surface = new DrawingSurface(owner, screen.DeviceName);
        Content = Surface;
        SourceInitialized += (_, _) =>
        {
            Handle = new WindowInteropHelper(this).Handle;
            Native.SetWindowPos(Handle, Native.TopMost, screen.Bounds.X, screen.Bounds.Y,
                screen.Bounds.Width, screen.Bounds.Height, 0x0010);
            Native.PassThrough(Handle, true);
        };
    }
    public void SetDrawing(bool value)
    {
        Native.PassThrough(Handle, !value);
        Cursor = value ? Cursors.Cross : Cursors.Arrow;
        Surface.InvalidateVisual();
    }
}

public sealed class Controller : IDisposable
{
    public DrawingModel Model { get; }
    public StateStore Store { get; }
    public List<Overlay> Overlays { get; } = new();
    public Palette Palette { get; }
    private TimerWindow? timer;
    private PracticeWindow? practice;
    private bool disposed;
    public Controller(StateStore store, bool show = true)
    {
        Store = store;
        Model = new DrawingModel(store.Load());
        Palette = new Palette(this);
        if (show)
        {
            foreach (var screen in Forms.Screen.AllScreens)
            {
                var overlay = new Overlay(this, screen);
                Overlays.Add(overlay);
                overlay.Show();
            }
            Palette.Show();
            Palette.Activate();
        }
        Refresh();
    }
    public void SetDrawing(bool value)
    {
        Model.Cancel();
        Model.Drawing = value;
        foreach (var overlay in Overlays) overlay.SetDrawing(value);
        if (value && Overlays.Count > 0) { Overlays[0].Activate(); Overlays[0].Surface.Focus(); }
        Refresh();
    }
    public void SelectTool(string tool)
    {
        Model.State.Tool = tool;
        Save();
        SetDrawing(true);
    }
    public void SetBoard(string board)
    {
        Model.Cancel();
        Model.State.Board = board;
        Save();
        Refresh();
    }
    public void Save() { Store.Save(Model.State); }
    public void Refresh()
    {
        foreach (var overlay in Overlays) overlay.Surface.InvalidateVisual();
        Palette.Refresh();
    }
    public void Undo() { Model.Undo(); Save(); Refresh(); }
    public void Clear() { Model.Clear(); Save(); Refresh(); }
    public void ShowTimer()
    {
        if (timer is null) { timer = new TimerWindow(); timer.Closed += (_, _) => timer = null; }
        timer.Show();
        timer.Activate();
    }
    public void ShowPractice()
    {
        SetDrawing(false);
        SetBoard("Desktop");
        if (practice is null) { practice = new PracticeWindow(); practice.Closed += (_, _) => practice = null; }
        practice.Show();
        practice.Activate();
    }
    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        Save();
        foreach (var overlay in Overlays) overlay.Close();
        timer?.Close();
        practice?.Close();
    }
}

public sealed class Palette : Window
{
    private readonly Controller owner;
    private readonly Button mode;
    private readonly ComboBox tool;
    private readonly ComboBox color;
    private readonly ComboBox width;
    private readonly ComboBox board;
    private readonly TextBlock status;
    private readonly TextBlock storage;
    private readonly List<int> registered = new();
    private bool refreshing;
    private string? shortcutWarning;
    private HwndSource? source;
    public Palette(Controller controller)
    {
        owner = controller;
        Title = "StageInk · presentation ink";
        Width = 355;
        Height = 535;
        ResizeMode = ResizeMode.NoResize;
        Topmost = true;
        Background = new SolidColorBrush(Color.FromRgb(248, 248, 250));
        FontFamily = new FontFamily("Segoe UI");
        FontSize = 14;
        Left = Forms.Screen.PrimaryScreen?.WorkingArea.Left + 24 ?? 24;
        Top = Forms.Screen.PrimaryScreen?.WorkingArea.Top + 24 ?? 24;
        var body = new StackPanel { Margin = new Thickness(20) };
        Content = body;
        mode = AddButton(body, "Start drawing · Ctrl+Alt+D", () => owner.SetDrawing(!owner.Model.Drawing));
        tool = AddChoice(body, "Tool", DrawingModel.Tools, v => owner.SelectTool(v));
        color = AddChoice(body, "Color", DrawingModel.Colors, v => { owner.Model.State.Color = v; owner.Save(); owner.Refresh(); });
        width = AddChoice(body, "Width", new[] { "2", "4", "6", "10", "16" }, v => { owner.Model.State.Width = double.Parse(v, CultureInfo.InvariantCulture); owner.Save(); owner.Refresh(); });
        board = AddChoice(body, "Surface", DrawingModel.Boards, v => owner.SetBoard(v));
        var editing = new UniformGrid { Columns = 2 };
        body.Children.Add(editing);
        AddButton(editing, "Undo", owner.Undo);
        AddButton(editing, "Clear", owner.Clear);
        var tools = new UniformGrid { Columns = 2 };
        body.Children.Add(tools);
        AddButton(tools, "Break timer", owner.ShowTimer);
        AddButton(tools, "Practice surface", owner.ShowPractice);
        status = new TextBlock { Margin = new Thickness(0, 14, 0, 8), TextWrapping = TextWrapping.Wrap };
        storage = new TextBlock { Foreground = Brushes.DimGray, FontSize = 11, TextWrapping = TextWrapping.Wrap };
        body.Children.Add(status);
        body.Children.Add(storage);
        KeyDown += (_, e) => { if (e.Key == Key.Escape) owner.SetDrawing(false); };
        SourceInitialized += (_, _) => RegisterKeys();
        Closed += (_, _) =>
        {
            if (source is not null)
            {
                foreach (var id in registered) Native.UnregisterHotKey(source.Handle, id);
                source.RemoveHook(HandleMessage);
            }
            owner.Dispose();
            Application.Current.Shutdown();
        };
    }
    private static Button AddButton(Panel body, string text, Action action)
    {
        var button = new Button { Content = text, Padding = new Thickness(7), Margin = new Thickness(3, 4, 3, 4), MinHeight = 34 };
        button.Click += (_, _) => action();
        body.Children.Add(button);
        return button;
    }
    private ComboBox AddChoice(Panel body, string label, IEnumerable<string> values, Action<string> change)
    {
        var row = new Grid { Margin = new Thickness(0, 7, 0, 7) };
        row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(72) });
        row.ColumnDefinitions.Add(new ColumnDefinition());
        row.Children.Add(new TextBlock { Text = label, VerticalAlignment = VerticalAlignment.Center });
        var combo = new ComboBox { ItemsSource = values, MinHeight = 30 };
        Grid.SetColumn(combo, 1);
        row.Children.Add(combo);
        body.Children.Add(row);
        combo.SelectionChanged += (_, _) => { if (!refreshing && combo.SelectedItem is string selected) change(selected); };
        return combo;
    }
    public void Refresh()
    {
        if (status is null) return;
        refreshing = true;
        tool.SelectedItem = owner.Model.State.Tool;
        color.SelectedItem = owner.Model.State.Color;
        width.SelectedItem = owner.Model.State.Width.ToString(CultureInfo.InvariantCulture);
        board.SelectedItem = owner.Model.State.Board;
        mode.Content = owner.Model.Drawing ? "Stop drawing · Ctrl+Alt+D" : "Start drawing · Ctrl+Alt+D";
        status.Text = owner.Model.Drawing ? "DRAW · Escape returns to the desktop" : "INTERACT · mouse passes through";
        var count = owner.Model.State.Canvases.Where(p => p.Key.EndsWith("/" + owner.Model.State.Board)).Sum(p => p.Value.Count);
        status.Text += $"\n{owner.Model.State.Board} · {count} marks";
        storage.Text = owner.Store.Error ?? shortcutWarning ?? "Settings saved in Local App Data / StageInk";
        refreshing = false;
    }
    private void RegisterKeys()
    {
        source = HwndSource.FromHwnd(new WindowInteropHelper(this).Handle);
        source.AddHook(HandleMessage);
        var keys = new[] { 'D', 'P', 'L', 'A', 'R', 'E', 'Z', 'X', '0', '1', '2', 'T' };
        for (var i = 0; i < keys.Length; i++)
        {
            if (Native.RegisterHotKey(source.Handle, i + 1, 0x0001 | 0x0002 | 0x4000, (uint)keys[i])) registered.Add(i + 1);
        }
        if (registered.Count != keys.Length) shortcutWarning = "Some shortcuts are already in use. The buttons still work.";
        Refresh();
    }
    private IntPtr HandleMessage(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (message != Native.HotKeyMessage) return IntPtr.Zero;
        var id = wParam.ToInt32();
        switch (id)
        {
            case 1: owner.SetDrawing(!owner.Model.Drawing); break;
            case >= 2 and <= 6: owner.SelectTool(DrawingModel.Tools[id - 2]); break;
            case 7: owner.Undo(); break;
            case 8: owner.Clear(); break;
            case >= 9 and <= 11: owner.SetBoard(DrawingModel.Boards[id - 9]); break;
            case 12: owner.ShowTimer(); break;
        }
        handled = true;
        return IntPtr.Zero;
    }
}

public sealed class TimerWindow : Window
{
    public Countdown Clock { get; } = new();
    private readonly TextBlock display = new() { FontSize = 64, FontWeight = FontWeights.SemiBold, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(12) };
    private readonly TextBlock status = new() { Text = "Ready for a break", HorizontalAlignment = HorizontalAlignment.Center };
    private readonly TextBox input = new() { Text = "60", Width = 95, Padding = new Thickness(6) };
    private readonly Button toggle = new() { Content = "Start", Width = 110, Margin = new Thickness(6), Padding = new Thickness(8) };
    private readonly DispatcherTimer ticker = new() { Interval = TimeSpan.FromMilliseconds(100) };
    public TimerWindow()
    {
        Title = "StageInk · break timer";
        Width = 420;
        Height = 330;
        Topmost = true;
        ResizeMode = ResizeMode.NoResize;
        var body = new StackPanel { Margin = new Thickness(20) };
        Content = body;
        body.Children.Add(status);
        body.Children.Add(display);
        var duration = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center };
        duration.Children.Add(new TextBlock { Text = "Seconds", VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(8) });
        duration.Children.Add(input);
        var set = new Button { Content = "Set", Padding = new Thickness(15, 6, 15, 6), Margin = new Thickness(8, 0, 0, 0) };
        duration.Children.Add(set);
        body.Children.Add(duration);
        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center };
        buttons.Children.Add(toggle);
        var reset = new Button { Content = "Reset", Width = 110, Padding = new Thickness(8), Margin = new Thickness(6) };
        buttons.Children.Add(reset);
        body.Children.Add(buttons);
        set.Click += (_, _) =>
        {
            if (!double.TryParse(input.Text, NumberStyles.Float, CultureInfo.InvariantCulture, out var seconds) || !Clock.Set(seconds)) status.Text = "Enter 1–86400 seconds";
            else UpdateDisplay();
        };
        reset.Click += (_, _) => { Clock.Reset(); UpdateDisplay(); };
        toggle.Click += (_, _) => { Clock.Toggle(DateTimeOffset.UtcNow); UpdateDisplay(); };
        ticker.Tick += (_, _) => { if (Clock.Deadline.HasValue) { Clock.Tick(DateTimeOffset.UtcNow); UpdateDisplay(); } };
        ticker.Start();
        Closed += (_, _) => ticker.Stop();
        UpdateDisplay();
    }
    private void UpdateDisplay()
    {
        display.Text = Clock.Display;
        toggle.Content = Clock.Deadline.HasValue ? "Pause" : Clock.Remaining == Clock.Duration || Clock.Remaining == 0 ? "Start" : "Resume";
        status.Text = Clock.Deadline.HasValue ? "Break in progress" : Clock.Remaining == 0 ? "Break complete" : Clock.Remaining == Clock.Duration ? "Ready for a break" : "Paused";
    }
}

public sealed class PracticeWindow : Window
{
    public int Count { get; private set; }
    public PracticeWindow()
    {
        Title = "StageInk · practice surface";
        Width = 850;
        Height = 540;
        Background = Brushes.White;
        var body = new StackPanel { Margin = new Thickness(36) };
        Content = body;
        body.Children.Add(new TextBlock { Text = "Practice your presentation", FontSize = 30, FontWeight = FontWeights.Bold, Margin = new Thickness(0, 0, 0, 25) });
        body.Children.Add(new TextBlock { Text = "Draw on this sample, return to Interact, then try the button and text field.", FontSize = 18, TextWrapping = TextWrapping.Wrap });
        var button = new Button { Content = "Clicks · 0", Width = 150, Padding = new Thickness(15), Margin = new Thickness(0, 35, 0, 20), HorizontalAlignment = HorizontalAlignment.Left };
        button.Click += (_, _) => button.Content = $"Clicks · {++Count}";
        body.Children.Add(button);
        body.Children.Add(new TextBox { Text = "Type here after returning to Interact", FontSize = 18, Padding = new Thickness(12) });
    }
}
