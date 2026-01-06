use std::collections::HashMap;
use crate::opentelemetry::proto::common::v1::{any_value, AnyValue, ArrayValue, KeyValue, KeyValueList};

pub(crate) mod logs;
pub(crate) mod traces;
pub(crate) mod resource;
pub(crate) mod metrics;
pub(crate) mod common;

pub fn bytes_to_hex(bytes: &[u8]) -> String {
    let hex_string = bytes.iter()
        .fold(String::with_capacity(bytes.len() * 2), |mut acc, b| {
            acc.push_str(&format!("{:02x}", b));
            acc
        });
    hex_string
}

pub fn any_value_to_string(value: &AnyValue) -> String {
    match &value.value {
        Some(any_value::Value::StringValue(s)) => s.clone(),
        Some(any_value::Value::BoolValue(b)) => b.to_string(),
        Some(any_value::Value::IntValue(i)) => i.to_string(),
        Some(any_value::Value::DoubleValue(f)) => f.to_string(),
        Some(any_value::Value::BytesValue(f)) => bytes_to_hex(f),
        Some(any_value::Value::ArrayValue(a)) => any_value_array_to_string(a),
        Some(any_value::Value::KvlistValue(kv)) => any_value_key_value_to_string(kv),
        _ => format!("{:?}", value)
    }
}

pub fn any_value_to_string_optional(value: Option<&AnyValue>) -> String {
    match &value {
        Some(v) => any_value_to_string(v),
        None => "".to_string()
    }
}

fn any_value_array_to_string(array: &ArrayValue) -> String {
    array.values.iter().map(any_value_to_string).collect::<Vec<String>>().join(", ")
}

fn any_value_key_value_to_string(kv: &KeyValueList) -> String {
    kv.values.iter().map(|kv| format!("{}={}", kv.key, any_value_to_string_optional(kv.value.as_ref())))
        .collect::<Vec<String>>().join(", ")
}

pub fn extract_tags(attributes: &[KeyValue]) -> HashMap<String, String> {
    attributes.iter()
        .map(|kv| (kv.key.clone(), any_value_to_string_optional(kv.value.as_ref())))
        .collect::<HashMap<String, String>>()
}