import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PeriodicExportingMetricReader, MeterProvider } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { trace, context, ValueType } from '@opentelemetry/api';

const serviceName = 'javascript-todo-service';
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: serviceName,
  [ATTR_SERVICE_VERSION]: '1.0.0',
  ["service.namespace"]: 'javascript',
  ["service.instance.id"]: uuidv4(),
});

const traceProvider = new NodeTracerProvider({
  resource,
  spanProcessors: [
    new SimpleSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' })),
  ],
});
traceProvider.register();

const meterProvider = new MeterProvider({
  resource,
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: 'http://localhost:4318/v1/metrics' }),
    exportIntervalMillis: 1000,
  }),
});

const loggerProvider = new LoggerProvider({
  resource,
  logRecordProcessor: new BatchLogRecordProcessor(new OTLPLogExporter({ url: 'http://localhost:4318/v1/logs' }))
});

logs.setGlobalLoggerProvider(loggerProvider);

const tracer = traceProvider.getTracer(serviceName);
const meter = meterProvider.getMeter(serviceName);
const logger = logs.getLogger(serviceName);

const opsCounter = meter.createCounter('todo.operations', { description: 'Number of todo operations', valueType: ValueType.INT });
const durHistogram = meter.createHistogram('todo.duration', { description: 'Duration of todo operations' });

function logInfo(message, ctx) {
  logger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: 'INFO',
    body: message,
    context: ctx,
  });
}

// --- Express App ---
const app = express();
app.use(express.json());

let todos = [{ id: '1', title: 'Learn OpenTelemetry', completed: false }];

app.get('/todos', (req, res) => {
  const startTime = Date.now();
  const span = tracer.startSpan('ListTodos');
  const ctx = trace.setSpan(context.active(), span);

  logInfo('Processing GET /todos', ctx);

  res.json(todos);

  const duration = (Date.now() - startTime) / 1000;
  durHistogram.record(duration, { operation: 'ListTodos' }, ctx);
  opsCounter.add(1, { operation: 'ListTodos', status: 'success' }, ctx);
  logInfo('Finished GET /todos', ctx);
  span.end();
});

app.get('/todos/:id', (req, res) => {
  const startTime = Date.now();
  const span = tracer.startSpan('GetTodo');
  const ctx = trace.setSpan(context.active(), span);
  const id = req.params.id;

  logInfo(`Processing GET /todos/${id}`, ctx);

  const todo = todos.find((t) => t.id === id);
  if (!todo) {
    opsCounter.add(1, { operation: 'GetTodo', status: 'not_found' }, ctx);
    res.status(404).send('Todo not found');
    span.end();
    return;
  }

  res.json(todo);

  const duration = (Date.now() - startTime) / 1000;
  durHistogram.record(duration, { operation: 'GetTodo' }, ctx);
  opsCounter.add(1, { operation: 'GetTodo', status: 'success' }, ctx);
  logInfo(`Finished GET /todos/${id}`, ctx);
  span.end();
});

app.post('/todos', (req, res) => {
  const startTime = Date.now();
  const span = tracer.startSpan('AddTodo');
  const ctx = trace.setSpan(context.active(), span);

  logInfo('Processing POST /todos', ctx);

  const todo = {
    id: uuidv4(),
    title: req.body.title,
    completed: false,
  };
  todos.push(todo);

  res.status(201).json(todo);

  const duration = (Date.now() - startTime) / 1000;
  durHistogram.record(duration, { operation: 'AddTodo' }, ctx);
  opsCounter.add(1, { operation: 'AddTodo', status: 'success' }, ctx);
  logInfo('Finished POST /todos', ctx);
  span.end();
});

app.put('/todos/:id', (req, res) => {
  const startTime = Date.now();
  const span = tracer.startSpan('UpdateTodo');
  const ctx = trace.setSpan(context.active(), span);
  const id = req.params.id;

  logInfo(`Processing PUT /todos/${id}`, ctx);

  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) {
    opsCounter.add(1, { operation: 'UpdateTodo', status: 'not_found' }, ctx);
    res.status(404).send('Todo not found');
    span.end();
    return;
  }

  todos[index] = { ...todos[index], title: req.body.title, completed: req.body.completed };

  res.json(todos[index]);

  const duration = (Date.now() - startTime) / 1000;
  durHistogram.record(duration, { operation: 'UpdateTodo' }, ctx);
  opsCounter.add(1, { operation: 'UpdateTodo', status: 'success' }, ctx);
  logInfo(`Finished PUT /todos/${id}`, ctx);
  span.end();
});

app.delete('/todos/:id', (req, res) => {
  const startTime = Date.now();
  const span = tracer.startSpan('DeleteTodo');
  const ctx = trace.setSpan(context.active(), span);
  const id = req.params.id;

  logInfo(`Processing DELETE /todos/${id}`, ctx);

  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) {
    opsCounter.add(1, { operation: 'DeleteTodo', status: 'not_found' }, ctx);
    res.status(404).send('Todo not found');
    span.end();
    return;
  }

  todos.splice(index, 1);

  res.status(204).send();

  const duration = (Date.now() - startTime) / 1000;
  durHistogram.record(duration, { operation: 'DeleteTodo' }, ctx);
  opsCounter.add(1, { operation: 'DeleteTodo', status: 'success' }, ctx);
  logInfo(`Finished DELETE /todos/${id}`, ctx);
  span.end();
});

const port = 43522;
app.listen(port, () => {
  console.log(`JavaScript TODO service listening on http://localhost:${port}`);
});
