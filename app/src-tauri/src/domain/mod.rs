use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use crate::opentelemetry::proto::common::v1::{any_value, AnyValue, KeyValue};

pub(crate) mod logs;
pub(crate) mod traces;
pub(crate) mod resource;

pub fn any_value_to_string(value: AnyValue) -> String {
    match value.value {
        Some(any_value::Value::StringValue(s)) => s,
        Some(any_value::Value::BoolValue(b)) => b.to_string(),
        Some(any_value::Value::IntValue(i)) => i.to_string(),
        Some(any_value::Value::DoubleValue(f)) => f.to_string(),
        _ => format!("{:?}", value),
    }
}

pub fn any_value_to_string_ref(value: Option<&AnyValue>) -> String {
    match &value {
        Some(v) => {
            match &v.value {
                Some(any_value::Value::StringValue(s)) => s.clone(),
                Some(any_value::Value::BoolValue(b)) => b.to_string(),
                Some(any_value::Value::IntValue(i)) => i.to_string(),
                Some(any_value::Value::DoubleValue(f)) => f.to_string(),
                _ => format!("{:?}", value)
            }
        },
        None => "".to_string()
    }
}

pub fn extract_tags(attributes: &[KeyValue]) -> HashMap<String, String> {
    attributes.iter()
        .map(|kv| (kv.key.clone(), any_value_to_string_ref(kv.value.as_ref())))
        .collect::<HashMap<String, String>>()
}