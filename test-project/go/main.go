package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	logbridge "go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
)

var tracer trace.Tracer
var logger *slog.Logger

type Todo struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
}

var todos []Todo

func main() {
	// Handle SIGINT (CTRL+C) gracefully.
	log.Printf("Starting application... http://localhost:43521")
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	shutdown, err := setupOTelSDK(ctx)
	if err != nil {
		log.Fatalf("failed to initialize tracer: %v", err)
	}
	defer func() {
		err = errors.Join(err, shutdown(context.Background()))
	}()

	tracer = otel.Tracer("todo-service")
	logger = logbridge.NewLogger("todo-server")
	logger.Info("Starting application...")

	todos = append(todos, Todo{ID: "1", Title: "Learn OpenTelemetry", Completed: false})

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
	var err error

	// shutdown calls cleanup functions registered via shutdownFuncs.
	// The errors from the calls are joined.
	// Each registered cleanup will be invoked once.
	shutdown := func(ctx context.Context) error {
		var err error
		for _, fn := range shutdownFuncs {
			err = errors.Join(err, fn(ctx))
		}
		shutdownFuncs = nil
		return err
	}

	// handleErr calls shutdown for cleanup and makes sure that all errors are returned.
	handleErr := func(inErr error) {
		err = errors.Join(inErr, shutdown(ctx))
	}

	// Set up propagator.
	prop := newPropagator()
	otel.SetTextMapPropagator(prop)

	// Set up resource.
	resource, _ := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceNameKey.String("todo-service"),
			semconv.ServiceVersionKey.String("1.0.0"),
			semconv.ServiceInstanceIDKey.String(uuid.New().String()),
		),
	)

	// Set up trace provider.
	tracerProvider, err := newTracerProvider(ctx, resource)
	if err != nil {
		handleErr(err)
		return shutdown, err
	}
	shutdownFuncs = append(shutdownFuncs, tracerProvider.Shutdown)
	otel.SetTracerProvider(tracerProvider)

	// Set up meter provider.
	// meterProvider, err := newMeterProvider()
	// if err != nil {
	// 	handleErr(err)
	// 	return shutdown, err
	// }
	// shutdownFuncs = append(shutdownFuncs, meterProvider.Shutdown)
	// otel.SetMeterProvider(meterProvider)

	// Set up logger provider.
	loggerProvider, err := newLoggerProvider(ctx, resource)
	if err != nil {
		handleErr(err)
		return shutdown, err
	}
	shutdownFuncs = append(shutdownFuncs, loggerProvider.Shutdown)
	global.SetLoggerProvider(loggerProvider)

	return shutdown, err
}

func newPropagator() propagation.TextMapPropagator {
	return propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	)
}

func newTracerProvider(ctx context.Context, resource *resource.Resource) (*sdktrace.TracerProvider, error) {
	exporter, err := otlptracehttp.New(ctx, otlptracehttp.WithInsecure(), otlptracehttp.WithEndpoint("localhost:4318"))
	if err != nil {
		return nil, fmt.Errorf("failed to create trace exporter: %w", err)
	}
	bsp := sdktrace.NewBatchSpanProcessor(exporter)
	traceProvider := sdktrace.NewTracerProvider(
		sdktrace.WithResource(resource),
		sdktrace.WithSpanProcessor(bsp),
	)
	return traceProvider, nil
}

func newLoggerProvider(ctx context.Context, resource *resource.Resource) (*sdklog.LoggerProvider, error) {
	exporter, err := otlploghttp.New(ctx, otlploghttp.WithInsecure(), otlploghttp.WithEndpoint("localhost:4318"))
	if err != nil {
		return nil, fmt.Errorf("failed to create log exporter: %w", err)
	}
	processor := sdklog.NewBatchProcessor(exporter)
	loggerProvider := sdklog.NewLoggerProvider(
		sdklog.WithResource(resource),
		sdklog.WithProcessor(processor),
	)
	return loggerProvider, nil
}

func getTodos(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracer.Start(r.Context(), "getTodos", trace.WithSpanKind(trace.SpanKindServer), trace.WithAttributes(attribute.String("http.method", r.Method)))
	time.Sleep(1 * time.Millisecond)
	defer span.End()
	logger.ErrorContext(ctx, "getTodos - error message", slog.Group("test",
		slog.Duration("testDuration", 1*time.Second),
		slog.Int("testInt", 1),
		slog.Bool("testBool", true),
	))

	ctx, childSpan := tracer.Start(ctx, "getTodosChild")
	time.Sleep(2 * time.Millisecond)
	defer childSpan.End()

	_, childChildSpan := tracer.Start(ctx, "getTodosChildChild")
	time.Sleep(1 * time.Millisecond)
	childChildSpan.End()

	time.Sleep(100 * time.Microsecond)
	logger.InfoContext(ctx, "getTodosChild - log message: {}", "2", slog.String("test", "value"))

	data, _ := json.Marshal(todos)
	w.Write(data)
}

func createTodo(w http.ResponseWriter, r *http.Request) {
	_, span := tracer.Start(r.Context(), "createTodo")
	defer span.End()
	// In a real application, you would decode the request body to create a new todo
	logger.Info("createTodo")
	span.AddEvent("createTodo")
	var todo Todo
	err := json.NewDecoder(r.Body).Decode(&todo)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		logger.Error("failed to decode todo", "error", err)
		return
	}
	todos = append(todos, todo)
}

func getTodo(w http.ResponseWriter, r *http.Request) {
	_, span := tracer.Start(r.Context(), "getTodo")
	defer span.End()
	// In a real application, you would get the todo with the given ID
	fmt.Fprintln(w, "getTodo")
}
