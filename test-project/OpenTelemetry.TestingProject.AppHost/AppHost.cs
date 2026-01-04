var builder = DistributedApplication.CreateBuilder(args);

builder.AddProject<Projects.OpenTelemetry_TestingProject>("opentelemetry-testingproject");

builder.Build().Run();
