using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;

namespace RelayVoice;

internal sealed class Backend
{
    private Process? process;
    public string Executable { get; } = Environment.GetEnvironmentVariable("RELAY_BACKEND_EXECUTABLE") ?? System.IO.Path.Combine(AppContext.BaseDirectory, "backend", "relay-backend.exe");
    public bool Available => File.Exists(Executable);
    public async Task<JsonObject> Call(Dictionary<string, object?> payload, Action<JsonObject> progress, CancellationToken token)
    {
        if (!Available) throw new IOException("The bundled provider bridge is missing. Reinstall Relay Voice.");
        var start = new ProcessStartInfo(Executable) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, StandardInputEncoding = new UTF8Encoding(false), StandardOutputEncoding = new UTF8Encoding(false), StandardErrorEncoding = new UTF8Encoding(false) };
        start.Environment["RELAY_PROGRESS"] = "1";
        using var child = new Process { StartInfo = start };
        if (!child.Start()) throw new IOException("The provider bridge could not start.");
        process = child;
        using var registration = token.Register(() => { try { if (!child.HasExited) child.Kill(entireProcessTree: true); } catch { } });
        var events = Task.Run(async () =>
        {
            while (await child.StandardError.ReadLineAsync(token) is string line)
            {
                if (line.Length > 65536) continue;
                try { if (JsonNode.Parse(line) is JsonObject obj && obj["type"]?.GetValue<string>() == "tool") progress(obj); } catch (JsonException) { }
            }
        }, token);
        try
        {
            await child.StandardInput.WriteAsync(JsonSerializer.Serialize(payload));
            child.StandardInput.Close();
            var output = await child.StandardOutput.ReadToEndAsync(token);
            await child.WaitForExitAsync(token);
            await events;
            if (output.Length > 4 * 1024 * 1024) throw new IOException("The provider response was too large.");
            return JsonNode.Parse(output)?.AsObject() ?? throw new IOException("The provider response was unreadable.");
        }
        finally { if (ReferenceEquals(process, child)) process = null; }
    }
}
