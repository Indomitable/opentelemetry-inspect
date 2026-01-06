use std::collections::HashMap;
use chrono::{DateTime, TimeZone, Utc};
use serde::Serialize;
use crate::domain::{extract_tags};
use crate::domain::common::{SpanId, Nanoseconds, TraceId};
use crate::domain::resource::ResourceInfo;
use crate::opentelemetry;
use crate::opentelemetry::proto::common::v1::InstrumentationScope;
use crate::opentelemetry::proto::resource::v1::Resource;
use crate::opentelemetry::proto::trace::v1::Span;

#[derive(Debug, Clone, Serialize)]
pub enum SpanKind {
    Unspecified,
    Internal,
    Server,
    Client,
    Producer,
    Consumer,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpanEvent {
    pub name: String,
    pub timestamp: DateTime<Utc>,
    pub attributes: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpanLink {
    pub trace_id: Option<TraceId>,
    pub span_id: Option<SpanId>,
    pub trace_state: String,
    pub attributes: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
pub enum SpanStatusCode {
    Unset,
    Ok,
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpanStatus {
    pub message: String,
    pub code: SpanStatusCode,
}

impl Default for SpanStatus {
    fn default() -> Self {
        SpanStatus {
            message: "".to_string(),
            code: SpanStatusCode::Unset
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SpanDto {
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub start_time_unix_nano: Nanoseconds,
    pub end_time_unix_nano: Nanoseconds,
    pub scope: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace_id: Option<TraceId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub span_id: Option<SpanId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_span_id: Option<SpanId>,
    pub resource: ResourceInfo,
    pub kind: SpanKind,
    pub status: SpanStatus,
    pub events: Vec<SpanEvent>,
    pub links: Vec<SpanLink>,
    pub tags: HashMap<String, String>,
}

impl SpanDto {
    pub fn from_otlp(
        span: Span,
        scope: Option<&InstrumentationScope>,
        resource: Option<&Resource>,
    ) -> Self {
        let start = Utc.timestamp_nanos(span.start_time_unix_nano as i64);
        let end = Utc.timestamp_nanos(span.end_time_unix_nano as i64);

        let scope_name = scope.map(|s| s.name.clone()).unwrap_or_default();
        let resource_info: ResourceInfo = resource.map(ResourceInfo::from).unwrap_or_default();
        let tags = extract_tags(&span.attributes);
        let trace_id = TraceId::try_from(&span.trace_id).ok();
        let span_id = SpanId::try_from(&span.span_id).ok();
        let parent_span_id = SpanId::try_from(&span.parent_span_id).ok();
        let span_kind = match span.kind() {
            opentelemetry::proto::trace::v1::span::SpanKind::Unspecified => SpanKind::Unspecified,
            opentelemetry::proto::trace::v1::span::SpanKind::Internal => SpanKind::Internal,
            opentelemetry::proto::trace::v1::span::SpanKind::Server => SpanKind::Server,
            opentelemetry::proto::trace::v1::span::SpanKind::Client => SpanKind::Client,
            opentelemetry::proto::trace::v1::span::SpanKind::Producer => SpanKind::Producer,
            opentelemetry::proto::trace::v1::span::SpanKind::Consumer => SpanKind::Consumer,
        };
        let events = span.events.iter().map(|e| {
            SpanEvent {
                name: e.name.clone(),
                timestamp: Utc.timestamp_nanos(e.time_unix_nano as i64),
                attributes: extract_tags(&e.attributes),
            }
        }).collect();
        let links = span.links.iter().map(|l| {
            SpanLink {
                trace_id: TraceId::try_from(&l.trace_id).ok(),
                span_id: SpanId::try_from(&l.span_id).ok(),
                trace_state: l.trace_state.clone(),
                attributes: extract_tags(&l.attributes),
            }
        }).collect();
        let status = span.status.map_or(SpanStatus::default(), |s| {
            SpanStatus {
                message: s.message.clone(),
                code: match s.code() {
                    opentelemetry::proto::trace::v1::status::StatusCode::Unset => SpanStatusCode::Unset,
                    opentelemetry::proto::trace::v1::status::StatusCode::Ok => SpanStatusCode::Ok,
                    opentelemetry::proto::trace::v1::status::StatusCode::Error => SpanStatusCode::Error,
                }
            }
        });

        Self {
            start_time: start,
            end_time: end,
            start_time_unix_nano: span.start_time_unix_nano.into(),
            end_time_unix_nano: span.end_time_unix_nano.into(),
            scope: scope_name,
            name: span.name,
            trace_id,
            span_id,
            parent_span_id,
            resource: resource_info,
            kind: span_kind,
            status,
            events,
            links,
            tags
        }
    }
}
