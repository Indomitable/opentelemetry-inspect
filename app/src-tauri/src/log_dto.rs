use serde::{Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc, TimeZone};
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
    pub trace_id: Option<String>,
    pub span_id: Option<String>,
    pub event_name: Option<String>,
    pub resource: ResourceInfo,
    pub tags: HashMap<String, String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ResourceInfo {
    pub service_name: String,
    pub service_version: String,
    pub service_namespace: String,
    pub service_instance_id: String,
    pub attributes: HashMap<String, String>,
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
        let trace_id = if is_valid_trace_id(&record.trace_id) { Some(bytes_to_hex(&record.trace_id)) } else { None };
        let span_id = if is_valid_span_id(&record.span_id) { Some(bytes_to_hex(&record.span_id)) } else { None };
        let event_name = if record.event_name.is_empty() { None } else { Some(record.event_name) };

        let mut tags = HashMap::new();
        for attr in record.attributes {
            tags.insert(attr.key, any_value_to_string(attr.value.unwrap_or_default()));
        }

        let mut resource_info = ResourceInfo {
            service_name: "unknown_service".to_string(),
            service_version: "unknown".to_string(),
            service_namespace: "unknown".to_string(),
            service_instance_id: "unknown".to_string(),
            attributes: HashMap::new(),
        };

        if let Some(res) = resource {
            for attr in &res.attributes {
                match attr.key.as_str() {
                    "service.name" => resource_info.service_name = any_value_to_string(attr.value.clone().unwrap_or_default()),
                    "service.version" => resource_info.service_version = any_value_to_string(attr.value.clone().unwrap_or_default()),
                    "service.namespace" => resource_info.service_namespace = any_value_to_string(attr.value.clone().unwrap_or_default()),
                    "service.instance.id" => resource_info.service_instance_id = any_value_to_string(attr.value.clone().unwrap_or_default()),
                    _ => {
                        resource_info.attributes.insert(attr.key.clone(), any_value_to_string(attr.value.clone().unwrap_or_default()));
                    }
                }
            }
        }

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

fn any_value_to_string(value: AnyValue) -> String {
    match value.value {
        Some(any_value::Value::StringValue(s)) => s,
        Some(any_value::Value::BoolValue(b)) => b.to_string(),
        Some(any_value::Value::IntValue(i)) => i.to_string(),
        Some(any_value::Value::DoubleValue(f)) => f.to_string(),
        _ => format!("{:?}", value),
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

fn is_valid_trace_id(trace_id: &Vec<u8>) -> bool {
    trace_id.len() == 16 && trace_id.iter().all(|b| b > &0)
}

fn is_valid_span_id(span_id: &Vec<u8>) -> bool {
    span_id.len() == 8 && span_id.iter().all(|b| b > &0)
}

fn bytes_to_hex(bytes: &Vec<u8>) -> String {
    let hex_string = bytes.iter()
        .fold(String::with_capacity(bytes.len() * 2), |mut acc, b| {
            acc.push_str(&format!("{:02x}", b));
            acc
        });
    hex_string
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
