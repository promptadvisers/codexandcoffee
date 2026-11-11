using System;
using System.Runtime.InteropServices;

namespace StageInk;

internal static class Native
{
    internal const int ExtendedStyle = -20;
    internal const long Transparent = 0x20;
    internal const long NoActivate = 0x08000000;
    internal const int HotKeyMessage = 0x0312;
    internal static readonly IntPtr TopMost = new(-1);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    internal static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
    internal static extern IntPtr SetWindowLongPtr(IntPtr window, int index, IntPtr value);
    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool UnregisterHotKey(IntPtr window, int id);
    internal static void PassThrough(IntPtr handle, bool pass)
    {
        var style = GetWindowLongPtr(handle, ExtendedStyle).ToInt64();
        style = pass ? style | Transparent | NoActivate : style & ~(Transparent | NoActivate);
        SetWindowLongPtr(handle, ExtendedStyle, new IntPtr(style));
        SetWindowPos(handle, TopMost, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010 | 0x0020);
    }
}
