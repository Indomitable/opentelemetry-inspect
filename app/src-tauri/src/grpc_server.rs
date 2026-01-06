use tonic::{Request, Response, Status};
use crate::opentelemetry::proto::collector::logs::v1::logs_service_server::{LogsService, LogsServiceServer};
use crate::opentelemetry::proto::collector::logs::v1::{ExportLogsServiceRequest, ExportLogsServiceResponse};
use crate::opentelemetry::proto::collector::trace::v1::trace_service_server::{TraceService, TraceServiceServer};
use crate::opentelemetry::proto::collector::trace::v1::{ExportTraceServiceRequest, ExportTraceServiceResponse};
use crate::app_state::AppState;
use crate::opentelemetry::proto::collector::metrics::v1::{ExportMetricsServiceRequest, ExportMetricsServiceResponse};
use crate::opentelemetry::proto::collector::metrics::v1::metrics_service_server::{MetricsService, MetricsServiceServer};
use crate::server::shutdown_signal;

pub struct GrpcLogsService {
    state: AppState,
}

#[tonic::async_trait]
impl LogsService for GrpcLogsService {
    async fn export(
        &self,
        request: Request<ExportLogsServiceRequest>,
    ) -> Result<Response<ExportLogsServiceResponse>, Status> {
        let inner = request.into_inner();
        self.state.request_processor.process_logs(inner).await;
        Ok(Response::new(ExportLogsServiceResponse::default()))
    }
}

pub struct GrpcTraceService {
    state: AppState,
}

#[tonic::async_trait]
impl TraceService for GrpcTraceService {
    async fn export(
        &self,
        request: Request<ExportTraceServiceRequest>,
    ) -> Result<Response<ExportTraceServiceResponse>, Status> {
        let inner = request.into_inner();
        self.state.request_processor.process_traces(inner).await;
        Ok(Response::new(ExportTraceServiceResponse::default()))
    }
}

pub struct GrpcMetricsService {
    state: AppState,
}

#[tonic::async_trait]
impl MetricsService for GrpcMetricsService {
    async fn export(
        &self,
        request: Request<ExportMetricsServiceRequest>,
    ) -> Result<Response<ExportMetricsServiceResponse>, Status> {
        let inner = request.into_inner();
        self.state.request_processor.process_metrics(inner).await;
        Ok(Response::new(ExportMetricsServiceResponse::default()))
    }
}

pub async fn init_grpc(state: AppState) -> Result<(), Box<dyn std::error::Error>> {
    let addr = "[::]:4317".parse()?;
    println!("gRPC server listening on {}", addr);

    let logs_service = GrpcLogsService { state: state.clone() };
    let trace_service = GrpcTraceService { state: state.clone() };
    let metrics_service = GrpcMetricsService { state };

    tonic::transport::Server::builder()
        .add_service(LogsServiceServer::new(logs_service))
        .add_service(TraceServiceServer::new(trace_service))
        .add_service(MetricsServiceServer::new(metrics_service))
        .serve_with_shutdown(addr, shutdown_signal())
        .await?;

    Ok(())
}
