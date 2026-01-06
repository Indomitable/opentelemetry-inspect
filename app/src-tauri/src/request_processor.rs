use std::sync::Arc;
use tokio::sync::RwLock;
use crate::domain::logs::LogDto;
use crate::domain::metrics::MetricDto;
use crate::domain::traces::SpanDto;
use crate::opentelemetry::proto::collector::logs::v1::ExportLogsServiceRequest;
use crate::opentelemetry::proto::collector::metrics::v1::ExportMetricsServiceRequest;
use crate::opentelemetry::proto::collector::trace::v1::ExportTraceServiceRequest;
use crate::subscription_manager::SubscriptionManager;

pub struct RequestProcessor {
    subscription_manager: Arc<RwLock<SubscriptionManager>>
}

impl RequestProcessor {
    pub fn new(subscription_manager: Arc<RwLock<SubscriptionManager>>) -> Self {
        Self { subscription_manager }
    }

    pub async fn process_logs(&self, request: ExportLogsServiceRequest) {
        for resource_log in request.resource_logs {
            let resource = resource_log.resource.as_ref();
            for scope_log in resource_log.scope_logs {
                let scope = scope_log.scope.as_ref();
                for log_record in scope_log.log_records {
                    let dto = LogDto::from_otlp(log_record, scope, resource);
                    let _ = self.subscription_manager.read().await.publish_log(dto);
                }
            }
        }
    }

    pub async fn process_traces(&self, request: ExportTraceServiceRequest) {
        for resource_span in request.resource_spans {
            let resource = resource_span.resource.as_ref();
            for scope_span in resource_span.scope_spans {
                let scope = scope_span.scope.as_ref();
                for span in scope_span.spans {
                    let dto = SpanDto::from_otlp(span, scope, resource);
                    let _ = self.subscription_manager.read().await.publish_span(dto);
                }
            }
        }
    }

    pub async fn process_metrics(&self, request: ExportMetricsServiceRequest) {
        for resource_span in request.resource_metrics {
            let resource = resource_span.resource.as_ref();
            for scope_metrics in resource_span.scope_metrics {
                let scope = scope_metrics.scope.as_ref();
                for metric in scope_metrics.metrics {
                    let dto = MetricDto::from_otlp(metric, scope, resource);
                    let _ = self.subscription_manager.read().await.publish_metric(dto);
                }
            }
        }
    }
}