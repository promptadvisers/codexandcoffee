using System;
using System.IO;
using System.Threading.Tasks;
using NAudio.Wave;

namespace RelayVoice;

internal sealed class Recorder : IDisposable
{
    private readonly WaveInEvent input;
    private readonly WaveFileWriter writer;
    private readonly TaskCompletionSource stopped = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly object gate = new();
    private bool disposed;
    public string Path { get; }
    public Recorder(string path, Action<double> meter)
    {
        Path = path;
        input = new WaveInEvent { WaveFormat = new WaveFormat(16000, 16, 1), BufferMilliseconds = 50 };
        writer = new WaveFileWriter(path, input.WaveFormat);
        input.DataAvailable += (_, e) =>
        {
            lock (gate)
            {
                if (disposed) return;
                writer.Write(e.Buffer, 0, e.BytesRecorded);
            }
            double energy = 0;
            for (var i = 0; i + 1 < e.BytesRecorded; i += 2)
            {
                var sample = (short)(e.Buffer[i] | (e.Buffer[i + 1] << 8)) / 32768.0;
                energy += sample * sample;
            }
            meter(Math.Min(1, Math.Sqrt(energy / Math.Max(1, e.BytesRecorded / 2)) * 4));
        };
        input.RecordingStopped += (_, e) => { if (e.Exception is null) stopped.TrySetResult(); else stopped.TrySetException(e.Exception); };
    }
    public void Start() => input.StartRecording();
    public async Task Stop()
    {
        input.StopRecording();
        await stopped.Task.WaitAsync(TimeSpan.FromSeconds(3));
        Dispose();
    }
    public void Dispose()
    {
        lock (gate)
        {
            if (disposed) return;
            disposed = true;
        }
        // Disposal can wait for a pending audio callback, so release the gate first.
        input.Dispose();
        lock (gate) writer.Dispose();
    }
}
