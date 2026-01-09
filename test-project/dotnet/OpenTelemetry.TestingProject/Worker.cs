using System.Diagnostics;
using System.Threading.Channels;
using OpenTelemetry.Context.Propagation;

namespace OpenTelemetry.TestingProject;

public record ChannelData(Dictionary<string, string> TraceContex);

public class Worker(Channel<ChannelData> channel, ActivitySource activitySource): BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var data in channel.Reader.ReadAllAsync(stoppingToken))
        {
            var extract = Propagators.DefaultTextMapPropagator.Extract(default, data.TraceContex, static (dic, k) => dic.TryGetValue(k, out var value) ? [value] : []);
            using var a0 = activitySource.StartActivity("ServiceStart", ActivityKind.Consumer, extract.ActivityContext);
            await Task.Delay(TimeSpan.FromMilliseconds(100), stoppingToken);
            using var a1 = activitySource.StartActivity("ServiceEnd");
        }
    }
}