<script setup lang="ts">
import {computed, ref, watch} from "vue";
import {useMetricsStore} from "../state/metrics-store.ts";
import ResourceSelector from "../components/resource-selector.vue";
import {Metric} from "../domain/metrics.ts";
import {getChartData, getTableData} from "../viewmodels/metrics-view-model.ts";
import {Resource} from "../domain/resources.ts";
import {formatAdaptive} from "../helpers/number-helpers.ts";

const metricsStore = useMetricsStore();
const selectedResource = ref<Resource|null>(null);
const selectedMetric = ref<Metric | null>(null);
const viewMode = ref<'chart' | 'table'>('chart');
const timeRange = ref<[number, number]>([0, 0]);
const isTimeRangeInitialized = ref(false);

const filteredMetrics = computed(() => {
  if (selectedResource.value) {
    return metricsStore.metrics.filter(m => m.resource.key === selectedResource.value!.key);
  }

  // When 'All Resources' is selected, group metrics by name+unit+type to show unique metrics in the list
  const uniqueMetrics: Metric[] = [];
  const seen = new Set<string>();

  for (const m of metricsStore.metrics) {
    const key = `${m.name}-${m.unit}-${m.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueMetrics.push(m);
    }
  }

  return uniqueMetrics;
});

const relevantMetricsForRange = computed(() => {
    if (!selectedMetric.value) return [];
    
    return metricsStore.metrics.filter(m =>
        m.name === selectedMetric.value!.name &&
        m.unit === selectedMetric.value!.unit &&
        m.type === selectedMetric.value!.type
    );
});

const totalTimeRange = computed(() => {
    let min = Infinity;
    let max = -Infinity;

    relevantMetricsForRange.value.forEach(m => {
        m.data.data_points.forEach(dp => {
            const ts = Number(dp.time_ns / 1_000_000n);
            if (ts < min) min = ts;
            if (ts > max) max = ts;
        });
    });

    if (min === Infinity) return { min: 0, max: 0 };
    return { min, max };
});

const formatTime = (ts: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString();
};

const formatDuration = (ms: number) => {
  if (ms < 0) ms = 0;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}min`;
  }
  if (minutes > 0) {
    return `${minutes}min ${seconds % 60}sec`;
  }
  return `${seconds}sec`;
};

const selectedDurationLabel = computed(() => {
  const duration = timeRange.value[1] - timeRange.value[0];
  return formatDuration(duration);
});

const selectMetric = (metric: Metric) => {
  selectedMetric.value = metric;
  isTimeRangeInitialized.value = false;
};

// Update time range when total range changes (e.g. new data comes in)
// but only if it hasn't been manually adjusted or if it's the first time
watch(totalTimeRange, (newRange, oldRange) => {
    if (!isTimeRangeInitialized.value && newRange.min !== Infinity) {
        timeRange.value = [newRange.min, newRange.max];
        isTimeRangeInitialized.value = true;
    } else if (isTimeRangeInitialized.value) {
        const wasAtEnd = oldRange && timeRange.value[1] >= oldRange.max - 1000; // add some precision interval
        
        // Ensure timeRange stays within totalTimeRange
        if (timeRange.value[0] < newRange.min) timeRange.value[0] = newRange.min;
        
        if (wasAtEnd) {
            const duration = timeRange.value[1] - timeRange.value[0];
            const newEnd = newRange.max;
            const newStart = Math.max(newRange.min, newEnd - duration);
            timeRange.value = [newStart, newEnd];
        } else {
            if (timeRange.value[1] > newRange.max) timeRange.value[1] = newRange.max;
        }
    }
}, { immediate: true });

const chartData = computed(() => {
  if (!selectedMetric.value) {
    return;
  }

  return getChartData(
      selectedMetric.value,
      metricsStore.metrics,
      selectedResource.value,
      timeRange.value[0],
      timeRange.value[1]
  );
});

const tableData = computed(() => {
    if (!selectedMetric.value) {
        return [];
    }
    return getTableData(
        selectedMetric.value,
        metricsStore.metrics,
        selectedResource.value,
        timeRange.value[0],
        timeRange.value[1]
    );
});

const isDarkMode = ref(window.matchMedia('(prefers-color-scheme: dark)').matches);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    isDarkMode.value = event.matches;
});

