use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get},
    Json, Router,
};
use opentelemetry::{
    global,
    metrics::{Histogram},
    trace::{Tracer},
    KeyValue,
};
use opentelemetry_otlp::{Protocol, WithExportConfig};
use opentelemetry_sdk::{
    metrics::{SdkMeterProvider},
    resource::{Resource},
    trace::span_processor_with_async_runtime::BatchSpanProcessor,
    metrics::periodic_reader_with_async_runtime::PeriodicReader,
    logs::log_processor_with_async_runtime::BatchLogProcessor,
    runtime,
};
use opentelemetry_semantic_conventions::resource::{SERVICE_INSTANCE_ID, SERVICE_NAMESPACE, SERVICE_VERSION};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
    time::{Instant},
};
use std::sync::OnceLock;
use opentelemetry::global::BoxedTracer;
use opentelemetry::metrics::Counter;
use opentelemetry::trace::Span;
use opentelemetry_sdk::logs::SdkLoggerProvider;
use opentelemetry_sdk::trace::{SdkTracerProvider};
use tracing::log::info;
use tracing_subscriber::{EnvFilter, Layer};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Todo {
    id: String,
    title: String,
    completed: bool,
}

#[derive(Debug, Deserialize)]
struct CreateTodo {
    title: String,
}

#[derive(Debug, Deserialize)]
struct UpdateTodo {
    title: String,
    completed: bool,
}

struct AppState {
    todos: RwLock<HashMap<String, Todo>>,
    ops_counter: Counter<u64>,
    dur_histogram: Histogram<f64>,
}

const SERVICE_NAME_STR: &str = "rust-todo-service";

fn get_tracer() -> &'static BoxedTracer {
    static TRACER: OnceLock<BoxedTracer> = OnceLock::new();
    TRACER.get_or_init(|| global::tracer(SERVICE_NAME_STR))
}

#[tokio::main]
async fn main() {
    let resource = Resource::builder_empty()
        .with_service_name(SERVICE_NAME_STR)
        .with_attribute(KeyValue::new(SERVICE_VERSION,"1.0.0"))
        .with_attribute(KeyValue::new(SERVICE_NAMESPACE, "rust"))
        .with_attribute(KeyValue::new(SERVICE_INSTANCE_ID, Uuid::new_v4().to_string()))
        .build();

    // Tracing
    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .with_endpoint("http://localhost:4317/v1/traces")
        // .with_http()
        // .with_protocol(Protocol::HttpBinary)
        // .with_endpoint("http://localhost:4318/v1/traces")
        .build()
        .expect("failed to build trace exporter");


    let trace_provider = SdkTracerProvider::builder()
        .with_resource(resource.clone())
        .with_span_processor(BatchSpanProcessor::builder(exporter, runtime::Tokio).build())
        .build();
    global::set_tracer_provider(trace_provider.clone());

    // Metrics
    let exporter = opentelemetry_otlp::MetricExporter::builder()
        .with_tonic()
        .with_endpoint("http://localhost:4317/v1/metrics")
        // .with_http()
        // .with_protocol(Protocol::HttpBinary)
        // .with_endpoint("http://localhost:4318/v1/metrics")
        .build()
        .expect("failed to build metric exporter");
    let metrics_provider = SdkMeterProvider::builder()
        .with_resource(resource.clone())
        .with_reader(PeriodicReader::builder(exporter, runtime::Tokio).build())
        .build();
    global::set_meter_provider(metrics_provider.clone());

    // Logs
    let logs_exporter = opentelemetry_otlp::LogExporter::builder()
        .with_tonic()
        .with_endpoint("http://localhost:4317/v1/logs")
        // .with_http()
        // .with_endpoint("http://localhost:4318/v1/logs")
        // .with_protocol(Protocol::HttpBinary)
        .build()
        .expect("failed to build log exporter");
    let logging_provider = SdkLoggerProvider::builder()
        .with_resource(resource.clone())
        .with_log_processor(BatchLogProcessor::builder(logs_exporter, runtime::Tokio).build())
        .build();

    let filter_otel = EnvFilter::new("info")
        .add_directive("hyper=off".parse().unwrap());
    let otel_layer = opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge::new(&logging_provider)
        .with_filter(filter_otel);

    tracing_subscriber::registry()
        .with(otel_layer)
        .init();

   // let logger = logging_provider.logger(SERVICE_NAME_STR);

    // In actual implementation, we'd use global::set_logger_provider but SDK 0.27 has some changes
    // for simplicity we will use it directly in handlers if needed or skip for now if it's too complex.
    // Actually let's just use the provider to get a logger.
    
    let meter = global::meter(SERVICE_NAME_STR);
    let ops_counter = meter.u64_counter("todo.operations").with_description("Number of todo operations").build();
    let dur_histogram = meter.f64_histogram("todo.duration").with_description("Duration of todo operations").build();

    let mut todos = HashMap::new();
    todos.insert("1".to_string(), Todo { id: "1".to_string(), title: "Learn OpenTelemetry".to_string(), completed: false });
    
    let state = Arc::new(AppState {
        todos: RwLock::new(todos),
        ops_counter,
        dur_histogram,
    });

    let app = Router::new()
        .route("/todos", get(list_todos).post(add_todo))
        .route("/todos/{id}", get(get_todo).put(update_todo).delete(delete_todo))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:43524").await.unwrap();
    println!("Rust TODO service listening on http://localhost:43524");
    tokio::join!(axum::serve(listener, app)).0.expect("server failed");
    trace_provider.shutdown().expect("failed to shutdown trace provider");
    logging_provider.shutdown().expect("failed to shutdown logging provider");
    metrics_provider.shutdown().expect("failed to shutdown metrics provider");
}

