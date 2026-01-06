import {
    AggregatedMetric,
    Metric,
    MetricType,
    AggregationTemporality,
    HistogramDataPoint,
    NumberDataPoint
} from "../domain/metrics";
import {Resource} from "../domain/resources.ts";
import {sortBigIntDesc} from "../helpers/bigint-helpers.ts";

const nanosInMs = 1_000_000n;

export interface ChartDataset {
    label: string;
    data: (number | null)[];
    fill: boolean;
    borderColor: string;
    backgroundColor: string;
    tension: number;
    spanGaps: boolean;
}

export interface ChartData {
    labels: string[];
    datasets: ChartDataset[];
}

export interface MetricTableDataPoint {
    time_ns: bigint;
    timestamp: string;
    resource: string;
    value: number | string;
    p50?: number;
    p95?: number;
    p99?: number;
    attributes: Record<string, string>;
}

const getColors = (index: number) => {
    const colors = [
        '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
        '#ec4899', '#06b6d4', '#84cc16', '#14b8a6', '#f97316'
    ];
    return colors[index % colors.length];
};

function calculatePercentile(bounds: number[], counts: number[], percentile: number): number {
    const totalCount = counts.reduce((a, b) => a + b, 0);
    if (totalCount === 0) return 0;
    
    const target = totalCount * (percentile / 100);
    let currentCount = 0;
    
    for (let i = 0; i < counts.length; i++) {
        currentCount += counts[i];
        if (currentCount >= target) {
            // Linear interpolation within the bucket
            const lowerBound = i === 0 ? 0 : bounds[i - 1];
            const upperBound = i === bounds.length ? (bounds[bounds.length - 1] * 2) : bounds[i];
            
            const prevCount = currentCount - counts[i];
            const countInBucket = counts[i];
            
            if (countInBucket === 0) return lowerBound;
            
            const ratio = (target - prevCount) / countInBucket;
            return lowerBound + (upperBound - lowerBound) * ratio;
        }
    }
    
    return bounds[bounds.length - 1] || 0;
}

function getRelevantMetrics(
    selectedMetric: Metric,
    allMetrics: AggregatedMetric[],
    selectedResource: Resource | null
): AggregatedMetric[] {
    const relevantMetrics = allMetrics.filter(m =>
        m.name === selectedMetric.name &&
        m.unit === selectedMetric.unit &&
        m.type === selectedMetric.type
    );

    return !selectedResource
        ? relevantMetrics
        : relevantMetrics.filter(m => m.resource.key === selectedResource.key);
}

function getResourceLabel(m: AggregatedMetric): string {
    return `${m.resource.service_name} (${m.resource.service_instance_id.substring(0, 8)})`;
}

function getShouldAccumulate(m: AggregatedMetric): boolean {
    const isDeltaSum = m.data.t === MetricType.Sum &&
        m.data.aggregation_temporality === AggregationTemporality.Delta;
    const isNonMonotonic = m.data.t === MetricType.Sum && !m.data.is_monotonic;
    return isDeltaSum && isNonMonotonic;
}

export function getChartData(selectedMetric: Metric, allMetrics: AggregatedMetric[], selectedResource: Resource|null): ChartData {
    const metricsToDisplay = getRelevantMetrics(selectedMetric, allMetrics, selectedResource);

    const allTimestamps = new Map<number, string>();
    metricsToDisplay.forEach(m => {
        const points = m.data.data_points;
        points.forEach(dp => {
            const ts = Number(dp.time_ns / nanosInMs);
            const date = new Date(ts);
            allTimestamps.set(ts, date.toLocaleTimeString());
        });
    });

    const sortedTimestampKeys = Array.from(allTimestamps.keys()).sort((a, b) => a - b);
    const sortedLabels = sortedTimestampKeys.map(ts => allTimestamps.get(ts)!);

    const datasets: ChartDataset[] = [];
    
    metricsToDisplay.forEach((m, index) => {
        const points = m.data.data_points;
        const shouldAccumulate = getShouldAccumulate(m);
        const resourceLabel = getResourceLabel(m);
        const color = getColors(index);

        if (m.data.t === MetricType.Histogram) {
            const avgMap = new Map<number, number>();

            (points as HistogramDataPoint[]).forEach(dp => {
                const ts = Number(dp.time_ns / nanosInMs);
                const avg = (dp.sum != null && dp.count > 0) ? dp.sum / dp.count : 0;
                avgMap.set(ts, avg);
            });

            datasets.push({
                label: `${resourceLabel} (Avg)`,
                data: sortedTimestampKeys.map(ts => avgMap.get(ts) ?? null),
                fill: false,
                borderColor: color,
                backgroundColor: color,
                tension: 0.4,
                spanGaps: true
            });

        } else {
            const dataMap = new Map<number, number>();
            let accumulator = 0;
            (points as NumberDataPoint[]).forEach(dp => {
                const ts = Number(dp.time_ns / nanosInMs);
                let value = dp.value ?? 0;
                if (shouldAccumulate) {
                    accumulator += value;
                    dataMap.set(ts, accumulator);
                } else {
                    dataMap.set(ts, value);
                }
            });

            datasets.push({
                label: resourceLabel,
                data: sortedTimestampKeys.map(ts => dataMap.get(ts) ?? null),
                fill: false,
                borderColor: color,
                backgroundColor: color,
                tension: 0.4,
                spanGaps: true
            });
        }
    });

    return {
        labels: sortedLabels,
        datasets: datasets
    };
}

export function getTableData(
    selectedMetric: Metric,
    allMetrics: AggregatedMetric[],
    selectedResource: Resource|null
): MetricTableDataPoint[] {
    const metricsToDisplay = getRelevantMetrics(selectedMetric, allMetrics, selectedResource);

    const result: MetricTableDataPoint[] = [];

    metricsToDisplay.forEach(m => {
        const points = m.data?.data_points || [];
        const resourceLabel = getResourceLabel(m);
        const shouldAccumulate = getShouldAccumulate(m);

        let accumulator = 0;

        points.forEach(dp => {
            const ts = Number(dp.time_ns / nanosInMs);
            const date = new Date(ts);
            const timestampStr = date.toLocaleString();

            const row: MetricTableDataPoint = {
                time_ns: dp.time_ns,
                timestamp: timestampStr,
                resource: resourceLabel,
                value: 0,
                attributes: dp.attributes
            };

            if (dp.t === 'value') {
                if (shouldAccumulate) {
                    accumulator += dp.value ?? 0;
                    row.value = accumulator;
                } else {
                    row.value = dp.value ?? 0;
                }
            } else if (dp.t === 'histogram') {
                row.value = (dp.sum != null && dp.count > 0) ? (dp.sum / dp.count) : 0;
                row.p50 = calculatePercentile(dp.explicit_bounds, dp.bucket_counts, 50);
                row.p95 = calculatePercentile(dp.explicit_bounds, dp.bucket_counts, 95);
                row.p99 = calculatePercentile(dp.explicit_bounds, dp.bucket_counts, 99);
            }

            result.push(row);
        });
    });

    return result.sort((a, b) => sortBigIntDesc(a.time_ns, b.time_ns));
}