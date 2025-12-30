use crate::opentelemetry::proto::common::v1::{any_value, AnyValue};

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