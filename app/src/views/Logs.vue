<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import {useLogsStore} from "../state/logs-store.ts";
import {Log} from "../domain/logs.ts";
import ResourceSelector from "../components/resource-selector.vue";
import {getSeverityType} from "../domain/logs-exensions.ts";
import LogsDetailsView from "../components/logs-details-view.vue";
import FiltersComponent from "../components/filters-component.vue";
import {FilterService, filterServiceInjectionKey} from "../services/filter-service.ts";
import {StorageService} from "../services/storage-service.ts";

const filterService = new FilterService("logs");
provide(filterServiceInjectionKey, filterService);

const logsStore = useLogsStore();

const storage = new StorageService();
const logsRowsPerPageOptions = [10, 25, 50, 100];
const logsRowsPerPage = storage.createStorageItem('logsRowsPerPage', (item) => {
  if (!item) return 25;
  const rows = Number(item);
  return logsRowsPerPageOptions.includes(rows) ? rows : 25
});

const selectedLog = ref<Log | null>(null);

const filteredLogs = computed(() => {
  return logsStore.logs.filter(log => filterService.matchesFilter(log));
});

const closeDetails = () => {
  selectedLog.value = null;
};

</script>

<template>
  <div class="page">
    <div class="page__container" :class="{ 'page__container--with-details': selectedLog }">
      <div class="page__header-row">
        <h1>Logs</h1>
        <div class="page__filters">
          <resource-selector />
        </div>
      </div>
      
      <filters-component />

      <DataTable
        v-model:selection="selectedLog" 
        :value="filteredLogs" 
        selectionMode="single"
        dataKey="time_unix_nano"
        :scrollable="true" 
        scrollHeight="flex"
        resizableColumns 
        columnResizeMode="fit"
        sortField="timestamp"
        :sortOrder="-1"
        paginator
        v-model:rows="logsRowsPerPage"
        :rows-per-page-options="logsRowsPerPageOptions"
        :size="'small'"
        class="list-table"
      >
        <template #empty><div class="list-table__empty">No logs recorded.</div></template>
        <Column field="timestamp" header="Timestamp" sortable :style="{ width: '220px' }">
          <template #body="slotProps">
            {{ slotProps.data.logTimeStamp.toLocaleString() }}
          </template>
        </Column>
        <Column field="severity" header="Level" sortable :style="{ width: '120px' }">
          <template #body="slotProps">
            <span :class="['level', getSeverityType(slotProps.data.severity)]">
              {{ slotProps.data.severity }}
            </span>
          </template>
        </Column>
        <Column field="scope" header="Scope" sortable :style="{ width: '150px' }"></Column>
        <Column field="message" header="Message" sortable></Column>
      </DataTable>
    </div>

    <Transition name="slide">
      <logs-details-view :log="selectedLog" v-if="selectedLog" @close="closeDetails" />
    </Transition>
  </div>
</template>

<style scoped>
:deep(.level.debug) { color: var(--logs-severity-debug); }
:deep(.level.info) { color: var(--logs-severity-info); }
:deep(.level.warn) { color: var(--logs-severity-warning); }
:deep(.level.error) { color: var(--logs-severity-error); }
:deep(.level.critical) { color: var(--logs-severity-critical); }
</style>
