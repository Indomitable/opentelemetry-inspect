import time
import uuid
import logging
from flask import Flask, request, jsonify

from opentelemetry import trace, metrics, _logs
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.trace import SpanKind

# --- OpenTelemetry Setup ---
service_name = "python-todo-service"
resource = Resource(attributes={SERVICE_NAME: service_name, "service.version": "1.0.0"})

# Tracing
trace_provider = TracerProvider(resource=resource)
trace_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint="http://localhost:4318/v1/traces")))
trace.set_tracer_provider(trace_provider)
tracer = trace.get_tracer(service_name)

# Metrics
metric_reader = PeriodicExportingMetricReader(OTLPMetricExporter(endpoint="http://localhost:4318/v1/metrics"))
meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
metrics.set_meter_provider(meter_provider)
meter = metrics.get_meter(service_name)
ops_counter = meter.create_counter("todo.operations", description="Number of todo operations")
dur_histogram = meter.create_histogram("todo.duration", description="Duration of todo operations")

# Logs
log_provider = LoggerProvider(resource=resource)
log_provider.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter(endpoint="http://localhost:4318/v1/logs")))
_logs.set_logger_provider(log_provider)
handler = LoggingHandler(level=logging.INFO, logger_provider=log_provider)
logging.basicConfig(handlers=[handler], level=logging.INFO)
logger = logging.getLogger(__name__)

def log_info(message):
    current_span = trace.get_current_span()
    ctx = current_span.get_span_context()
    logger.info(message)

# --- Flask App ---
app = Flask(__name__)

todos = [{"id": "1", "title": "Learn OpenTelemetry", "completed": False}]

@app.route("/todos", methods=["GET"])
def get_todos():
    start_time = time.time()
    with tracer.start_as_current_span("ListTodos") as span:
        log_info("Processing GET /todos")
        response = jsonify(todos)
        
        duration = time.time() - start_time
        dur_histogram.record(duration, {"operation": "ListTodos"})
        ops_counter.add(1, {"operation": "ListTodos", "status": "success"})
        log_info("Finished GET /todos")
        return response

@app.route("/todos/<id>", methods=["GET"])
def get_todo(id):
    start_time = time.time()
    with tracer.start_as_current_span("GetTodo") as span:
        log_info(f"Processing GET /todos/{id}")
        todo = next((t for t in todos if t["id"] == id), None)
        if not todo:
            ops_counter.add(1, {"operation": "GetTodo", "status": "not_found"})
            return "Todo not found", 404
        
        response = jsonify(todo)
        duration = time.time() - start_time
        dur_histogram.record(duration, {"operation": "GetTodo"})
        ops_counter.add(1, {"operation": "GetTodo", "status": "success"})
        log_info(f"Finished GET /todos/{id}")
        return response

@app.route("/todos", methods=["POST"])
def add_todo():
    start_time = time.time()
    with tracer.start_as_current_span("AddTodo") as span:
        log_info("Processing POST /todos")
        data = request.json
        todo = {
            "id": str(uuid.uuid4()),
            "title": data.get("title"),
            "completed": False
        }
        todos.append(todo)
        
        response = jsonify(todo), 201
        duration = time.time() - start_time
        dur_histogram.record(duration, {"operation": "AddTodo"})
        ops_counter.add(1, {"operation": "AddTodo", "status": "success"})
        log_info("Finished POST /todos")
        return response

@app.route("/todos/<id>", methods=["PUT"])
def update_todo(id):
    start_time = time.time()
    with tracer.start_as_current_span("UpdateTodo") as span:
        log_info(f"Processing PUT /todos/{id}")
        data = request.json
        todo = next((t for t in todos if t["id"] == id), None)
        if not todo:
            ops_counter.add(1, {"operation": "UpdateTodo", "status": "not_found"})
            return "Todo not found", 404
        
        todo["title"] = data.get("title")
        todo["completed"] = data.get("completed")
        
        response = jsonify(todo)
        duration = time.time() - start_time
        dur_histogram.record(duration, {"operation": "UpdateTodo"})
        ops_counter.add(1, {"operation": "UpdateTodo", "status": "success"})
        log_info(f"Finished PUT /todos/{id}")
        return response

@app.route("/todos/<id>", methods=["DELETE"])
def delete_todo(id):
    start_time = time.time()
    with tracer.start_as_current_span("DeleteTodo") as span:
        log_info(f"Processing DELETE /todos/{id}")
        global todos
        todo = next((t for t in todos if t["id"] == id), None)
        if not todo:
            ops_counter.add(1, {"operation": "DeleteTodo", "status": "not_found"})
            return "Todo not found", 404
        
        todos = [t for t in todos if t["id"] != id]
        
        duration = time.time() - start_time
        dur_histogram.record(duration, {"operation": "DeleteTodo"})
        ops_counter.add(1, {"operation": "DeleteTodo", "status": "success"})
        log_info(f"Finished DELETE /todos/{id}")
        return "", 24

if __name__ == "__main__":
    print("Python TODO service listening on http://localhost:43523")
    app.run(port=43523)
