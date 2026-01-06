import {defineStore} from "pinia";
import {mapMetricResult, MetricDto, AggregatedMetric} from "../domain/metrics.ts";
import {computed, ref} from "vue";
import {useResourceStore} from "./resource-store.ts";
import {sortBigIntAsc} from "../helpers/bigint-helpers.ts";

export const useMetricsStore = defineStore('metrics', () => {
    const metrics = ref<AggregatedMetric[]>([]);
    const resourceStore = useResourceStore();
    const totalCount = computed(() => metrics.value.length);

    function addMetric(dto: MetricDto) {
        if (!dto.data) {
            return;
        }
        const metric = mapMetricResult(dto);

        resourceStore.addResource(metric.resource);

        const existing = metrics.value.find(m => m.key === metric.key);

        if (existing) {
            existing.description = metric.description;
            const newDataPoints = metric.data!.data_points;
            existing.data.data_points.push(...newDataPoints as any[]); // the new data points should be the same type.
            existing.data.data_points.sort((a, b) => sortBigIntAsc(a.time_ns, b.time_ns));

            // Keep only the last 1000 data points.
            if (existing.data.data_points.length > 1000) {
                existing.data.data_points = existing.data.data_points.slice(-1000);
            }
        } else {
            metrics.value.push({
                ...metric,
                data: metric.data!,
            });
        }
    }

    return {
        metrics,
        totalCount,
        addMetric,
    };
});
