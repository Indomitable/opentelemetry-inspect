import {mapResource, Resource, ResourceDto} from "./resources.ts";

export enum AggregationTemporality {
    Delta = 'Delta',
    Cumulative = 'Cumulative'
}

export enum MetricType {
    Gauge = 'Gauge',
    Sum = 'Sum',
    Histogram = 'Histogram',
    Unknown = 'Unknown'
}

interface ExamplarDto {
    time_unix_nano: string;
    trace_id?: string;
    span_id?: string;
    value?: number;
}

export interface Examplar extends ExamplarDto {
    time_ns: bigint;
}

interface NumberDataPointDto {
    start_time_unix_nano: string;
    time_unix_nano: string;
    value?: number;
    attributes: Record<string, string>;
    exemplars: ExamplarDto[];
}

export interface NumberDataPoint extends NumberDataPointDto {
    t: 'value',
    start_ns: bigint;
    time_ns: bigint;
    exemplars: Examplar[];
}

interface HistogramDataPointDto {
    start_time_unix_nano: string;
    time_unix_nano: string;
    count: number;
    sum?: number;
    bucket_counts: number[];
    explicit_bounds: number[];
    exemplars: ExamplarDto[];
    min?: number;
    max?: number;
    attributes: Record<string, string>;
}

export interface HistogramDataPoint extends HistogramDataPointDto {
    t: 'histogram',
    start_ns: bigint;
    time_ns: bigint;
    exemplars: Examplar[];
}

interface GaugeMetricDto {
    data_points: NumberDataPointDto[];
}

export interface GaugeMetric extends GaugeMetricDto {
    data_points: NumberDataPoint[];
}

interface SumMetricDto {
    data_points: NumberDataPointDto[];
    aggregation_temporality: AggregationTemporality;
    is_monotonic: boolean;
}

export interface SumMetric extends SumMetricDto {
    data_points: NumberDataPoint[];
}

interface HistogramMetricDto {
    data_points: HistogramDataPointDto[];
    aggregation_temporality: AggregationTemporality;
}

interface HistogramMetric extends HistogramMetricDto {
    data_points: HistogramDataPoint[];
}

export type MetricDataDto =
    | { t: MetricType.Gauge } & GaugeMetricDto
    | { t: MetricType.Sum } & SumMetricDto
    | { t: MetricType.Histogram } & HistogramMetricDto;

export type MetricData =
    | { t: MetricType.Gauge } & GaugeMetric
    | { t: MetricType.Sum } & SumMetric
    | { t: MetricType.Histogram } & HistogramMetric;

export interface MetricDto {
    name: string;
    description: string;
    unit: string;
    scope: string;
    resource: ResourceDto;
    data?: MetricDataDto;
}

export interface Metric extends MetricDto {
    key: string;
    type: MetricType;
    resource: Resource;
    data?: MetricData;
}

export function mapMetricResult(dto: MetricDto): Metric {
    const type = dto.data?.t ?? MetricType.Unknown;
    let data: MetricData | undefined;
    if (dto.data?.t === MetricType.Sum || dto.data?.t === MetricType.Gauge) {
        data = {
            ...dto.data,
            data_points: dto.data.data_points.map(dp => ({
                ...dp,
                t: 'value',
                start_ns: BigInt(dp.start_time_unix_nano),
                time_ns: BigInt(dp.time_unix_nano),
                exemplars: dp.exemplars.map(e => ({
                    ...e,
                    time_ns: BigInt(e.time_unix_nano)
                }))
            }))
        }
    } else if (dto.data?.t === MetricType.Histogram) {
        data = {
            ...dto.data,
            data_points: dto.data.data_points.map(dp => ({
                ...dp,
                t: 'histogram',
                start_ns: BigInt(dp.start_time_unix_nano),
                time_ns: BigInt(dp.time_unix_nano),
                exemplars: dp.exemplars.map(e => ({
                    ...e,
                    time_ns: BigInt(e.time_unix_nano)
                }))
            }))
        }
    }
    const resource = mapResource(dto.resource);
    return {
        ...dto,
        key: `${dto.name}|${dto.unit}|${type}|${resource.key}`,
        resource,
        type,
        data
    }
}

export interface AggregatedMetric extends Metric {
    data: MetricData;
}
