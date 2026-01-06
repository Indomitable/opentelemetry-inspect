use serde::Serialize;
use crate::domain::bytes_to_hex;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(transparent)]
pub struct TraceId(String);
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(transparent)]
pub struct SpanId(String);

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(transparent)]
pub struct Nanoseconds(String); // use string for the nanoseconds which would be converted to bigint in JS.

impl TryFrom<&Vec<u8>> for TraceId {
    type Error = &'static str;

    fn try_from(value: &Vec<u8>) -> Result<Self, Self::Error> {
        if !is_valid(value, 16) {
            return Err("Invalid trace id. Must be 16 bytes long and not all zeros.");
        }
        Ok(TraceId(bytes_to_hex(value)))
    }
}

impl TryFrom<&Vec<u8>> for SpanId {
    type Error = &'static str;

    fn try_from(value: &Vec<u8>) -> Result<Self, Self::Error> {
        if !is_valid(value, 8) {
            return Err("Invalid span id. Must be 8 bytes long and not all zeros.");
        }
        Ok(SpanId(bytes_to_hex(value)))
    }
}

impl From<u64> for Nanoseconds {
    fn from(value: u64) -> Self {
        Nanoseconds(value.to_string())
    }
}

fn is_valid(bytes: &[u8], size: usize) -> bool {
    bytes.len() == size && !bytes.iter().all(|b| b == &0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invalid_trace_id_all_zeros() {
        let bytes = vec![0u8; 16];
        let trace_id = TraceId::try_from(&bytes).ok();
        assert_eq!(trace_id, None);
    }

    #[test]
    fn test_invalid_trace_id_less_than_16_bytes() {
        let bytes = vec![0x01, 0x02];
        let trace_id = TraceId::try_from(&bytes).ok();
        assert_eq!(trace_id, None);
    }

    #[test]
    fn test_valid_trace_id_some_zeros() {
        let bytes = vec![0u8, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        let trace_id = TraceId::try_from(&bytes).ok();
        assert_eq!(trace_id, Some(TraceId("000102030405060708090a0b0c0d0e0f".to_string())));
    }
}
