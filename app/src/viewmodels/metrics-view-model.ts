import { AggregatedMetric, Metric, MetricType, AggregationTemporality } from "../domain/metrics";
import {Resource} from "../domain/resources.ts";

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

const getColors = (index: number) => {
    const colors = [
        '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
        '#ec4899', '#06b6d4', '#84cc16', '#14b8a6', '#f97316'
    ];
    return colors[index % colors.length];
};

export function getChartData(
    selectedMetric: Metric,
    allMetrics: AggregatedMetric[],
    selectedResource: Resource|null
): ChartData {
    // Find all metrics that match the selected metric's name, unit, and type
    const relevantMetrics = allMetrics.filter(m =>
        m.name === selectedMetric.name &&
        m.unit === selectedMetric.unit &&
        m.type === selectedMetric.type
    );

    // If a specific resource is selected, further filter
    const metricsToDisplay = !selectedResource
        ? relevantMetrics
        : relevantMetrics.filter(m => m.resource.key === selectedResource.key);

    // Collect all unique timestamps for the X-axis
    const allTimestamps = new Map<number, string>();
    metricsToDisplay.forEach(m => {
        // Access data_points from data property
        const points = m.data?.data_points || [];
        points.forEach(dp => {
            const ts = Number(dp.time_ns / 1000000n);
            const date = new Date(ts);
            allTimestamps.set(ts, date.toLocaleTimeString());
        });
    });

    const sortedTimestampKeys = Array.from(allTimestamps.keys()).sort((a, b) => a - b);
    const sortedLabels = sortedTimestampKeys.map(ts => allTimestamps.get(ts)!);

    const datasets = metricsToDisplay.map((m, index) => {
        const dataMap = new Map<number, number>();
        const points = m.data?.data_points || [];

        const isDeltaSum = m.data.t === MetricType.Sum &&
            m.data.aggregation_temporality === AggregationTemporality.Delta;

        const isNonMonotonic = m.data.t === MetricType.Sum && !m.data.is_monotonic;

        const shouldAccumulate = isDeltaSum && isNonMonotonic;
        
        let accumulator = 0;
        points.forEach(dp => {
            const ts = Number(dp.time_ns / 1000000n);
            let value: number;

            // Correctly extract value based on type
            // Check for 'value' property which exists on NumberDataPoint
            if (dp.t === 'value') {
                // number data point.
                value = dp.value ?? 0;
            } else {
                // sum can be null only if we measure negative values.
                // it can be 0 if there are no values.
                if (dp.sum != null && dp.count > 0) {
                    // get average.
                    value = dp.sum / dp.count;
                } else {
                    // whe sum is not available, set it to 0.
                    value = 0;
                }
            }

            if (shouldAccumulate) {
                accumulator += value;
                dataMap.set(ts, accumulator);
            } else {
                dataMap.set(ts, value);
            }
        });

        const data = sortedTimestampKeys.map(ts => dataMap.get(ts) ?? null);

        return {
            label: `${m.resource.service_name} (${m.resource.service_instance_id.substring(0, 8)})`,
            data: data,
            fill: false,
            borderColor: getColors(index),
            backgroundColor: getColors(index),
            tension: 0.4,
            spanGaps: true
        };
    });

    return {
        labels: sortedLabels,
        datasets: datasets
    };
}