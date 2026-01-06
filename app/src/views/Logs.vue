<script setup lang="ts">
import { ref, computed } from 'vue';
import {useLogsStore} from "../state/logs-store.ts";
import {Log} from "../domain/logs.ts";
import ResourceSelector from "../components/resource-selector.vue";
import {getSeverityType} from "../domain/logs-exensions.ts";
import LogsDetailsView from "../components/logs-details-view.vue";
import {Resource} from "../domain/resources.ts";

const logsStore = useLogsStore();

const selectedLog = ref<Log | null>(null);
const selectedResource = ref<Resource|null>(null);

const filterLogs = (resource: Resource|null) => {
  selectedResource.value = resource;
};

const filteredLogs = computed(() => {
  if (selectedResource.value) {
    return logsStore.logsByResource(selectedResource.value);
  }

  return logsStore.logs;
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
          <resource-selector @update:model-value="filterLogs" />
        </div>
      </div>
      
      <DataTable 
        v-model:selection="selectedLog" 
        :value="filteredLogs" 
        selectionMode="single"
        dataKey="timestamp"
        :scrollable="true" 
        scrollHeight="flex"
        resizableColumns 
        columnResizeMode="fit"
        sortField="timestamp"
        :sortOrder="-1"
        paginator
        :rows="25"
        :rows-per-page-options="[10, 25, 50, 100]"
        class="p-datatable-sm list-table"
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
