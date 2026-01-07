fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync + 'static>> {
    tonic_prost_build::configure()
        .build_server(true)
        .build_client(false)
        .type_attribute(".", "#[allow(dead_code)]")
        .type_attribute(".", "#[allow(clippy::enum_variant_names)]")
        .type_attribute(".", "#[derive(serde::Deserialize)]")        
        .compile_protos(&[
            "opentelemetry/proto/logs/v1/logs.proto",
            "opentelemetry/proto/metrics/v1/metrics.proto",
            "opentelemetry/proto/trace/v1/trace.proto",
            "opentelemetry/proto/collector/logs/v1/logs_service.proto",
            "opentelemetry/proto/collector/metrics/v1/metrics_service.proto",
            "opentelemetry/proto/collector/trace/v1/trace_service.proto",            
        ], &["."])?;

    build();
    Ok(())
}

#[cfg(feature = "docker")]
fn build() {

}

#[cfg(feature = "tauri")]
fn build() {
    tauri_build::build();
}