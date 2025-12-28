use serde::{Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc, TimeZone};
use crate::opentelemetry::proto::logs::v1::LogRecord;
use crate::opentelemetry::proto::common::v1::{AnyValue, any_value};
use crate::opentelemetry::proto::resource::v1::Resource;
use crate::opentelemetry::proto::common::v1::InstrumentationScope;

#[derive(Serialize, Clone, Debug)]
pub struct LogDto {
    pub timestamp: DateTime<Utc>,
    pub log_level: String,
    pub log_message: String,
    pub scope: String,
    pub resource: ResourceInfo,
    pub tags: HashMap<String, String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ResourceInfo {
    pub service_name: String,
    pub service_version: String,
    pub service_namespace: String,
    pub service_instance_id: String,
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

        let log_level = record.severity_text.clone();
        let log_message = record.body.map(|b| any_value_to_string(b)).unwrap_or_default();
        let scope_name = scope.map(|s| s.name.clone()).unwrap_or_default();

        let mut tags = HashMap::new();
        for attr in record.attributes {
            tags.insert(attr.key, any_value_to_string(attr.value.unwrap_or_default()));
        }

        let mut resource_info = ResourceInfo {
            service_name: "unknown_service".to_string(),
            service_version: "unknown".to_string(),
            service_namespace: "unknown".to_string(),
            service_instance_id: "unknown".to_string(),
        };

        if let Some(res) = resource {
            for attr in &res.attributes {
                match attr.key.as_str() {
                    "service.name" => resource_info.service_name = any_value_to_string(attr.value.clone().unwrap_or_default()),
                    "service.version" => resource_info.service_version = any_value_to_string(attr.value.clone().unwrap_or_default()),
                    "service.namespace" => resource_info.service_namespace = any_value_to_string(attr.value.clone().unwrap_or_default()),
                    "service.instance.id" => resource_info.service_instance_id = any_value_to_string(attr.value.clone().unwrap_or_default()),
                    _ => {}
                }
            }
        }

        LogDto {
            timestamp,
            log_level,
            log_message,
            scope: scope_name,
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
        assert_eq!(dto.log_level, "INFO");
        assert_eq!(dto.log_message, "test message");
        assert_eq!(dto.scope, "test-scope");
        assert_eq!(dto.resource.service_name, "test-service");
        assert_eq!(dto.tags.get("tag1").unwrap(), "val1");
    }
}
