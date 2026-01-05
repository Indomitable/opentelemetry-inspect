use tonic::{Request, Response, Status};
use crate::opentelemetry::proto::collector::logs::v1::logs_service_server::{LogsService, LogsServiceServer};
use crate::opentelemetry::proto::collector::logs::v1::{ExportLogsServiceRequest, ExportLogsServiceResponse};
use crate::opentelemetry::proto::collector::trace::v1::trace_service_server::{TraceService, TraceServiceServer};
use crate::opentelemetry::proto::collector::trace::v1::{ExportTraceServiceRequest, ExportTraceServiceResponse};
use crate::app_state::AppState;
use crate::server::shutdown_signal;

pub struct MyLogsService {
    state: AppState,
}

#[tonic::async_trait]
impl LogsService for MyLogsService {
    async fn export(
        &self,
        request: Request<ExportLogsServiceRequest>,
    ) -> Result<Response<ExportLogsServiceResponse>, Status> {
        let inner = request.into_inner();
        self.state.request_processor.process_logs(inner).await;
        Ok(Response::new(ExportLogsServiceResponse::default()))
    }
}

pub struct MyTraceService {
    state: AppState,
}

#[tonic::async_trait]
impl TraceService for MyTraceService {
    async fn export(
        &self,
        request: Request<ExportTraceServiceRequest>,
    ) -> Result<Response<ExportTraceServiceResponse>, Status> {
        let inner = request.into_inner();
        self.state.request_processor.process_traces(inner).await;
        Ok(Response::new(ExportTraceServiceResponse::default()))
    }
}

pub async fn init_grpc(state: AppState) -> Result<(), Box<dyn std::error::Error>> {
    let addr = "[::]:4317".parse()?;
    println!("gRPC server listening on {}", addr);

    let logs_service = MyLogsService { state: state.clone() };
    let trace_service = MyTraceService { state };

    tonic::transport::Server::builder()
        .add_service(LogsServiceServer::new(logs_service))
        .add_service(TraceServiceServer::new(trace_service))
        .serve_with_shutdown(addr, shutdown_signal())
        .await?;

    Ok(())
}
