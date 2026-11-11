using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32;
using NAudio.Wave;
using System.Windows.Forms;

namespace RelayVoice;

internal static class Program
{
    [STAThread]
    public static void Main()
    {
        Console.InputEncoding = new UTF8Encoding(false);
        Console.OutputEncoding = new UTF8Encoding(false);
        ApplicationConfiguration.Initialize();
        SynchronizationContext.SetSynchronizationContext(new WindowsFormsSynchronizationContext());
        using var helper = new VoiceHelper();
        helper.Start();
        Application.Run();
    }
}

internal sealed class VoiceHelper : IDisposable
{
    private readonly Control dispatcher = new();
    private readonly System.Windows.Forms.Timer poll = new() { Interval = 20 };
    private readonly Backend backend = new();
    private readonly object stdout = new();
    private readonly string folder = Environment.GetEnvironmentVariable("RELAY_DATA_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Relay Voice Community", "voice");
    private JsonObject settings = new() { ["account"] = "primary", ["model"] = "", ["voice_mode"] = "auto" };
    private List<JsonObject> history = new();
    private CancellationTokenSource? operation;
    private Recorder? recorder;
    private string phase = "idle", requestId = "", mode = "auto", lastText = "", requestText = "";
    private string? audioFolder;
    private FocusTarget? target;
    private DateTimeOffset started;
    private bool held, shuttingDown, pasteCommitted;
    private int generation;
    private readonly bool shortcutRegistered;
    private readonly bool noShortcuts = Environment.GetEnvironmentVariable("RELAY_NO_SHORTCUTS") == "1";
    public VoiceHelper()
    {
        _ = dispatcher.Handle;
        // Registration consumes the shortcut so Space is not also typed into the editor.
        shortcutRegistered = !noShortcuts && Native.RegisterHotKey(dispatcher.Handle, 1, 0x0002 | 0x0004 | 0x4000, 0x20);
        Directory.CreateDirectory(folder);
        try { settings = JsonNode.Parse(File.ReadAllText(Path.Combine(folder, "settings.json")))?.AsObject() ?? settings; } catch { }
        try { history = JsonNode.Parse(File.ReadAllText(Path.Combine(folder, "helper-history.json")))!.AsArray().Select(n => n!.AsObject()).Take(100).ToList(); } catch { }
        if (!new[] { "primary", "work", "personal" }.Contains(settings["account"]?.GetValue<string>())) settings["account"] = "primary";
    }
    private void Emit(string name, object? fields = null)
    {
        if (shuttingDown) return;
        var body = fields is null ? new JsonObject() : JsonSerializer.SerializeToNode(fields)!.AsObject();
        body["v"] = 1; body["event"] = name;
        lock (stdout) { try { Console.WriteLine(body.ToJsonString()); Console.Out.Flush(); } catch { } }
    }
    private void Reply(string id, bool ok = true, object? fields = null)
    {
        var body = fields is null ? new JsonObject() : JsonSerializer.SerializeToNode(fields)!.AsObject();
        body["id"] = id; body["ok"] = ok; Emit("response", body);
    }
    private object Permissions()
    {
        var mic = "unavailable";
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone");
            mic = key?.GetValue("Value") as string == "Deny" ? "denied" : WaveIn.DeviceCount > 0 ? "authorized" : "unavailable";
        }
        catch { }
        return new { microphone = mic, accessibility = true, shortcut = shortcutRegistered, backend = backend.Available };
    }
    private void State(string reason = "") => Emit("state", new { state = phase, request_id = requestId, reason, mode });
    public void Start()
    {
        poll.Tick += async (_, _) => await Poll();
        poll.Start();
        Emit("ready", new { protocol = "relay-helper/1", permissions = Permissions(), settings, capabilities = new[] { "hold_to_record", "meter", "ask", "history", "copy", "guarded_insert" }, draft_writes = false });
        State();
        _ = Task.Run(() =>
        {
            while (Console.ReadLine() is string line)
            {
                if (line.Length > 1024 * 1024) continue;
                try { var input = JsonNode.Parse(line)?.AsObject(); if (input is not null) dispatcher.BeginInvoke(new Action(async () => await Command(input))); }
                catch (JsonException) { }
            }
            if (!shuttingDown) dispatcher.BeginInvoke(new Action(Shutdown));
        });
    }
    private async Task Command(JsonObject input)
    {
        var id = input["id"]?.GetValue<string>();
        var command = input["command"]?.GetValue<string>();
        if (string.IsNullOrEmpty(id) || command is null) return;
        var commandVersion = generation;
        try
        {
            switch (command)
            {
                case "ping": Reply(id, fields: new { state = phase }); break;
                case "permissions":
                case "request_accessibility": Reply(id, fields: new { permissions = Permissions() }); break;
                case "request_microphone":
                    Process.Start(new ProcessStartInfo("ms-settings:privacy-microphone") { UseShellExecute = true });
                    Reply(id, fields: new { permissions = Permissions() }); break;
                case "settings_get": Reply(id, fields: new { settings }); break;
                case "settings_set":
                    if (phase != "idle") { Reply(id, false, new { error = "Busy." }); break; }
                    var next = input["settings"]?.AsObject();
                    if (next is null || !new[] { "primary", "work", "personal" }.Contains(next["account"]?.GetValue<string>()) || (next["model"]?.GetValue<string>()?.Length ?? 1000) > 80) { Reply(id, false, new { error = "Invalid settings." }); break; }
                    settings = (JsonObject)next.DeepClone(); settings["voice_mode"] = "auto";
                    Save("settings.json", settings); Reply(id, fields: new { settings }); break;
                case "history_get": Reply(id, fields: new { entries = history }); break;
                case "history_clear": history.Clear(); Save("helper-history.json", history); Reply(id); Emit("history", new { entries = history }); break;
                case "copy": if (lastText.Length == 0) Reply(id, false, new { error = "No result to copy." }); else { Clipboard.SetText(lastText); Reply(id); } break;
                case "cancel": await Cancel("command"); Reply(id); break;
                case "status":
                    if (!Begin(id, "status")) { Reply(id, false, new { error = "Busy." }); break; }
                    var version = generation;
                    commandVersion = version;
                    var status = await backend.Call(Payload("status"), _ => { }, operation!.Token);
                    if (version != generation) break;
                    Reply(id, status["ok"]?.GetValue<bool>() == true, new { result = status, permissions = Permissions() }); Finish(); break;
                case "ask":
                    var text = input["text"]?.GetValue<string>()?.Trim() ?? "";
                    if (text.Length is 0 or > 30000 || !Begin(id, "asking")) { Reply(id, false, new { error = "Add a request and finish the current operation." }); break; }
                    commandVersion = generation;
                    mode = "ask"; Reply(id, fields: new { accepted = true }); await Ask(text, generation); break;
                case "test_insertion":
                    if (!Begin(id, "inserting")) { Reply(id, false, new { error = "Busy." }); break; }
                    Reply(id, fields: new { accepted = true });
                    var testGeneration = generation;
                    commandVersion = testGeneration;
                    for (var remaining = 8; remaining > 0; remaining--) { State("test_countdown_" + remaining); await Task.Delay(1000, operation!.Token); }
                    if (testGeneration != generation) break;
                    target = FocusTarget.Capture(); lastText = requestText = "Relay insertion test.";
                    var outcome = await Insert(lastText, testGeneration);
                    if (testGeneration != generation) break;
                    var response = new JsonObject { ["ok"] = true, ["text"] = lastText, ["sources"] = new JsonArray(), ["diagnostic"] = true };
                    Result("insertion_test", response, outcome); Finish(); break;
                case "shutdown": Reply(id); Shutdown(); break;
                default: Reply(id, false, new { error = "Unsupported command. Email writes and sends are disabled." }); break;
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception) { if (commandVersion != generation) return; if (phase != "idle") Fail("The operation could not finish. Check permissions and provider setup."); else Reply(id, false, new { error = "The request could not be completed." }); }
    }
    private bool Begin(string id, string next)
    {
        if (phase != "idle") return false;
        operation?.Dispose(); operation = new CancellationTokenSource(TimeSpan.FromSeconds(150)); generation++;
        phase = next; requestId = id; lastText = requestText = ""; pasteCommitted = false; started = DateTimeOffset.UtcNow; State(); return true;
    }
    private async Task Poll()
    {
        if (shuttingDown || !shortcutRegistered) return;
        if (Native.Down(0x1B) && phase != "idle") { await Cancel("escape"); return; }
        var down = Native.Down(0x11) && Native.Down(0x10) && Native.Down(0x20);
        if (down && !held)
        {
            held = true;
            if (!Begin(Guid.NewGuid().ToString(), "recording")) return;
            mode = "auto"; target = FocusTarget.Capture();
            try
            {
                audioFolder = Path.Combine(Path.GetTempPath(), "relay-voice-" + Guid.NewGuid()); Directory.CreateDirectory(audioFolder);
                recorder = new Recorder(Path.Combine(audioFolder, "capture.wav"), level => Emit("meter", new { request_id = requestId, level, elapsed_ms = (int)(DateTimeOffset.UtcNow - started).TotalMilliseconds }));
                recorder.Start();
            }
            catch { Fail("Microphone recording could not start. Allow desktop microphone access in Windows Settings."); }
        }
        else if (!down && held)
        {
            held = false;
            if (phase == "recording") await Release();
        }
        if (phase == "recording" && DateTimeOffset.UtcNow - started > TimeSpan.FromSeconds(120)) await Cancel("recording_limit");
    }
    private async Task Release()
    {
        var active = recorder; recorder = null;
        if (active is null) return;
        var version = generation;
        var captureFolder = audioFolder;
        audioFolder = null;
        phase = "transcribing"; State();
        try
        {
            await active.Stop();
            if (version != generation) return;
            if (DateTimeOffset.UtcNow - started < TimeSpan.FromMilliseconds(300)) { Finish("short_tap"); return; }
            var payload = Payload("transcribe"); payload["audio_path"] = active.Path; payload["smart"] = true;
            var response = await backend.Call(payload, _ => { }, operation!.Token);
            if (version != generation) return;
            if (response["ok"]?.GetValue<bool>() != true) { Fail(response["error"]?.GetValue<string>() ?? "Transcription failed."); return; }
            lastText = requestText = response["text"]?.GetValue<string>() ?? "";
            if (string.IsNullOrWhiteSpace(lastText)) { Fail("No speech was transcribed."); return; }
            Emit("transcript", new { request_id = requestId, text = lastText });
            if (response["intent"]?.GetValue<string>() == "ask") { mode = "ask"; phase = "asking"; State(); await Ask(lastText, version); }
            else { mode = "dictate"; var outcome = await Insert(lastText, version); if (version == generation) { Result("dictation", response, outcome); Finish(); } }
        }
        catch (OperationCanceledException) { }
        catch { if (version == generation) Fail("The recording or provider request failed. Check your microphone and Gemini setup."); }
        finally { active.Dispose(); DeleteAudio(captureFolder); }
    }
    private Dictionary<string, object?> Payload(string action)
    {
        var payload = new Dictionary<string, object?> { ["action"] = action };
        var model = settings["model"]?.GetValue<string>(); if (!string.IsNullOrWhiteSpace(model)) payload["model"] = model;
        return payload;
    }
    private async Task Ask(string text, int version)
    {
        requestText = text; phase = "asking"; State();
        var payload = Payload("ask"); payload["text"] = text; payload["account"] = settings["account"]?.GetValue<string>() ?? "primary";
        var result = await backend.Call(payload, obj => dispatcher.BeginInvoke(new Action(() => { if (version == generation) Emit("tool", new { request_id = requestId, tool = obj }); })), operation!.Token);
        if (version != generation) return;
        if (result["ok"]?.GetValue<bool>() != true) { Fail(result["error"]?.GetValue<string>() ?? "The provider request failed."); return; }
        lastText = result["text"]?.GetValue<string>() ?? ""; Result("ask", result, "answered"); Finish();
    }
    private async Task<string> Insert(string text, int version)
    {
        if (target?.Safe != true) return "no_eligible_target";
        phase = "inserting"; State("waiting_for_keys");
        var wait = Stopwatch.StartNew();
        while (Native.ModifiersDown && wait.Elapsed < TimeSpan.FromSeconds(3)) await Task.Delay(40, operation!.Token);
        if (version != generation) return "cancelled";
        if (Native.ModifiersDown) return "modifiers_held";
        if (!target.StillFocused()) return "focus_changed";
        DataObject? previous = null;
        try
        {
            var original = Clipboard.GetDataObject();
            if (original is not null)
            {
                previous = new DataObject();
                foreach (var format in original.GetFormats(false))
                {
                    try { previous.SetData(format, original.GetData(format, false)); } catch { }
                }
            }
            Clipboard.SetText(text);
        }
        catch { return "copy_required"; }
        if (!target.StillFocused())
        {
            RestoreClipboard(previous);
            return "focus_changed";
        }
        pasteCommitted = true;
        if (!Native.Paste()) { RestoreClipboard(previous); return "copy_required"; }
        phase = "verifying"; State();
        await Task.Delay(500);
        var after = target.Read();
        var before = target.Before ?? "";
        var verified = target.StillFocused() && after is not null && after.Length >= before.Length + text.Length && after.Contains(text, StringComparison.Ordinal);
        if (verified) RestoreClipboard(previous);
        return verified ? "inserted_verified" : "paste_unverified";
    }
    private static void RestoreClipboard(DataObject? previous)
    {
        try { if (previous is null) Clipboard.Clear(); else Clipboard.SetDataObject(previous, true); } catch { }
    }
    private void Result(string kind, JsonObject result, string outcome)
    {
        Emit("result", new { request_id = requestId, kind, result, insertion = outcome, insertion_details = new { method = "guarded Windows paste", verified = outcome == "inserted_verified" } });
        var entry = new JsonObject { ["id"] = requestId, ["date"] = DateTimeOffset.UtcNow.ToString("O"), ["kind"] = kind, ["request"] = requestText, ["result"] = result.DeepClone(), ["outcome"] = outcome, ["tools"] = result["tool_events"]?.DeepClone() ?? new JsonArray() };
        history.Insert(0, entry); history = history.Take(100).ToList(); Save("helper-history.json", history); Emit("history_entry", new { entry });
    }
    private void Save(string name, object value)
    {
        try { var file = Path.Combine(folder, name); File.WriteAllText(file + ".tmp", JsonSerializer.Serialize(value)); File.Move(file + ".tmp", file, true); }
        catch { Emit("warning", new { code = "storage", message = "Local settings or history could not be saved." }); }
    }
    private void Finish(string reason = "") { phase = "idle"; target = null; pasteCommitted = false; CleanupAudio(); State(reason); }
    private void Fail(string message)
    {
        Emit("error", new { request_id = requestId, code = "operation_failed", message });
        recorder?.Dispose(); recorder = null; Finish("failed");
    }
    private async Task Cancel(string reason)
    {
        if (phase == "idle" || pasteCommitted) return;
        generation++; operation?.Cancel(); phase = "cancelling";
        var active = recorder; recorder = null;
        if (active is not null) { try { await active.Stop(); } catch { active.Dispose(); } }
        Emit("cancelled", new { request_id = requestId, reason }); Finish(reason);
    }
    private static void DeleteAudio(string? directory) { if (directory is not null) { try { Directory.Delete(directory, true); } catch { } } }
    private void CleanupAudio() { var directory = audioFolder; audioFolder = null; DeleteAudio(directory); }
    private void Shutdown() { if (shuttingDown) return; shuttingDown = true; operation?.Cancel(); recorder?.Dispose(); recorder = null; CleanupAudio(); Application.ExitThread(); }
    public void Dispose() { Shutdown(); if (shortcutRegistered) Native.UnregisterHotKey(dispatcher.Handle, 1); poll.Dispose(); dispatcher.Dispose(); operation?.Dispose(); }
}
