using System.Diagnostics;
using System.Diagnostics.Metrics;
using OpenTelemetry;
using OpenTelemetry.Exporter;
using OpenTelemetry.Resources;

var builder = WebApplication.CreateBuilder(args);

const string activitySourceName = "OpenTelemetry.Inspect";

builder.Services.AddOpenApi();
///
/// <see ref="OtlpExporterOptions" />
/// internal const string DefaultGrpcEndpoint = "http://localhost:4317";
/// internal const string DefaultHttpEndpoint = "http://localhost:4318";
///
// if OTEL_EXPORTER_OTLP_ENDPOINT is set from OT plugin.
// https://github.com/open-telemetry/opentelemetry-dotnet/tree/main/src/OpenTelemetry.Exporter.OpenTelemetryProtocol#environment-variables
// https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/#endpoint-configuration
var otlpAddress = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT");
var protocol = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_PROTOCOL"); // can be "grpc", "http/protobuf" or "http/json"
builder.Services.AddOpenTelemetry()
    .ConfigureResource(rb =>
    {
        rb.AddService(activitySourceName, "open-telemetry-inspect", "1.0.0");
    })
    .WithTracing(tb =>
    {
        tb.AddSource(activitySourceName);
    })
    .WithLogging()
    .WithMetrics(mb =>
    {
        mb.AddMeter(activitySourceName);
    })
    .UseOtlpExporter(string.IsNullOrEmpty(protocol) || protocol == "grpc" ? OtlpExportProtocol.Grpc : OtlpExportProtocol.HttpProtobuf, new Uri(otlpAddress ?? "http://127.0.0.1:4318"));

builder.Services.AddSingleton<ActivitySource>(_ =>  new ActivitySource(activitySourceName));
builder.Services.AddSingleton<Meter>(_ => new Meter(activitySourceName));

var app = builder.Build();

var logger = app.Services.GetRequiredService<ILogger<WeatherForecast>>();
logger.LogCritical("Application has been built.");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", async (ActivitySource activitySource, Meter meter, ILogger<WeatherForecast> logger) =>
{
    using var activity = activitySource.StartActivity("GetWeatherForecast", ActivityKind.Server, null, new Dictionary<string, object?>()
    {
        ["date"] = DateTimeOffset.UtcNow
    });
    logger.LogInformation("Weather forecast for {date}", DateTimeOffset.UtcNow);
    
    var historgram = meter.CreateHistogram<long>("TimeToFetch", "ms", "Time to fetch weather forecast",
        new Dictionary<string, object?>
        {
            ["date"] = DateTimeOffset.UtcNow
        });
    
    var counter = meter.CreateCounter<long>("CalledCount", "units", "How many times the endpoint is called", [
        new KeyValuePair<string, object?>("Endpoint", "GetWeatherForecast")
    ]);
    counter.Add(1, new KeyValuePair<string, object?>("TemperatureC", 1));
    
    var upDown = meter.CreateUpDownCounter<int>("ProcessingRequests", "requests", "How many current requests are processed", [new KeyValuePair<string, object?>("test", true)]);
    upDown.Add(1);
    
    var gauge = meter.CreateGauge<long>("CurrentMemory", "bytes", "How much memory is allocated.", [ new KeyValuePair<string, object?>("test", new Dictionary<string, string> { ["test"] = "1" })]);
    var watch = Stopwatch.StartNew();
    gauge.Record(GC.GetTotalAllocatedBytes());
    
    await Task.Delay(TimeSpan.FromMilliseconds(Random.Shared.Next(10, 2000)));
    
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    
    upDown.Add(-1);
    watch.Stop();
    historgram.Record(watch.ElapsedMilliseconds, new KeyValuePair<string, object?>("status", 1));
    return forecast;
})
.WithName("GetWeatherForecast");

logger.LogError(new Exception("Test Exception"), "Starting application.");
app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
