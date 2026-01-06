import { describe, it, expect } from 'vitest';
import { getChartData, getTableData } from '../metrics-view-model';
import { Metric, AggregatedMetric, MetricType, AggregationTemporality } from '../../domain/metrics';

describe('metrics-view-model', () => {
    it('should correctly extract values from NumberDataPoint (Gauge/Sum)', () => {
        const metric: Metric = {
            name: 'test_metric',
            unit: 'ms',
            description: 'desc',
            scope: 'scope',
            resource: {
                service_name: 'service-a',
                service_instance_id: 'instance-1',
                service_version: '',
                service_namespace: '',
                attributes: {},
                key: 'r1'
            },
            key: 'key1',
            type: MetricType.Gauge,
        };

        const aggregatedMetric: AggregatedMetric = {
            ...metric,
            data: {
                t: MetricType.Gauge,
                data_points: [
                    {
                        t: 'value',
                        start_time_unix_nano: '1000000000',
                        time_unix_nano: '1000000000', // 1000 ms
                        start_ns: 1000000000n,
                        time_ns: 1000000000n,
                        value: 42,
                        attributes: {},
                        exemplars: []
                    },
                    {
                        t: 'value',
                        start_time_unix_nano: '2000000000',
                        time_unix_nano: '2000000000', // 2000 ms
                        start_ns: 2000000000n,
                        time_ns: 2000000000n,
                        value: 100,
                        attributes: {},
                        exemplars: []
                    }
                ]
            }
        };

        const chartData = getChartData(metric, [aggregatedMetric], null, 1000, 2000);

        expect(chartData.labels.length).toBe(2);
        expect(chartData.datasets.length).toBe(1);
        expect(chartData.datasets[0].data).toEqual([42, 100]);
        expect(chartData.datasets[0].label).toContain('service-a');
    });

    it('should correctly calculate average from HistogramDataPoint (sum / count)', () => {
        const metric: Metric = {
            name: 'hist_metric',
            unit: 'ms',
            description: 'desc',
            scope: 'scope',
            resource: {
                service_name: 'service-b',
                service_instance_id: 'instance-2',
                service_version: '',
                service_namespace: '',
                attributes: {},
                key: 'r2'
            },
            key: 'key2',
            type: MetricType.Histogram,
        };

        const aggregatedMetric: AggregatedMetric = {
            ...metric,
            data: {
                t: MetricType.Histogram,
                aggregation_temporality: AggregationTemporality.Cumulative,
                data_points: [
                    {
                        t: 'histogram',
                        start_time_unix_nano: '1000000000',
                        time_unix_nano: '1000000000',
                        start_ns: 1000000000n,
                        time_ns: 1000000000n,
                        count: 10,
                        sum: 500,
                        bucket_counts: [],
                        explicit_bounds: [],
                        attributes: {},
                        exemplars: []
                    }
                ]
            }
        };

        const chartData = getChartData(metric, [aggregatedMetric], null, 1000, 2000);

        expect(chartData.datasets[0].data).toEqual([50]);
    });

    it('should correctly extract values from HistogramDataPoint (using count when sum missing)', () => {
        const metric: Metric = {
            name: 'hist_metric_no_sum',
            unit: 'ms',
            description: 'desc',
            scope: 'scope',
            resource: {
                service_name: 'service-b',
                service_instance_id: 'instance-2',
                service_version: '',
                service_namespace: '',
                attributes: {},
                key: 'r2'
            },
            key: 'key3',
            type: MetricType.Histogram,
        };

        const aggregatedMetric: AggregatedMetric = {
            ...metric,
            data: {
                t: MetricType.Histogram,
                aggregation_temporality: AggregationTemporality.Cumulative,
                data_points: [
                    {
                        t: 'histogram',
                        start_time_unix_nano: '1000000000',
                        time_unix_nano: '1000000000',
                        start_ns: 1000000000n,
                        time_ns: 1000000000n,
                        count: 15,
                        // sum is undefined
                        bucket_counts: [],
                        explicit_bounds: [],
                        attributes: {},
                        exemplars: []
                    }
                ]
            }
        };

        const chartData = getChartData(metric, [aggregatedMetric], null, 1000, 2000);

        expect(chartData.datasets[0].data).toEqual([0]);
    });

    it('should handle multiple resources (metrics with same name/unit)', () => {
        const baseMetric = {
            name: 'common_metric',
            unit: '1',
            description: 'desc',
            scope: 'scope',
            type: MetricType.Gauge,
        };

        const metric1: AggregatedMetric = {
            ...baseMetric,
            resource: {
                service_name: 'service-1',
                service_instance_id: 'inst-1',
                service_version: '',
                service_namespace: '',
                attributes: {},
                key: 'r1'
            },
            key: 'k1',
            data: {
                t: MetricType.Gauge,
                data_points: [{
                    t: 'value',
                    start_time_unix_nano: '1000000000',
                    time_unix_nano: '1000000000',
                    start_ns: 1000000000n,
                    time_ns: 1000000000n,
                    value: 10,
                    attributes: {},
                    exemplars: []
                }]
            }
        };

        const metric2: AggregatedMetric = {
            ...baseMetric,
            resource: {
                service_name: 'service-2',
                service_instance_id: 'inst-2',
                service_version: '',
                service_namespace: '',
                attributes: {},
                key: 'r2'
            },
            key: 'k2',
            data: {
                t: MetricType.Gauge,
                data_points: [{
                    t: 'value',
                    start_time_unix_nano: '1000000000',
                    time_unix_nano: '1000000000',
                    start_ns: 1000000000n,
                    time_ns: 1000000000n,
                    value: 20,
                    attributes: {},
                    exemplars: []
                }]
            }
        };

        const chartData = getChartData(metric1, [metric1, metric2], null, 1000, 2000);

        expect(chartData.datasets.length).toBe(2);
        expect(chartData.datasets.find(d => d.label.includes('service-1'))?.data).toEqual([10]);
        expect(chartData.datasets.find(d => d.label.includes('service-2'))?.data).toEqual([20]);
    });

    it('should accumulate values for non-monotonic Sum with Delta temporality', () => {
        const metric: Metric = {
            name: 'up_down_counter',
            unit: '1',
            description: 'desc',
            scope: 'scope',
            resource: {
                service_name: 'service-a',
                service_instance_id: 'instance-1',
                service_version: '',
                service_namespace: '',
                attributes: {},
                key: 'r1'
            },
            key: 'key1',
            type: MetricType.Sum,
        };

        const aggregatedMetric: AggregatedMetric = {
            ...metric,
            data: {
                t: MetricType.Sum,
                aggregation_temporality: AggregationTemporality.Delta,
                is_monotonic: false,
                data_points: [
                    {
                        t: 'value',
                        start_time_unix_nano: '1000000000',
                        time_unix_nano: '1000000000',
                        start_ns: 1000000000n,
                        time_ns: 1000000000n,
                        value: 10,
                        attributes: {},
                        exemplars: []
                    },
                    {
                        t: 'value',
                        start_time_unix_nano: '2000000000',
                        time_unix_nano: '2000000000',
                        start_ns: 2000000000n,
                        time_ns: 2000000000n,
                        value: 5,
                        attributes: {},
                        exemplars: []
                    },
                    {
                        t: 'value',
                        start_time_unix_nano: '3000000000',
                        time_unix_nano: '3000000000',
                        start_ns: 3000000000n,
                        time_ns: 3000000000n,
                        value: -3,
                        attributes: {},
                        exemplars: []
                    }
                ]
            }
        };

        const chartData = getChartData(metric, [aggregatedMetric], null, 1000, 3000);

        // Currently it does NOT accumulate, so it will return [10, 5, -3]
        // But it should return [10, 15, 12]
        expect(chartData.datasets[0].data).toEqual([10, 15, 12]);
    });

    it('should NOT accumulate values for monotonic Sum with Delta temporality', () => {
        const metric: Metric = {
            name: 'monotonic_counter',
            unit: '1',
            description: 'desc',
            scope: 'scope',
            resource: {
                service_name: 'service-a',
                service_instance_id: 'instance-1',
                service_version: '',
                service_namespace: '',
                attributes: {},
                key: 'r1'
            },
            key: 'key1',
            type: MetricType.Sum,
        };

        const aggregatedMetric: AggregatedMetric = {
            ...metric,
            data: {
                t: MetricType.Sum,
                aggregation_temporality: AggregationTemporality.Delta,
                is_monotonic: true,
                data_points: [
                    {
                        t: 'value',
                        start_time_unix_nano: '1000000000',
                        time_unix_nano: '1000000000',
                        start_ns: 1000000000n,
                        time_ns: 1000000000n,
                        value: 10,
                        attributes: {},
                        exemplars: []
                    },
                    {
                        t: 'value',
                        start_time_unix_nano: '2000000000',
                        time_unix_nano: '2000000000',
                        start_ns: 2000000000n,
                        time_ns: 2000000000n,
                        value: 5,
                        attributes: {},
                        exemplars: []
                    }
                ]
            }
        };

        const chartData = getChartData(metric, [aggregatedMetric], null, 1000, 3000);

        expect(chartData.datasets[0].data).toEqual([10, 5]);
    });

    it('should generate table data correctly', () => {
        const metric: Metric = {
            name: 'test_metric',
            unit: 'ms',
            description: 'desc',
            scope: 'scope',
            resource: {
                service_name: 'service-a',
                service_instance_id: 'instance-1',
                service_version: '',
                service_namespace: '',
                attributes: {},
                key: 'r1'
            },
            key: 'key1',
            type: MetricType.Gauge,
        };

        const aggregatedMetric: AggregatedMetric = {
            ...metric,
            data: {
                t: MetricType.Gauge,
                data_points: [
                    {
                        t: 'value',
                        start_time_unix_nano: '1000000000',
                        time_unix_nano: '1000000000',
                        start_ns: 1000000000n,
                        time_ns: 1000000000n,
                        value: 42,
                        attributes: { host: 'localhost' },
                        exemplars: []
                    }
                ]
            }
        };

        const tableData = getTableData(metric, [aggregatedMetric], null, 1000, 3000);

        expect(tableData.length).toBe(1);
        expect(tableData[0].value).toBe(42);
        expect(tableData[0].attributes).toEqual({ host: 'localhost' });
        expect(tableData[0].resource).toContain('service-a');
    });

    it('should filter data points by time range', () => {
        const metric: Metric = {
            name: 'test_metric',
            unit: 'ms',
            description: 'desc',
            scope: 'scope',
            resource: {
                service_name: 'service-a',
                service_instance_id: 'instance-1',
                service_version: '',
                service_namespace: '',
                attributes: {},
                key: 'r1'
            },
            key: 'key1',
            type: MetricType.Gauge,
        };

        const aggregatedMetric: AggregatedMetric = {
            ...metric,
            data: {
                t: MetricType.Gauge,
                data_points: [
                    {
                        t: 'value',
                        start_time_unix_nano: '1000000000',
                        time_unix_nano: '1000000000', // 1000 ms
                        start_ns: 1000000000n,
                        time_ns: 1000000000n,
                        value: 10,
                        attributes: {},
                        exemplars: []
                    },
                    {
                        t: 'value',
                        start_time_unix_nano: '2000000000',
                        time_unix_nano: '2000000000', // 2000 ms
                        start_ns: 2000000000n,
                        time_ns: 2000000000n,
                        value: 20,
                        attributes: {},
                        exemplars: []
                    },
                    {
                        t: 'value',
                        start_time_unix_nano: '3000000000',
                        time_unix_nano: '3000000000', // 3000 ms
                        start_ns: 3000000000n,
                        time_ns: 3000000000n,
                        value: 30,
                        attributes: {},
                        exemplars: []
                    }
                ]
            }
        };

        // Filter for [1500, 2500]
        const chartData = getChartData(metric, [aggregatedMetric], null, 1500, 2500);
        expect(chartData.labels.length).toBe(1);
        expect(chartData.datasets[0].data).toEqual([20]);

        const tableData = getTableData(metric, [aggregatedMetric], null, 1500, 2500);
        expect(tableData.length).toBe(1);
        expect(tableData[0].value).toBe(20);
    });

    it('should correctly accumulate values even when start time is in the middle', () => {
        const metric: Metric = {
            name: 'up_down',
            unit: '1',
            description: 'desc',
            scope: 'scope',
            resource: { service_name: 's', service_instance_id: 'i', service_version: '', service_namespace: '', attributes: {}, key: 'r' },
            key: 'k',
            type: MetricType.Sum,
        };

        const aggregatedMetric: AggregatedMetric = {
            ...metric,
            data: {
                t: MetricType.Sum,
                aggregation_temporality: AggregationTemporality.Delta,
                is_monotonic: false,
                data_points: [
                    { t: 'value', start_time_unix_nano: '1000000000', time_unix_nano: '1000000000', start_ns: 1000000000n, time_ns: 1000000000n, value: 10, attributes: {}, exemplars: [] },
                    { t: 'value', start_time_unix_nano: '2000000000', time_unix_nano: '2000000000', start_ns: 2000000000n, time_ns: 2000000000n, value: 5, attributes: {}, exemplars: [] },
                    { t: 'value', start_time_unix_nano: '3000000000', time_unix_nano: '3000000000', start_ns: 3000000000n, time_ns: 3000000000n, value: 2, attributes: {}, exemplars: [] }
                ]
            }
        };

        // If we start from 2000ms, the accumulator should already be 15 (10 + 5)
        const tableData = getTableData(metric, [aggregatedMetric], null, 1500, 3500);
        expect(tableData.length).toBe(2);
        expect(tableData.find(d => d.time_ns === 2000000000n)?.value).toBe(15);
        expect(tableData.find(d => d.time_ns === 3000000000n)?.value).toBe(17);
    });
});