const chartOptions = computed(() => {
    const textColor = isDarkMode.value ? '#f3f4f6' : '#4b5563';
    const tickColor = isDarkMode.value ? '#9ca3af' : '#6b7280';
    const gridColor = isDarkMode.value ? '#444' : '#e5e7eb';

    return {
        maintainAspectRatio: false,
        aspectRatio: 0.6,
        plugins: {
            legend: {
                labels: {
                    color: textColor
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    color: tickColor
                },
                grid: {
                    color: gridColor
                }
            },
            y: {
                ticks: {
                    color: tickColor,
                    callback: (value: any, _: number, ticks: any[]) => formatAdaptive(value, ticks)
                },
                grid: {
                    color: gridColor
                }
            }
        }
    };
});

const filterMetrics = (resource: Resource|null) => {
  selectedResource.value = resource;
  if (selectedMetric.value && resource && selectedMetric.value.resource.key !== resource.key ) {
      selectedMetric.value = null;
  }
};

</script>

<template>
  <div class="page">
    <div class="page__container">
      <div class="page__header-row">
        <h1>Metrics</h1>
        <div class="page__filters">
          <resource-selector @update:model-value="filterMetrics" />
        </div>
      </div>

      <div class="metrics-content">
        <div class="metrics-list">
          <DataTable :value="filteredMetrics"
                     selection-mode="single"
                     @row-click="(e) => selectMetric(e.data)"
                     :row-class="(data) => ({ 'selected-row': selectedMetric === data })"
                     scrollable
                     scroll-height="flex"
                     :size="'small'"
                     class="list-table">
            <template #empty><div class="list-table__empty">No metrics recorded.</div></template>
            <Column field="name" header="Name"></Column>
            <Column field="unit" header="Unit" style="width: 100px"></Column>
            <Column header="Type" style="width: 150px; white-space: nowrap">
              <template #body="slotProps">
                <span v-if="slotProps.data.type !== 'Sum'">{{ slotProps.data.type }}</span>
                <span v-if="slotProps.data.type === 'Sum'">{{ slotProps.data.type }}{{ !!slotProps.data.data.is_monotonic ? ' (Monotonic)' : '' }}</span>
              </template>
            </Column>
            <Column field="description" header="Description"></Column>
          </DataTable>
        </div>

        <div class="metric-details" v-if="selectedMetric">
          <div class="metric-details__header">
            <div class="metric-details__info">
              <h3>{{ selectedMetric.name }} ({{ selectedMetric.unit }})</h3>
              <div class="metric-info">
                  <span class="badge">{{ selectedMetric.type }}</span>
                  <span class="badge" v-if="selectedMetric.data && 'aggregation_temporality' in selectedMetric.data">{{ selectedMetric.data.aggregation_temporality }}</span>
                  <span class="badge" v-if="selectedMetric.data && 'is_monotonic' in selectedMetric.data && selectedMetric.data.is_monotonic">Monotonic</span>
              </div>
              <p>{{ selectedMetric.description }}</p>
            </div>
            <div class="metric-details__actions">
              <SelectButton v-model="viewMode" :options="['chart', 'table']" aria-labelledby="basic">
                <template #option="slotProps">
                  <i :class="slotProps.option === 'chart' ? 'pi pi-chart-line' : 'pi pi-table'"></i>
                </template>
              </SelectButton>
            </div>
          </div>

          <div class="metric-timeline" v-if="totalTimeRange.min !== totalTimeRange.max">
            <div class="timeline-labels">
              <span>{{ formatTime(timeRange[0]) }}</span>
              <span class="timeline-duration">{{ selectedDurationLabel }}</span>
              <span>{{ formatTime(timeRange[1]) }}</span>
            </div>
            <Slider v-model="timeRange" range :min="totalTimeRange.min" :max="totalTimeRange.max" class="w-full" />
            <div class="timeline-full-range">
              <span>{{ formatTime(totalTimeRange.min) }}</span>
              <span>{{ formatTime(totalTimeRange.max) }}</span>
            </div>
          </div>

          <div v-if="viewMode === 'chart'" class="chart-container">
            <div class="chart-wrapper">
                <Chart type="line" :data="chartData" :options="chartOptions" class="h-full" />
            </div>
          </div>
          <div v-else class="table-container">
            <DataTable :value="tableData" size="small" scrollable scroll-height="flex" class="p-datatable-sm">
                <Column field="timestamp" header="Time" style="width: 180px"></Column>
                <Column field="resource" header="Resource" style="width: 300px" v-if="!selectedResource"></Column>
                <Column field="value" header="Value">
                    <template #body="slotProps">
                        {{ typeof slotProps.data.value === 'number' ? slotProps.data.value.toFixed(2) : slotProps.data.value }}
                    </template>
                </Column>
                <Column v-if="selectedMetric.type === 'Histogram'" field="p50" header="P50">
                    <template #body="slotProps">{{ slotProps.data.p50?.toFixed(2) }}</template>
                </Column>
                <Column v-if="selectedMetric.type === 'Histogram'" field="p95" header="P95">
                    <template #body="slotProps">{{ slotProps.data.p95?.toFixed(2) }}</template>
                </Column>
                <Column v-if="selectedMetric.type === 'Histogram'" field="p99" header="P99">
                    <template #body="slotProps">{{ slotProps.data.p99?.toFixed(2) }}</template>
                </Column>
                <Column header="Attributes">
                    <template #body="slotProps">
                        <div class="attribute-chips">
                            <span v-for="(val, key) in slotProps.data.attributes" :key="key" class="attribute-chip">
                                {{ key }}: {{ val }}
                            </span>
                        </div>
                    </template>
                </Column>
            </DataTable>
          </div>
        </div>
        <div class="metric-details-empty" v-else>
            <div class="empty-state">
                <i class="pi pi-chart-line" style="font-size: 3rem; color: #ccc;"></i>
                <p>Select a metric to view details</p>
            </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metrics-content {
  display: flex;
  flex: 1;
  gap: 20px;
  overflow: hidden;
}