fn log_info(msg: &str) {
    // Simplified: Just print to stdout. 
    // In a real app we'd use the OTel logger we set up.
    info!("{}", msg);
}

async fn list_todos(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let start = Instant::now();
    let tracer = get_tracer();
    let mut _span = tracer.start("ListTodos");
    _span.set_attribute(KeyValue::new("endpoint", "/todos"));
    
    log_info("Processing GET /todos");
    
    let todos = state.todos.read().unwrap();
    let list: Vec<Todo> = todos.values().cloned().collect();
    
    let duration = start.elapsed().as_secs_f64();
    state.dur_histogram.record(duration, &[KeyValue::new("operation", "ListTodos")]);
    state.ops_counter.add(1, &[KeyValue::new("operation", "ListTodos"), KeyValue::new("status", "success")]);
    
    log_info("Finished GET /todos");
    Json(list)
}

async fn get_todo(Path(id): Path<String>, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let start = Instant::now();
    let tracer = global::tracer(SERVICE_NAME_STR);
    let _span = tracer.start("GetTodo");
    
    log_info(&format!("Processing GET /todos/{}", id));
    
    let todos = state.todos.read().unwrap();
    if let Some(todo) = todos.get(&id) {
        let duration = start.elapsed().as_secs_f64();
        state.dur_histogram.record(duration, &[KeyValue::new("operation", "GetTodo")]);
        state.ops_counter.add(1, &[KeyValue::new("operation", "GetTodo"), KeyValue::new("status", "success")]);
        log_info(&format!("Finished GET /todos/{}", id));
        return (StatusCode::OK, Json(todo.clone())).into_response();
    }
    
    state.ops_counter.add(1, &[KeyValue::new("operation", "GetTodo"), KeyValue::new("status", "not_found")]);
    (StatusCode::NOT_FOUND, "Todo not found").into_response()
}

async fn add_todo(State(state): State<Arc<AppState>>, Json(payload): Json<CreateTodo>) -> impl IntoResponse {
    let start = Instant::now();
    let tracer = global::tracer(SERVICE_NAME_STR);
    let _span = tracer.start("AddTodo");
    
    log_info("Processing POST /todos");
    
    let id = Uuid::new_v4().to_string();
    let todo = Todo {
        id: id.clone(),
        title: payload.title,
        completed: false,
    };
    
    state.todos.write().unwrap().insert(id, todo.clone());
    
    let duration = start.elapsed().as_secs_f64();
    state.dur_histogram.record(duration, &[KeyValue::new("operation", "AddTodo")]);
    state.ops_counter.add(1, &[KeyValue::new("operation", "AddTodo"), KeyValue::new("status", "success")]);
    
    log_info("Finished POST /todos");
    (StatusCode::CREATED, Json(todo)).into_response()
}

async fn update_todo(Path(id): Path<String>, State(state): State<Arc<AppState>>, Json(payload): Json<UpdateTodo>) -> impl IntoResponse {
    let start = Instant::now();
    let tracer = global::tracer(SERVICE_NAME_STR);
    let _span = tracer.start("UpdateTodo");
    
    log_info(&format!("Processing PUT /todos/{}", id));
    
    let mut todos = state.todos.write().unwrap();
    if let Some(todo) = todos.get_mut(&id) {
        todo.title = payload.title;
        todo.completed = payload.completed;
        let updated = todo.clone();
        
        let duration = start.elapsed().as_secs_f64();
        state.dur_histogram.record(duration, &[KeyValue::new("operation", "UpdateTodo")]);
        state.ops_counter.add(1, &[KeyValue::new("operation", "UpdateTodo"), KeyValue::new("status", "success")]);
        log_info(&format!("Finished PUT /todos/{}", id));
        return (StatusCode::OK, Json(updated)).into_response();
    }
    
    state.ops_counter.add(1, &[KeyValue::new("operation", "UpdateTodo"), KeyValue::new("status", "not_found")]);
    (StatusCode::NOT_FOUND, "Todo not found").into_response()
}

async fn delete_todo(Path(id): Path<String>, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let start = Instant::now();
    let tracer = global::tracer(SERVICE_NAME_STR);
    let _span = tracer.start("DeleteTodo");
    
    log_info(&format!("Processing DELETE /todos/{}", id));
    
    let mut todos = state.todos.write().unwrap();
    if todos.remove(&id).is_some() {
        let duration = start.elapsed().as_secs_f64();
        state.dur_histogram.record(duration, &[KeyValue::new("operation", "DeleteTodo")]);
        state.ops_counter.add(1, &[KeyValue::new("operation", "DeleteTodo"), KeyValue::new("status", "success")]);
        log_info(&format!("Finished DELETE /todos/{}", id));
        return StatusCode::NO_CONTENT.into_response();
    }
    
    state.ops_counter.add(1, &[KeyValue::new("operation", "DeleteTodo"), KeyValue::new("status", "not_found")]);
    (StatusCode::NOT_FOUND, "Todo not found").into_response()
}
