use serde::{Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc, TimeZone};
use crate::domain::any_value_to_string;
use crate::domain::resource::ResourceInfo;
use super::traces::{SpanId, TraceId};
use crate::opentelemetry::proto::logs::v1::LogRecord;
use crate::opentelemetry::proto::common::v1::{AnyValue, any_value};
use crate::opentelemetry::proto::resource::v1::Resource;
use crate::opentelemetry::proto::common::v1::InstrumentationScope;

#[derive(Serialize, Clone, PartialEq, Debug)]
pub enum Severity {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
    Fatal,
    #[serde(untagged)]
    Unknown(String),
}

// https://opentelemetry.io/docs/specs/otel/logs/data-model/
#[derive(Serialize, Clone, Debug)]
pub struct LogDto {
    pub timestamp: DateTime<Utc>,
    pub severity: Severity,
    pub message: String,
    pub scope: String,
    pub trace_id: Option<TraceId>,
    pub span_id: Option<SpanId>,
    pub event_name: Option<String>,
    pub resource: ResourceInfo,
    pub tags: HashMap<String, String>,
}

impl LogDto {
    pub fn from_otlp(
        record: LogRecord,
        scope: Option<&InstrumentationScope>,
        resource: Option<&Resource>,
    ) -> Self {
        let timestamp_nanos = if record.time_unix_nano > 0 {
            record.time_unix_nano
        } else {
            record.observed_time_unix_nano
        };

        let timestamp = Utc.timestamp_nanos(timestamp_nanos as i64);

        let severity = get_severity(&record);
        let log_message = record.body.map(|b| any_value_to_string(b)).unwrap_or_default();
        let scope_name = scope.map(|s| s.name.clone()).unwrap_or_default();
        let trace_id = TraceId::try_from(&record.trace_id).ok();
        let span_id = SpanId::try_from(&record.span_id).ok();
        let event_name = if record.event_name.is_empty() { None } else { Some(record.event_name) };

        let mut tags = HashMap::new();
        for attr in record.attributes {
            tags.insert(attr.key, any_value_to_string(attr.value.unwrap_or_default()));
        }

        let resource_info: ResourceInfo = resource.map(|r| ResourceInfo::from(r)).unwrap_or_default();

        LogDto {
            timestamp,
            severity,
            message: log_message,
            scope: scope_name,
            trace_id,
            span_id,
            event_name,
            resource: resource_info,
            tags,
        }
    }
}

// https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
fn get_severity(log_record: &LogRecord) -> Severity {
    match log_record.severity_number {
        1..=4 => Severity::Trace,
        5..=8 => Severity::Debug,
        9..=12 => Severity::Info,
        13..=16 => Severity::Warn,
        17..=20 => Severity::Error,
        21..=24 => Severity::Fatal,
        _ => match log_record.severity_text.to_lowercase().as_str() {
            "trace" => Severity::Trace,
            "debug" => Severity::Debug,
            "info" | "information" => Severity::Info,
            "warn" | "warning" => Severity::Warn,
            "error" => Severity::Error,
            "fatal" | "critical" => Severity::Fatal,
            _ => Severity::Unknown(log_record.severity_text.clone()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::opentelemetry::proto::common::v1::{KeyValue, any_value};
    use crate::opentelemetry::proto::resource::v1::Resource;

    #[test]
    fn test_from_otlp() {
        let record = LogRecord {
            time_unix_nano: 123456789,
            observed_time_unix_nano: 987654321,
            severity_text: "INFO".to_string(),
            body: Some(AnyValue {
                value: Some(any_value::Value::StringValue("test message".to_string())),
            }),
            attributes: vec![
                KeyValue {
                    key: "tag1".to_string(),
                    value: Some(AnyValue {
                        value: Some(any_value::Value::StringValue("val1".to_string())),
                    }),
                }
            ],
            ..Default::default()
        };

        let scope = InstrumentationScope {
            name: "test-scope".to_string(),
            ..Default::default()
        };

        let resource = Resource {
            attributes: vec![
                KeyValue {
                    key: "service.name".to_string(),
                    value: Some(AnyValue {
                        value: Some(any_value::Value::StringValue("test-service".to_string())),
                    }),
                }
            ],
            ..Default::default()
        };

        let dto = LogDto::from_otlp(record, Some(&scope), Some(&resource));

        assert_eq!(dto.timestamp, Utc.timestamp_nanos(123456789));
        assert_eq!(dto.severity, Severity::Info);
        assert_eq!(dto.message, "test message");
        assert_eq!(dto.scope, "test-scope");
        assert_eq!(dto.resource.service_name, "test-service");
        assert_eq!(dto.tags.get("tag1").unwrap(), "val1");
    }

    #[test]
    fn test_severity_serialization() {
        let mut log = LogDto::from_otlp(LogRecord::default(), None, None);
        log.severity = Severity::Unknown("test".to_string());

        let serialized = serde_json::to_string(&log).unwrap();
        assert!(serialized.contains("\"severity\":\"test\""));
    }
}
