use axum::extract::{State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Router;
use axum::routing::{get, post};
use prost::Message as ProstMessage;
use crate::{opentelemetry, AppState};
use crate::domain::logs::LogDto;
use crate::opentelemetry::proto::collector::logs::v1::{ExportLogsServiceRequest, ExportLogsServiceResponse};
use crate::opentelemetry::proto::collector::trace::v1::ExportTraceServiceResponse;
use crate::websocket_hub::websocket_handler;

fn get_otlp_routes() -> Router<AppState> {
    let otlp_routes = Router::new()
        .route("/logs", post(handle_logs))
        .route("/traces", post(handle_traces));
    otlp_routes
}

pub async fn init_axum(state: AppState) -> Result<(), Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:4318").await?;
    let app = Router::new()
        .route("/ws", get(websocket_handler))
        .nest("/v1", get_otlp_routes())
        .with_state(state);
    axum::serve(listener, app).await?;
    Ok(())
}

// Resources:
// Proto: https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/collector/logs/v1/logs_service.proto
// Collector-Go: https://github.com/open-telemetry/opentelemetry-collector/blob/main/receiver/otlpreceiver/otlphttp.go
// Aspire-Dashboard-C#: https://github.com/dotnet/aspire/blob/main/src/Aspire.Dashboard/Otlp/Http/OtlpHttpEndpointsBuilder.cs
async fn handle_logs(State(state): State<AppState>, request: axum::extract::Request) -> impl IntoResponse {
    let body = match axum::body::to_bytes(request.into_body(), usize::MAX).await {
        Ok(bytes) => bytes,
        Err(_) => return (StatusCode::BAD_REQUEST, "Failed to read request body").into_response(),
    };
    let request = ExportLogsServiceRequest::decode(body).unwrap();

    for resource_log in request.resource_logs {
        let resource = resource_log.resource.as_ref();
        for scope_log in resource_log.scope_logs {
            let scope = scope_log.scope.as_ref();
            for log_record in scope_log.log_records {
                let dto = LogDto::from_otlp(log_record, scope, resource);
                let payload = serde_json::to_string(&dto).unwrap();
                let _ = state.subscription_manager.read().await.publish("logs", &payload);
            }
        }
    }

    let mut bytes = Vec::new();
    let export_logs_response = ExportLogsServiceResponse::default();
    ExportLogsServiceResponse::encode(&export_logs_response, &mut bytes).unwrap();
    Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "application/x-protobuf")
        .body(bytes.into())
        .unwrap()
}

async fn handle_traces(State(state): State<AppState>, request: axum::extract::Request) -> impl IntoResponse {
    let body = match axum::body::to_bytes(request.into_body(), usize::MAX).await {
        Ok(bytes) => bytes,
        Err(_) => return (StatusCode::BAD_REQUEST, "Failed to read request body").into_response(),
    };
    let request = opentelemetry::proto::collector::trace::v1::ExportTraceServiceRequest::decode(body).unwrap();
    println!("Received {:?} spans", request);

    let mut bytes = Vec::new();
    let export_traces_response = ExportTraceServiceResponse::default();
    ExportTraceServiceResponse::encode(&export_traces_response, &mut bytes).unwrap();
    Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "application/x-protobuf")
        .body(bytes.into())
        .unwrap()
}

