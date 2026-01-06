use std::collections::HashMap;
use serde::Serialize;
use crate::domain::common::{Nanoseconds, SpanId, TraceId};
use crate::domain::{extract_tags};
use crate::domain::resource::ResourceInfo;
use crate::opentelemetry;
use crate::opentelemetry::proto::common::v1::{InstrumentationScope};
use crate::opentelemetry::proto::metrics::v1::Metric;
use crate::opentelemetry::proto::resource::v1::Resource;

#[derive(Debug, Clone, Serialize)]
pub struct MetricDto {
    pub name: String,
    pub description: String,
    pub unit: String,
    pub scope: String,
    pub resource: ResourceInfo,
    pub data: Option<MetricType>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "t")]
pub enum MetricType {
    Gauge(GaugeMetric),
    Sum(SumMetric),
    Histogram(HistogramMetric),
}

#[derive(Debug, Clone, Serialize)]
pub struct GaugeMetric {
    pub data_points: Vec<NumberDataPoint>,
}

// https://opentelemetry.io/docs/specs/otel/metrics/data-model/#sums
#[derive(Debug, Clone, Serialize)]
pub struct SumMetric {
    pub data_points: Vec<NumberDataPoint>,
    pub aggregation_temporality: AggregationTemporality,
    pub is_monotonic: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct HistogramMetric {
    pub data_points: Vec<HistogramDataPoint>,
    pub aggregation_temporality: AggregationTemporality,
}

#[derive(Debug, Clone, Serialize)]
pub struct Examplar {
    pub time_unix_nano: String,
    pub trace_id: Option<TraceId>,
    pub span_id: Option<SpanId>,
    pub value: Option<NumberValue>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NumberDataPoint {
    pub start_time_unix_nano: Nanoseconds,
    pub time_unix_nano: Nanoseconds,
    pub value: Option<NumberValue>,
    pub attributes: HashMap<String, String>,
    pub exemplars: Vec<Examplar>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HistogramDataPoint {
    pub start_time_unix_nano: Nanoseconds,
    pub time_unix_nano: Nanoseconds,
    pub count: u64,
    pub sum: Option<f64>,
    pub bucket_counts: Vec<u64>,
    pub explicit_bounds: Vec<f64>,
    pub exemplars: Vec<Examplar>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub attributes: HashMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum AggregationTemporality {
    Delta,
    Cumulative,
}

#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum NumberValue {
    Int(i64),
    Double(f64),
}

impl MetricDto {
    pub(crate) fn from_otlp(
        metric: Metric,
        scope: Option<&InstrumentationScope>,
        resource: Option<&Resource>) -> Self {
        let scope_name = scope.map(|s| s.name.clone()).unwrap_or_default();
        let resource_info: ResourceInfo = resource.map(ResourceInfo::from).unwrap_or_default();
        Self {
            name: metric.name,
            unit: metric.unit,
            description: metric.description,
            scope: scope_name,
            resource: resource_info,
            data: MetricDto::map_data(metric.data),
        }
    }

    fn map_data(data: Option<opentelemetry::proto::metrics::v1::metric::Data>) -> Option<MetricType> {
        match data {
            Some(opentelemetry::proto::metrics::v1::metric::Data::Gauge(gauge)) => Some(MetricType::Gauge(Self::map_gauge(gauge))),
            Some(opentelemetry::proto::metrics::v1::metric::Data::Sum(sum)) => Some(MetricType::Sum(Self::map_sum(sum))),
            Some(opentelemetry::proto::metrics::v1::metric::Data::Histogram(histogram)) => Some(MetricType::Histogram(Self::map_histogram(histogram))),
            _ => None
        }
    }

    fn map_gauge(gauge: opentelemetry::proto::metrics::v1::Gauge) -> GaugeMetric {
        GaugeMetric {
            data_points: gauge.data_points.iter().map(Self::map_number_data_point).collect()
        }
    }

    fn map_sum(sum: opentelemetry::proto::metrics::v1::Sum) -> SumMetric {
        SumMetric {
            data_points: sum.data_points.iter().map(Self::map_number_data_point).collect(),
            aggregation_temporality: Self::map_aggregation_temporality(sum.aggregation_temporality),
            is_monotonic: sum.is_monotonic,
        }
    }

    fn map_histogram(histogram: opentelemetry::proto::metrics::v1::Histogram) -> HistogramMetric {
        HistogramMetric {
            data_points: histogram.data_points.iter().map(Self::map_histogram_data_point).collect(),
            aggregation_temporality: Self::map_aggregation_temporality(histogram.aggregation_temporality),
        }
    }

    fn map_number_data_point(data_point: &opentelemetry::proto::metrics::v1::NumberDataPoint) -> NumberDataPoint {
        NumberDataPoint {
            value: data_point.value.map(|v| match v {
                opentelemetry::proto::metrics::v1::number_data_point::Value::AsDouble(d) => NumberValue::Double(d),
                opentelemetry::proto::metrics::v1::number_data_point::Value::AsInt(i) => NumberValue::Int(i),
            }),
            start_time_unix_nano: data_point.start_time_unix_nano.into(),
            time_unix_nano: data_point.time_unix_nano.into(),
            attributes: extract_tags(&data_point.attributes),
            exemplars: data_point.exemplars.iter().map(Self::map_examplar).collect(),
        }
    }

    fn map_histogram_data_point(data_point: &opentelemetry::proto::metrics::v1::HistogramDataPoint) -> HistogramDataPoint {
        HistogramDataPoint {
            start_time_unix_nano: data_point.start_time_unix_nano.into(),
            time_unix_nano: data_point.time_unix_nano.into(),
            count: data_point.count,
            sum: data_point.sum,
            bucket_counts: data_point.bucket_counts.clone(),
            explicit_bounds: data_point.explicit_bounds.clone(),
            exemplars: data_point.exemplars.iter().map(Self::map_examplar).collect(),
            min: data_point.min,
            max: data_point.max,
            attributes: extract_tags(&data_point.attributes),
        }
    }

    fn map_examplar(examplar: &opentelemetry::proto::metrics::v1::Exemplar) -> Examplar {
        Examplar {
            time_unix_nano: examplar.time_unix_nano.to_string(),
            trace_id: TraceId::try_from(&examplar.trace_id).ok(),
            span_id: SpanId::try_from(&examplar.span_id).ok(),
            value: examplar.value.map(|v| match v {
                opentelemetry::proto::metrics::v1::exemplar::Value::AsDouble(d) => NumberValue::Double(d),
                opentelemetry::proto::metrics::v1::exemplar::Value::AsInt(i) => NumberValue::Int(i),
            })
        }
    }

    fn map_aggregation_temporality(at: i32) -> AggregationTemporality {
        let aggregation_temporality: Option<opentelemetry::proto::metrics::v1::AggregationTemporality> = at.try_into().ok();
        match aggregation_temporality {
            Some(opentelemetry::proto::metrics::v1::AggregationTemporality::Delta) => AggregationTemporality::Delta,
            Some(opentelemetry::proto::metrics::v1::AggregationTemporality::Cumulative) => AggregationTemporality::Cumulative,
            _ => AggregationTemporality::Delta
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_aggregation_temporality() {
        assert_eq!(MetricDto::map_aggregation_temporality(1), AggregationTemporality::Delta);
        assert_eq!(MetricDto::map_aggregation_temporality(2), AggregationTemporality::Cumulative);
        assert_eq!(MetricDto::map_aggregation_temporality(0), AggregationTemporality::Delta);
    }
}