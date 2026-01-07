package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	logbridge "go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
)

var (
	tracer       trace.Tracer
	logger       *slog.Logger
	meter        metric.Meter
	opsCounter   metric.Int64Counter
	durHistogram metric.Float64Histogram
)

type Todo struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
}

var (
	todos = []Todo{
		{ID: "1", Title: "Learn OpenTelemetry", Completed: false},
	}
	mu sync.Mutex
)

const serviceName = "go-todo-service"

func main() {
	// Handle SIGINT (CTRL+C) gracefully.
	log.Printf("Starting application... http://localhost:43521")
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	shutdown, err := setupOTelSDK(ctx)
	if err != nil {
		log.Fatalf("failed to initialize OTel SDK: %v", err)
	}
	defer func() {
		if err := shutdown(context.Background()); err != nil {
			log.Printf("failed to shutdown OTel SDK: %v", err)
		}
	}()

	tracer = otel.Tracer(serviceName)
	meter = otel.Meter(serviceName)
	logger = logbridge.NewLogger(serviceName)

	var errMetric error
	opsCounter, errMetric = meter.Int64Counter("todo.operations", metric.WithDescription("Number of todo operations"))
	if errMetric != nil {
		log.Fatalf("failed to create counter: %v", errMetric)
	}
	durHistogram, errMetric = meter.Float64Histogram("todo.duration", metric.WithDescription("Duration of todo operations"))
	if errMetric != nil {
		log.Fatalf("failed to create histogram: %v", errMetric)
	}

	logger.Info("Starting application...")

	err = startServer(ctx, stop)
	if err != nil {
		logger.Error("failed to start server", "error", err)
	}
}

func startServer(ctx context.Context, stop func()) error {
	r := mux.NewRouter()
	r.HandleFunc("/todos", getTodos).Methods("GET")
	r.HandleFunc("/todos", createTodo).Methods("POST")
	r.HandleFunc("/todos/{id}", getTodo).Methods("GET")
	r.HandleFunc("/todos/{id}", updateTodo).Methods("PUT")
	r.HandleFunc("/todos/{id}", deleteTodo).Methods("DELETE")

	logger.Info("Server listening on :43521")
	srv := &http.Server{
		Addr:         ":43521",
		BaseContext:  func(_ net.Listener) context.Context { return ctx },
		ReadTimeout:  time.Second,
		WriteTimeout: 10 * time.Second,
		Handler:      r,
	}
	srvErr := make(chan error, 1)
	go func() {
		srvErr <- srv.ListenAndServe()
	}()

	// Wait for interruption.
	select {
	case err := <-srvErr:
		// Error when starting HTTP server.
		return err
	case <-ctx.Done():
		// Wait for first CTRL+C.
		// Stop receiving signal notifications as soon as possible.
		logger.Info("Application finished.")
		stop()
	}

	// When Shutdown is called, ListenAndServe immediately returns ErrServerClosed.
	err := srv.Shutdown(context.Background())
	return err
}

func setupOTelSDK(ctx context.Context) (func(context.Context) error, error) {
	var shutdownFuncs []func(context.Context) error

	shutdown := func(ctx context.Context) error {
		var err error
		for _, fn := range shutdownFuncs {
			err = errors.Join(err, fn(ctx))
		}
		shutdownFuncs = nil
		return err
	}

	handleErr := func(inErr error) {
		_ = shutdown(ctx)
	}

	// Set up propagator.
	prop := newPropagator()
	otel.SetTextMapPropagator(prop)

	// Set up resource.
	res, _ := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceNameKey.String(serviceName),
			semconv.ServiceVersionKey.String("1.0.0"),
		),
	)

	// Set up trace provider.
	tracerProvider, err := newTracerProvider(ctx, res)
	if err != nil {
		handleErr(err)
		return shutdown, err
	}
	shutdownFuncs = append(shutdownFuncs, tracerProvider.Shutdown)
	otel.SetTracerProvider(tracerProvider)

	// Set up meter provider.
	meterProvider, err := newMeterProvider(ctx, res)
	if err != nil {
		handleErr(err)
		return shutdown, err
	}
	shutdownFuncs = append(shutdownFuncs, meterProvider.Shutdown)
	otel.SetMeterProvider(meterProvider)

	// Set up logger provider.
	loggerProvider, err := newLoggerProvider(ctx, res)
	if err != nil {
		handleErr(err)
		return shutdown, err
	}
	shutdownFuncs = append(shutdownFuncs, loggerProvider.Shutdown)
	global.SetLoggerProvider(loggerProvider)

	return shutdown, nil
}

func newPropagator() propagation.TextMapPropagator {
	return propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	)
}

func newTracerProvider(ctx context.Context, res *resource.Resource) (*sdktrace.TracerProvider, error) {
	exporter, err := otlptracehttp.New(ctx, otlptracehttp.WithInsecure(), otlptracehttp.WithEndpoint("localhost:4318"))
	if err != nil {
		return nil, err
	}
	traceProvider := sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
		sdktrace.WithBatcher(exporter),
	)
	return traceProvider, nil
}

func newMeterProvider(ctx context.Context, res *resource.Resource) (*sdkmetric.MeterProvider, error) {
	exporter, err := otlpmetrichttp.New(ctx, otlpmetrichttp.WithInsecure(), otlpmetrichttp.WithEndpoint("localhost:4318"))
	if err != nil {
		return nil, err
	}
	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(res),
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(exporter)),
	)
	return meterProvider, nil
}

