use axum::extract::{State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::{http, Router};
use axum::body::Bytes;
use axum::routing::{get, post};
use tower_http::services::ServeDir;
use prost::{DecodeError, Message as ProstMessage};
use crate::{AppState};
use crate::opentelemetry::proto::collector::logs::v1::{ExportLogsServiceRequest, ExportLogsServiceResponse};
use crate::opentelemetry::proto::collector::metrics::v1::{ExportMetricsServiceRequest, ExportMetricsServiceResponse};
use crate::opentelemetry::proto::collector::trace::v1::{ExportTraceServiceRequest, ExportTraceServiceResponse};
use crate::server::shutdown_signal;
use crate::websocket_hub::websocket_handler;

const PROTOBUF_CONTENT_TYPE: &str = "application/x-protobuf";
const JSON_CONTENT_TYPE: &str = "application/json";

fn get_otlp_routes() -> Router<AppState> {
    let otlp_routes = Router::new()
        .route("/logs", post(handle_logs))
        .route("/traces", post(handle_traces))
        .route("/metrics", post(handle_metrics));    
    otlp_routes
}

pub async fn init_axum(state: AppState) -> Result<(), Box<dyn std::error::Error>> {
    let addr = "[::]:4318";
    let listener = tokio::net::TcpListener::bind(addr).await?;
    println!("Axum server listening on http://{}", addr);
    let mut app = Router::new()
        .route("/ws", get(websocket_handler))
        .nest("/v1", get_otlp_routes());

    if cfg!(feature = "docker") {
        let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "../dist".to_string());
        println!("Serving static files from: {}", static_dir);
        let serve_dir = ServeDir::new(&static_dir)
            .fallback(tower_http::services::ServeFile::new(format!("{}/index.html", static_dir)));
        app = app.fallback_service(serve_dir);
    }

    let app = app.with_state(state);
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

// Resources:
// Proto: https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/collector/logs/v1/logs_service.proto
// Collector-Go: https://github.com/open-telemetry/opentelemetry-collector/blob/main/receiver/otlpreceiver/otlphttp.go
// Aspire-Dashboard-C#: https://github.com/dotnet/aspire/blob/main/src/Aspire.Dashboard/Otlp/Http/OtlpHttpEndpointsBuilder.cs
async fn handle_logs(State(state): State<AppState>, request: axum::extract::Request) -> impl IntoResponse {
    let r = extract_request(request,
                            ExportLogsServiceRequest::decode,
                            |body| serde_json::from_slice(&body)).await;
    match r {
        Ok(r) => {
            state.request_processor.process_logs(r).await;

            let mut bytes = Vec::new();
            let export_logs_response = ExportLogsServiceResponse::default();
            ExportLogsServiceResponse::encode(&export_logs_response, &mut bytes).unwrap();
            Response::builder()
                .status(StatusCode::OK)
                .header("content-type", PROTOBUF_CONTENT_TYPE)
                .body(bytes.into())
                .unwrap()
        },
        Err(r) => r
    }
}

async fn handle_traces(State(state): State<AppState>, request: axum::extract::Request) -> impl IntoResponse {
    let r = extract_request(request,
                            ExportTraceServiceRequest::decode,
                            |body| serde_json::from_slice(&body)).await;
    match r {
        Ok(request) => {
            state.request_processor.process_traces(request).await;

            let mut bytes = Vec::new();
            let export_traces_response = ExportTraceServiceResponse::default();
            ExportTraceServiceResponse::encode(&export_traces_response, &mut bytes).unwrap();
            Response::builder()
                .status(StatusCode::OK)
                .header("content-type", PROTOBUF_CONTENT_TYPE)
                .body(bytes.into())
                .unwrap()
        },
        Err(e) => e
    }
}

async fn handle_metrics(State(state): State<AppState>, request: axum::extract::Request) -> impl IntoResponse {
    let r = extract_request(request,
                            ExportMetricsServiceRequest::decode,
                            |body| serde_json::from_slice(&body)).await;
    match r {
        Ok(request) => {
            state.request_processor.process_metrics(request).await;

            let mut bytes = Vec::new();
            let export_metrics_response = ExportMetricsServiceResponse::default();
            ExportMetricsServiceResponse::encode(&export_metrics_response, &mut bytes).unwrap();
            Response::builder()
                .status(StatusCode::OK)
                .header("content-type", PROTOBUF_CONTENT_TYPE)
                .body(bytes.into())
                .unwrap()
        },
        Err(e) => e
    }
}

fn read_content_type(headers: &http::header::HeaderMap) -> Option<&str> {
    headers.get("content-type").and_then(|v| v.to_str().ok())
}

async fn extract_request<T, TProtoExtractor, TJsonExtractor>(request: axum::extract::Request,
                                                             extractor_proto: TProtoExtractor,
                                                             extractor_json: TJsonExtractor) -> Result<T, Response>
    where TProtoExtractor: FnOnce(Bytes) -> Result<T, DecodeError>,
          TJsonExtractor: FnOnce(Bytes) -> Result<T, serde_json::Error> {
    let (parts, body) = request.into_parts();
    let content_type = read_content_type(&parts.headers);
    match content_type {
        Some(ct) => {
            let body = match axum::body::to_bytes(body, usize::MAX).await {
                Ok(bytes) => bytes,
                Err(_) => return Err((StatusCode::BAD_REQUEST, "Failed to read request body").into_response()),
            };
            if ct == PROTOBUF_CONTENT_TYPE {
                extractor_proto(body).map_err(|e| (StatusCode::BAD_REQUEST, format!("Failed to decode protobuf request body: {}", e)).into_response())
            } else if ct == JSON_CONTENT_TYPE {
                extractor_json(body).map_err(|e| (StatusCode::BAD_REQUEST, format!("Failed to decode json request body: {}", e)).into_response())
            } else {
                Err((StatusCode::BAD_REQUEST, "Not supported content type").into_response())
            }            
        },
        None => Err((StatusCode::BAD_REQUEST, "Not supported content type").into_response()),
    }
}
