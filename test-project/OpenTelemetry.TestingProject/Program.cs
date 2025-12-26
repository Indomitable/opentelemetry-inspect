using System.Diagnostics;
using OpenTelemetry;
using OpenTelemetry.Exporter;
using OpenTelemetry.Resources;

var builder = WebApplication.CreateBuilder(args);

const string activitySourceName = "OpenTelemetry.Inspect";

builder.Services.AddOpenApi();
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
    .UseOtlpExporter(OtlpExportProtocol.HttpProtobuf, new Uri("http://127.0.0.1:4318"));

builder.Services.AddSingleton<ActivitySource>(_ =>  new ActivitySource(activitySourceName));
    

var app = builder.Build();

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

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