func newLoggerProvider(ctx context.Context, res *resource.Resource) (*sdklog.LoggerProvider, error) {
	exporter, err := otlploghttp.New(ctx, otlploghttp.WithInsecure(), otlploghttp.WithEndpoint("localhost:4318"))
	if err != nil {
		return nil, err
	}
	loggerProvider := sdklog.NewLoggerProvider(
		sdklog.WithResource(res),
		sdklog.WithProcessor(sdklog.NewBatchProcessor(exporter)),
	)
	return loggerProvider, nil
}

func getTodos(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	ctx, span := tracer.Start(r.Context(), "ListTodos")
	defer span.End()

	logger.InfoContext(ctx, "Processing GET /todos")

	mu.Lock()
	data, _ := json.Marshal(todos)
	mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)

	duration := time.Since(startTime).Seconds()
	durHistogram.Record(ctx, duration, metric.WithAttributes(attribute.String("operation", "ListTodos")))
	opsCounter.Add(ctx, 1, metric.WithAttributes(attribute.String("operation", "ListTodos"), attribute.String("status", "success")))
	logger.InfoContext(ctx, "Finished GET /todos")
}

func createTodo(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	ctx, span := tracer.Start(r.Context(), "AddTodo")
	defer span.End()

	logger.InfoContext(ctx, "Processing POST /todos")

	var todo Todo
	if err := json.NewDecoder(r.Body).Decode(&todo); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
		opsCounter.Add(ctx, 1, metric.WithAttributes(attribute.String("operation", "AddTodo"), attribute.String("status", "error")))
		return
	}

	todo.ID = uuid.New().String()
	mu.Lock()
	todos = append(todos, todo)
	mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(todo)

	duration := time.Since(startTime).Seconds()
	durHistogram.Record(ctx, duration, metric.WithAttributes(attribute.String("operation", "AddTodo")))
	opsCounter.Add(ctx, 1, metric.WithAttributes(attribute.String("operation", "AddTodo"), attribute.String("status", "success")))
	logger.InfoContext(ctx, "Finished POST /todos")
}

func getTodo(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	ctx, span := tracer.Start(r.Context(), "GetTodo")
	defer span.End()

	vars := mux.Vars(r)
	id := vars["id"]

	logger.InfoContext(ctx, "Processing GET /todos/"+id)

	mu.Lock()
	defer mu.Unlock()
	for _, t := range todos {
		if t.ID == id {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(t)

			duration := time.Since(startTime).Seconds()
			durHistogram.Record(ctx, duration, metric.WithAttributes(attribute.String("operation", "GetTodo")))
			opsCounter.Add(ctx, 1, metric.WithAttributes(attribute.String("operation", "GetTodo"), attribute.String("status", "success")))
			logger.InfoContext(ctx, "Finished GET /todos/"+id)
			return
		}
	}

	http.Error(w, "Todo not found", http.StatusNotFound)
	opsCounter.Add(ctx, 1, metric.WithAttributes(attribute.String("operation", "GetTodo"), attribute.String("status", "not_found")))
}

func updateTodo(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	ctx, span := tracer.Start(r.Context(), "UpdateTodo")
	defer span.End()

	vars := mux.Vars(r)
	id := vars["id"]

	logger.InfoContext(ctx, "Processing PUT /todos/"+id)

	var updatedTodo Todo
	if err := json.NewDecoder(r.Body).Decode(&updatedTodo); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	mu.Lock()
	defer mu.Unlock()
	for i, t := range todos {
		if t.ID == id {
			todos[i].Title = updatedTodo.Title
			todos[i].Completed = updatedTodo.Completed
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(todos[i])

			duration := time.Since(startTime).Seconds()
			durHistogram.Record(ctx, duration, metric.WithAttributes(attribute.String("operation", "UpdateTodo")))
			opsCounter.Add(ctx, 1, metric.WithAttributes(attribute.String("operation", "UpdateTodo"), attribute.String("status", "success")))
			logger.InfoContext(ctx, "Finished PUT /todos/"+id)
			return
		}
	}

	http.Error(w, "Todo not found", http.StatusNotFound)
	opsCounter.Add(ctx, 1, metric.WithAttributes(attribute.String("operation", "UpdateTodo"), attribute.String("status", "not_found")))
}

func deleteTodo(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	ctx, span := tracer.Start(r.Context(), "DeleteTodo")
	defer span.End()

	vars := mux.Vars(r)
	id := vars["id"]

	logger.InfoContext(ctx, "Processing DELETE /todos/"+id)

	mu.Lock()
	defer mu.Unlock()
	for i, t := range todos {
		if t.ID == id {
			todos = append(todos[:i], todos[i+1:]...)
			w.WriteHeader(http.StatusNoContent)

			duration := time.Since(startTime).Seconds()
			durHistogram.Record(ctx, duration, metric.WithAttributes(attribute.String("operation", "DeleteTodo")))
			opsCounter.Add(ctx, 1, metric.WithAttributes(attribute.String("operation", "DeleteTodo"), attribute.String("status", "success")))
			logger.InfoContext(ctx, "Finished DELETE /todos/"+id)
			return
		}
	}

	http.Error(w, "Todo not found", http.StatusNotFound)
	opsCounter.Add(ctx, 1, metric.WithAttributes(attribute.String("operation", "DeleteTodo"), attribute.String("status", "not_found")))
}
