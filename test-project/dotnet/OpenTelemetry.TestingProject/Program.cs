using System.Diagnostics;
using System.Diagnostics.Metrics;
using Microsoft.AspNetCore.Http.Features;
using OpenTelemetry;
using OpenTelemetry.Exporter;
using OpenTelemetry.Resources;
using Microsoft.AspNetCore.Mvc;
using OpenTelemetry.Context.Propagation;

var builder = WebApplication.CreateBuilder(args);

const string serviceName = "dotnet-todo-service";

builder.Services.AddOpenApi();

builder.Services.AddOpenTelemetry()
    .ConfigureResource(rb =>
    {
        rb.AddService(serviceName, serviceVersion: "1.0.0");
    })
    .WithTracing(tb =>
    {
        tb.AddSource(serviceName);
    })
    .WithLogging()
    .WithMetrics(mb =>
    {
        mb.AddMeter(serviceName);
    })
    .UseOtlpExporter();

builder.Services.AddSingleton<ActivitySource>(_ => new ActivitySource(serviceName));
builder.Services.AddSingleton<Meter>(_ => new Meter(serviceName));

var app = builder.Build();

var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("Application starting...");

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

var todos = new List<Todo>
{
    new Todo(Guid.NewGuid().ToString(), "Learn OpenTelemetry", false)
};

app.MapGet("/todos", (ActivitySource activitySource, Meter meter, ILogger<Program> logger) =>
{
    var startTime = Stopwatch.GetTimestamp();
    using var activity = activitySource.StartActivity("ListTodos");
    logger.LogInformation("Processing GET /todos");

    var durationHistogram = meter.CreateHistogram<double>("todo.duration");
    var opsCounter = meter.CreateCounter<long>("todo.operations");

    var result = todos.ToArray();

    var elapsed = Stopwatch.GetElapsedTime(startTime).TotalSeconds;
    durationHistogram.Record(elapsed, new KeyValuePair<string, object?>("operation", "ListTodos"));
    opsCounter.Add(1, new KeyValuePair<string, object?>("operation", "ListTodos"), new KeyValuePair<string, object?>("status", "success"));
    logger.LogInformation("Finished GET /todos");
    return Results.Ok(result);
});

app.MapGet("/todos/{id}", (string id, ActivitySource activitySource, Meter meter, ILogger<Program> logger) =>
{
    var startTime = Stopwatch.GetTimestamp();
    using var activity = activitySource.StartActivity("GetTodo");
    logger.LogInformation("Processing GET /todos/{id}", id);

    var durationHistogram = meter.CreateHistogram<double>("todo.duration");
    var opsCounter = meter.CreateCounter<long>("todo.operations");

    var todo = todos.FirstOrDefault(t => t.Id == id);
    if (todo == null)
    {
        opsCounter.Add(1, new KeyValuePair<string, object?>("operation", "GetTodo"), new KeyValuePair<string, object?>("status", "not_found"));
        return Results.NotFound();
    }

    var elapsed = Stopwatch.GetElapsedTime(startTime).TotalSeconds;
    durationHistogram.Record(elapsed, new KeyValuePair<string, object?>("operation", "GetTodo"));
    opsCounter.Add(1, new KeyValuePair<string, object?>("operation", "GetTodo"), new KeyValuePair<string, object?>("status", "success"));
    logger.LogInformation("Finished GET /todos/{id}", id);
    return Results.Ok(todo);
});

app.MapPost("/todos", ([FromBody] TodoInput input, ActivitySource activitySource, Meter meter, ILogger<Program> logger) =>
{
    var startTime = Stopwatch.GetTimestamp();
    using var activity = activitySource.StartActivity("AddTodo");
    logger.LogInformation("Processing POST /todos");

    var durationHistogram = meter.CreateHistogram<double>("todo.duration");
    var opsCounter = meter.CreateCounter<long>("todo.operations");

    var todo = new Todo(Guid.NewGuid().ToString(), input.Title, false);
    todos.Add(todo);

    var elapsed = Stopwatch.GetElapsedTime(startTime).TotalSeconds;
    durationHistogram.Record(elapsed, new KeyValuePair<string, object?>("operation", "AddTodo"));
    opsCounter.Add(1, new KeyValuePair<string, object?>("operation", "AddTodo"), new KeyValuePair<string, object?>("status", "success"));
    logger.LogInformation("Finished POST /todos");
    return Results.Created($"/todos/{todo.Id}", todo);
});