.metrics-list {
  flex: 0 0 40%;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.metric-details {
  flex: 1 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.metric-details__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
}

.metric-details__info h3 {
    margin: 0 0 10px 0;
}

.metric-timeline {
    margin-bottom: 30px;
    padding: 0 10px;
}

.timeline-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    font-weight: bold;
    margin-bottom: 10px;
    color: #3b82f6;
    align-items: center;
}

.timeline-duration {
  background-color: #3b82f6;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
}

.timeline-full-range {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 5px;
}

.table-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.attribute-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.attribute-chip {
    background-color: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    border: 1px solid #e5e7eb;
}

.metric-details-empty {
  flex: 1;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f9fafb;
}

.empty-state {
    text-align: center;
    color: #6b7280;
}

.chart-container {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.chart-wrapper {
    flex: 1;
    min-height: 300px;
}

.metric-info {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
}

.badge {
    background-color: #f3f4f6;
    color: #374151;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
}

:deep(.selected-row) {
    background-color: #eff6ff !important;
}

@media (prefers-color-scheme: dark) {
    .metric-details {
        background-color: #1e1e1e;
        border-color: #444;
    }
    .metric-details-empty {
        background-color: #1a1a1a;
        border-color: #444;
    }
    .metrics-list {
        border-color: #444;
    }
    .badge {
        background-color: #374151;
        color: #f3f4f6;
    }
    .attribute-chip {
        background-color: #374151;
        color: #f3f4f6;
        border-color: #444;
    }
    :deep(.selected-row) {
        background-color: #2c3e50 !important;
    }
}
</style>
