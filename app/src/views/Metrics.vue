<script setup lang="ts">
import {computed, ref} from "vue";
import {useMetricsStore} from "../state/metrics-store.ts";
import ResourceSelector from "../components/resource-selector.vue";
import {Metric} from "../domain/metrics.ts";
import {getChartData} from "../viewmodels/metrics-view-model.ts";
import {Resource} from "../domain/resources.ts";

const metricsStore = useMetricsStore();
const selectedResource = ref<Resource|null>(null);
const selectedMetric = ref<Metric | null>(null);

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

const selectMetric = (metric: Metric) => {
  selectedMetric.value = metric;
};

const chartData = computed(() => {
  if (!selectedMetric.value) {
    return;
  }

  return getChartData(selectedMetric.value, metricsStore.metrics, selectedResource.value);
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
                    color: tickColor
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
          <DataTable :value="filteredMetrics" selection-mode="single" @row-click="(e) => selectMetric(e.data)" :row-class="(data) => ({ 'selected-row': selectedMetric === data })" size="small" scrollable scroll-height="flex">
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
          <div class="chart-container">
            <h3>{{ selectedMetric.name }} ({{ selectedMetric.unit }})</h3>
            <div class="metric-info">
                <span class="badge">{{ selectedMetric.type }}</span>
                <span class="badge" v-if="selectedMetric.data && 'aggregation_temporality' in selectedMetric.data">{{ selectedMetric.data.aggregation_temporality }}</span>
                <span class="badge" v-if="selectedMetric.data && 'is_monotonic' in selectedMetric.data && selectedMetric.data.is_monotonic">Monotonic</span>
            </div>
            <p>{{ selectedMetric.description }}</p>
            <div class="chart-wrapper">
                <Chart type="line" :data="chartData" :options="chartOptions" class="h-full" />
            </div>
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
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page__container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page__header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.page__filters {
  display: flex;
  align-items: center;
  gap: 10px;
}

.metrics-content {
  display: flex;
  flex: 1;
  gap: 20px;
  overflow: hidden;
}

.metrics-list {
  flex: 1;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.metric-details {
  flex: 1;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
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

.list-table__empty {
    padding: 20px;
    text-align: center;
    color: #6b7280;
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
    :deep(.selected-row) {
        background-color: #2c3e50 !important;
    }
}
</style>
