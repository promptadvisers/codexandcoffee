using System;
using System.Runtime.InteropServices;
using System.Windows.Automation;

namespace RelayVoice;

internal static class Native
{
    [DllImport("user32.dll")] internal static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll", SetLastError = true)] internal static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] internal static extern bool UnregisterHotKey(IntPtr window, int id);
    [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] internal static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll", SetLastError = true)] private static extern uint SendInput(uint count, Input[] inputs, int size);
    [StructLayout(LayoutKind.Sequential)] private struct Input { public uint Type; public Union Data; }
    [StructLayout(LayoutKind.Explicit)] private struct Union
    {
        [FieldOffset(0)] public MouseInput Mouse;
        [FieldOffset(0)] public KeyboardInput Keyboard;
    }
    [StructLayout(LayoutKind.Sequential)] private struct MouseInput { public int X, Y; public uint Data, Flags, Time; public UIntPtr Extra; }
    [StructLayout(LayoutKind.Sequential)] private struct KeyboardInput { public ushort Key, Scan; public uint Flags, Time; public UIntPtr Extra; }
    internal static bool Down(int key) => (GetAsyncKeyState(key) & 0x8000) != 0;
    internal static bool ModifiersDown => Down(0x10) || Down(0x11) || Down(0x12) || Down(0x5B) || Down(0x5C);
    internal static bool Paste()
    {
        var keys = new[] { Key(0x11, false), Key(0x56, false), Key(0x56, true), Key(0x11, true) };
        return SendInput((uint)keys.Length, keys, Marshal.SizeOf<Input>()) == keys.Length;
    }
    private static Input Key(ushort key, bool up) => new() { Type = 1, Data = new Union { Keyboard = new KeyboardInput { Key = key, Flags = up ? 2u : 0u } } };
}

internal sealed class FocusTarget
{
    public IntPtr Window { get; private init; }
    public AutomationElement? Element { get; private init; }
    public string? Before { get; private init; }
    public bool Safe { get; private init; }
    public static FocusTarget Capture()
    {
        var window = Native.GetForegroundWindow();
        Native.GetWindowThreadProcessId(window, out var process);
        var host = Environment.GetEnvironmentVariable("RELAY_HOST_PID");
        if (window == IntPtr.Zero || process == Environment.ProcessId || process.ToString() == host) return new();
        try
        {
            var element = AutomationElement.FocusedElement;
            var safe = !element.Current.IsPassword && element.Current.IsEnabled;
            string? before = null;
            if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var value))
            {
                var pattern = (ValuePattern)value;
                safe &= !pattern.Current.IsReadOnly;
                before = pattern.Current.Value;
            }
            else safe = false;
            return new() { Window = window, Element = element, Before = before, Safe = safe };
        }
        catch { return new() { Window = window }; }
    }
    public bool StillFocused()
    {
        if (!Safe || Window == IntPtr.Zero || Window != Native.GetForegroundWindow() || Element is null) return false;
        try { return Automation.Compare(Element, AutomationElement.FocusedElement); }
        catch { return false; }
    }
    public string? Read()
    {
        try
        {
            if (Element is not null && Element.TryGetCurrentPattern(ValuePattern.Pattern, out var value)) return ((ValuePattern)value).Current.Value;
            return null;
        }
        catch { return null; }
    }
}