app.MapPut("/todos/{id}", (string id, [FromBody] TodoUpdate input, ActivitySource activitySource, Meter meter, ILogger<Program> logger) =>
{
    var startTime = Stopwatch.GetTimestamp();
    using var activity = activitySource.StartActivity("UpdateTodo");
    logger.LogInformation("Processing PUT /todos/{id}", id);

    var durationHistogram = meter.CreateHistogram<double>("todo.duration");
    var opsCounter = meter.CreateCounter<long>("todo.operations");

    var index = todos.FindIndex(t => t.Id == id);
    if (index == -1)
    {
        opsCounter.Add(1, new KeyValuePair<string, object?>("operation", "UpdateTodo"), new KeyValuePair<string, object?>("status", "not_found"));
        return Results.NotFound();
    }

    todos[index] = todos[index] with { Title = input.Title, Completed = input.Completed };

    var elapsed = Stopwatch.GetElapsedTime(startTime).TotalSeconds;
    durationHistogram.Record(elapsed, new KeyValuePair<string, object?>("operation", "UpdateTodo"));
    opsCounter.Add(1, new KeyValuePair<string, object?>("operation", "UpdateTodo"), new KeyValuePair<string, object?>("status", "success"));
    logger.LogInformation("Finished PUT /todos/{id}", id);
    return Results.Ok(todos[index]);
});

app.MapDelete("/todos/{id}", (string id, ActivitySource activitySource, Meter meter, ILogger<Program> logger) =>
{
    var startTime = Stopwatch.GetTimestamp();
    using var activity = activitySource.StartActivity("DeleteTodo");
    logger.LogInformation("Processing DELETE /todos/{id}", id);

    var durationHistogram = meter.CreateHistogram<double>("todo.duration");
    var opsCounter = meter.CreateCounter<long>("todo.operations");

    var index = todos.FindIndex(t => t.Id == id);
    if (index == -1)
    {
        opsCounter.Add(1, new KeyValuePair<string, object?>("operation", "DeleteTodo"), new KeyValuePair<string, object?>("status", "not_found"));
        return Results.NotFound();
    }

    todos.RemoveAt(index);

    var elapsed = Stopwatch.GetElapsedTime(startTime).TotalSeconds;
    durationHistogram.Record(elapsed, new KeyValuePair<string, object?>("operation", "DeleteTodo"));
    opsCounter.Add(1, new KeyValuePair<string, object?>("operation", "DeleteTodo"), new KeyValuePair<string, object?>("status", "success"));
    logger.LogInformation("Finished DELETE /todos/{id}", id);
    return Results.NoContent();
});

app.MapGet("/test-sequence-of-spans", async (ActivitySource activitySource) =>
{
    var activity0 = activitySource.StartActivity("First", ActivityKind.Server);
    var activity1 = activitySource.StartActivity("Second", ActivityKind.Producer);

    var pg = new PropagationContext(activity0!.Context, Baggage.Current);
    var container = new Dictionary<string, object>();
    Propagators.DefaultTextMapPropagator.Inject(pg,  container, static (dic, k, v) => dic[k] = v);
    await Task.Delay(TimeSpan.FromMilliseconds(10));
    activity1.Dispose();
    await Task.Delay(TimeSpan.FromMilliseconds(15));
    activity0.Dispose();
    
    
    var extract = Propagators.DefaultTextMapPropagator.Extract(default, container, static (dic, k) =>
    {
        if (dic.TryGetValue(k, out var value))
        {
            return [(string)value];
        }

        return [];
    });
    await Task.Delay(TimeSpan.FromMilliseconds(5));
    using var activity2 = activitySource.StartActivity("Third", ActivityKind.Consumer, extract.ActivityContext);
    await Task.Delay(TimeSpan.FromMilliseconds(10));
    using var activity3 = activitySource.StartActivity("Fourth");
    await Task.Delay(TimeSpan.FromMilliseconds(20));

    using var client = new HttpClient();
    client.BaseAddress = new Uri("http://localhost:5262");
    await client.GetAsync("/todos");
});

// app.Use(async (HttpContext context, Func<Task> next) =>
// {
//     //var feature = context.Features.Get<IHttpActivityFeature>();
//     var activity = Activity.Current;
//     if (activity is not null)
//     {
//         var pc = new PropagationContext(activity.Context,  Baggage.Create(new Dictionary<string, string>(activity.Baggage!)));
//         Propagators.DefaultTextMapPropagator.Inject(pc, context.Response.Headers, static (headers, k, v) => headers[k] = v);
//     }
//
//     await next();
// });

app.Run();

record Todo(string Id, string Title, bool Completed);
record TodoInput(string Title);
record TodoUpdate(string Title, bool Completed);
