### Open Telemetry Inspector

# Desktop Application for Inspecting OpenTelemetry Data

Uses the OpenTelemetry Protocol (OTLP) to receive, decode, and display telemetry data such as traces, metrics, and logs.
This tool is designed to help developers and DevOps engineers visualize and analyze telemetry data for debugging and performance monitoring.

## Features
- Desktop application built with Tauri and Vue.js
- Dockerized for easy deployment
    - Build: `podman build . -f Dockerfile -t opentelemetry-inspect:latest`
    - Run: `podman run -d --rm -p 4318:4318 --name opentelemetry-inspect opentelemetry-inspect:latest`
- Receives OpenTelemetry data via OTLP over HTTP on port 4318 supports protobuf and JSON formats