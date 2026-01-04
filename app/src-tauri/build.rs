fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync + 'static>> {
    let mut config = prost_build::Config::new();
    config.type_attribute(".", "#[derive(serde::Deserialize)]");

    config.compile_protos(&[
        "opentelemetry/proto/logs/v1/logs.proto",
        "opentelemetry/proto/collector/logs/v1/logs_service.proto",
        "opentelemetry/proto/collector/trace/v1/trace_service.proto",
        "opentelemetry/proto/metrics/v1/metrics.proto",
        "opentelemetry/proto/trace/v1/trace.proto"], &["."])?;
    tauri_build::build();
    Ok(())
}
