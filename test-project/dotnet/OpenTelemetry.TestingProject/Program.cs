using System.Diagnostics;
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
    .UseOtlpExporter(string.IsNullOrEmpty(protocol) || protocol == "grpc" ? OtlpExportProtocol.Grpc : OtlpExportProtocol.HttpProtobuf, new Uri(otlpAddress ?? "http://127.0.0.1:4318"));

builder.Services.AddSingleton<ActivitySource>(_ =>  new ActivitySource(activitySourceName));


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

app.MapGet("/weatherforecast", (ActivitySource activitySource, ILogger<WeatherForecast> logger) =>
{
    using var activity = activitySource.StartActivity("GetWeatherForecast", ActivityKind.Server, null, new Dictionary<string, object?>()
    {
        ["date"] = DateTimeOffset.UtcNow
    });
    logger.LogInformation("Weather forecast for {date}", DateTimeOffset.UtcNow);
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

logger.LogError(new Exception("Test Exception"), "Starting application.");
app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
