using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Windows;
using System.Windows.Media;

namespace StageInk;

public record InkPoint(double X, double Y)
{
    public Point Point => new(X, Y);
}

public sealed class Stroke
{
    public string Tool { get; set; } = "Pen";
    public string Color { get; set; } = "Blue";
    public double Width { get; set; } = 6;
    public List<InkPoint> Points { get; set; } = new();
}

public sealed class Settings
{
    public string Tool { get; set; } = "Pen";
    public string Color { get; set; } = "Blue";
    public double Width { get; set; } = 6;
    public string Board { get; set; } = "Desktop";
    public Dictionary<string, List<Stroke>> Canvases { get; set; } = new();

    public void Normalize()
    {
        if (!DrawingModel.Tools.Contains(Tool)) Tool = "Pen";
        if (!DrawingModel.Colors.Contains(Color)) Color = "Blue";
        if (!double.IsFinite(Width)) Width = 6;
        Width = Math.Clamp(Width, 1, 30);
        if (!DrawingModel.Boards.Contains(Board)) Board = "Desktop";
        Canvases ??= new();
        foreach (var key in Canvases.Keys.ToList())
        {
            Canvases[key] ??= new();
            Canvases[key].RemoveAll(s => s is null || s.Points is null || s.Points.Count == 0 ||
                !double.IsFinite(s.Width) || s.Width <= 0 || s.Width > 100 ||
                s.Points.Any(p => p is null || !double.IsFinite(p.X) || !double.IsFinite(p.Y)));
            foreach (var stroke in Canvases[key])
            {
                if (!DrawingModel.Tools.Contains(stroke.Tool)) stroke.Tool = "Pen";
                if (!DrawingModel.Colors.Contains(stroke.Color)) stroke.Color = "Blue";
            }
        }
    }
}

public sealed class StateStore
{
    public string Folder { get; }
    public string FilePath => Path.Combine(Folder, "state.json");
    public string? Error { get; private set; }
    public StateStore(string folder) => Folder = folder;
    public Settings Load()
    {
        try
        {
            var state = File.Exists(FilePath)
                ? JsonSerializer.Deserialize<Settings>(File.ReadAllText(FilePath)) ?? new Settings()
                : new Settings();
            state.Normalize();
            return state;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            Error = "Could not load settings. " + ex.Message;
            return new Settings();
        }
    }
    public bool Save(Settings state)
    {
        try
        {
            Directory.CreateDirectory(Folder);
            var temporary = FilePath + ".tmp";
            File.WriteAllText(temporary, JsonSerializer.Serialize(state));
            File.Move(temporary, FilePath, true);
            Error = null;
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Error = "Could not save settings. " + ex.Message;
            return false;
        }
    }
}

public sealed class DrawingModel
{
    public static readonly string[] Tools = { "Pen", "Line", "Arrow", "Rectangle", "Ellipse" };
    public static readonly string[] Colors = { "Orange", "Blue", "Pink", "Green", "Yellow", "White", "Black" };
    public static readonly string[] Boards = { "Desktop", "Whiteboard", "Blackboard" };
    public Settings State { get; }
    public bool Drawing { get; set; }
    public Stroke? Draft { get; private set; }
    private string? draftKey;
    public DrawingModel(Settings state) => State = state;
    public string Key(string screen) => screen + "/" + State.Board;
    public List<Stroke> Marks(string key)
    {
        if (!State.Canvases.TryGetValue(key, out var marks)) State.Canvases[key] = marks = new();
        return marks;
    }
    public void Begin(string screen, Point point)
    {
        if (!Drawing) return;
        draftKey = Key(screen);
        Draft = new Stroke { Tool = State.Tool, Color = State.Color, Width = State.Width,
            Points = new() { new InkPoint(point.X, point.Y) } };
    }
    public void Move(Point point)
    {
        if (Draft is null) return;
        var next = new InkPoint(point.X, point.Y);
        if (Draft.Tool == "Pen" || Draft.Points.Count == 1) Draft.Points.Add(next);
        else Draft.Points[1] = next;
    }
    public bool End(Point point)
    {
        if (Draft is null || draftKey is null) return false;
        Move(point);
        Marks(draftKey).Add(Draft);
        Cancel();
        return true;
    }
    public void Cancel() { Draft = null; draftKey = null; }
    public void Undo()
    {
        foreach (var marks in State.Canvases.Where(p => p.Key.EndsWith("/" + State.Board)).Select(p => p.Value))
            if (marks.Count > 0) marks.RemoveAt(marks.Count - 1);
    }
    public void Clear()
    {
        Cancel();
        foreach (var marks in State.Canvases.Where(p => p.Key.EndsWith("/" + State.Board)).Select(p => p.Value)) marks.Clear();
    }
}

public static class StrokeRenderer
{
    public static void Paint(DrawingContext dc, Stroke stroke)
    {
        if (stroke.Points.Count == 0) return;
        var brush = (SolidColorBrush)new BrushConverter().ConvertFromString(stroke.Color)!;
        var pen = new Pen(brush, stroke.Width) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round, LineJoin = PenLineJoin.Round };
        var start = stroke.Points[0].Point;
        var end = stroke.Points[^1].Point;
        var rectangle = new Rect(start, end);
        switch (stroke.Tool)
        {
            case "Rectangle": dc.DrawRectangle(null, pen, rectangle); break;
            case "Ellipse": dc.DrawEllipse(null, pen, new Point(rectangle.X + rectangle.Width / 2, rectangle.Y + rectangle.Height / 2), rectangle.Width / 2, rectangle.Height / 2); break;
            case "Arrow":
                dc.DrawLine(pen, start, end);
                var angle = Math.Atan2(end.Y - start.Y, end.X - start.X);
                var length = Math.Max(16, stroke.Width * 3);
                foreach (var offset in new[] { -0.5, 0.5 })
                    dc.DrawLine(pen, end, new Point(end.X - length * Math.Cos(angle + offset), end.Y - length * Math.Sin(angle + offset)));
                break;
            case "Line": dc.DrawLine(pen, start, end); break;
            default:
                if (stroke.Points.Count < 2 || stroke.Points.All(p => p.Point == start)) dc.DrawEllipse(brush, null, start, stroke.Width / 2, stroke.Width / 2);
                for (var i = 1; i < stroke.Points.Count; i++) dc.DrawLine(pen, stroke.Points[i - 1].Point, stroke.Points[i].Point);
                break;
        }
    }
}

public sealed class Countdown
{
    public double Duration { get; private set; } = 60;
    public double Remaining { get; private set; } = 60;
    public DateTimeOffset? Deadline { get; private set; }
    public bool Set(double seconds)
    {
        if (!double.IsFinite(seconds) || seconds < 1 || seconds > 86400) return false;
        Duration = Math.Round(seconds);
        Reset();
        return true;
    }
    public void Toggle(DateTimeOffset now)
    {
        if (Deadline.HasValue) { Tick(now); Deadline = null; }
        else { if (Remaining <= 0) Remaining = Duration; Deadline = now.AddSeconds(Remaining); }
    }
    public void Tick(DateTimeOffset now)
    {
        if (!Deadline.HasValue) return;
        Remaining = Math.Max(0, (Deadline.Value - now).TotalSeconds);
        if (Remaining == 0) Deadline = null;
    }
    public void Reset() { Deadline = null; Remaining = Duration; }
    public string Display => $"{(int)Math.Ceiling(Remaining) / 60:00}:{(int)Math.Ceiling(Remaining) % 60:00}";
}
