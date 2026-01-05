<script setup lang="ts">
import { ref, computed } from 'vue';
import {useLogsStore} from "../state/logs-store.ts";
import {Log} from "../domain/logs.ts";
import ResourceDetailsView from "../components/resource-details-view.vue";
import ResourceSelector from "../components/resource-selector.vue";

const logsStore = useLogsStore();

const selectedLog = ref<Log | null>(null);
const selectedInstanceId = ref<string>('-');

const filterLogs = (instanceId: string) => {
  selectedInstanceId.value = instanceId;
};

const filteredLogs = computed(() => {
  if (selectedInstanceId.value !== '-') {
    return logsStore.logsByInstance(selectedInstanceId.value);
  }

  return logsStore.logs;
});

const getLogLevelClass = (logLevel: string) => {
  switch (logLevel.toLowerCase()) {
    case "info":
    case "information": {
      return "info";
    }
    case "warn":
    case "warning": {
      return "warn";
    }
    case "error": {
      return "error";
    }
    case "critical":
    case "fatal": {
      return "critical";
    }
    case "debug":
    case "trace": {
      return "debug";
    }
    default: {
      return "";
    }
  }
}

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
            <span :class="['level', getLogLevelClass(slotProps.data.severity)]">
              {{ slotProps.data.severity }}
            </span>
          </template>
        </Column>
        <Column field="scope" header="Scope" sortable :style="{ width: '150px' }"></Column>
        <Column field="message" header="Message" sortable></Column>
      </DataTable>
    </div>

    <Transition name="slide">
      <section v-if="selectedLog" class="details-panel">
        <div class="details-header">
          <button class="close-btn" @click="selectedLog = null">×</button>
          <h2>Log Details</h2>
        </div>
        
        <div class="details-content">
          <h3>Log Message</h3>
          <div class="details-table">
            <div class="details-row header">
              <div>Key</div>
              <div>Value</div>
            </div>
            <div class="details-row">
              <div>Timestamp</div>
              <div>{{ selectedLog.timestamp }}</div>
            </div>
            <div class="details-row">
              <div>Level</div>
              <div :class="['level', getLogLevelClass(selectedLog!.severity)]">
                {{ selectedLog.severity }}
              </div>
            </div>
            <div class="details-row">
              <div>Scope</div>
              <div>{{ selectedLog.scope }}</div>
            </div>
            <div class="details-row">
              <div>Message</div>
              <div>{{ selectedLog.message }}</div>
            </div>
            <div class="details-row" v-if="selectedLog?.trace_id">
              <div>Trace Id</div>
              <div>{{ selectedLog.trace_id }}</div>
            </div>
            <div class="details-row" v-if="selectedLog?.span_id">
              <div>Span Id</div>
              <div>{{ selectedLog.span_id }}</div>
            </div>
            <div class="details-row" v-if="selectedLog?.event_name">
              <div>Event Name</div>
              <div>{{ selectedLog.event_name }}</div>
            </div>
          </div>

          <h3>Resource Info</h3>
          <resource-details-view :resource="selectedLog!.resource" />

          <h3 v-if="selectedLog!.tags.length">Attributes</h3>
          <div class="details-table" v-if="selectedLog!.tags.length">
            <div class="details-row header">
              <div>Key</div>
              <div>Value</div>
            </div>
            <div v-for="(value, key) in selectedLog!.tags" :key="key" class="details-row">
              <div>{{ key }}</div>
              <div>{{ value }}</div>
            </div>
          </div>
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped>

.level.info { color: #2196f3; }
.level.error { color: #f44336; }
.level.critical { color: #d32f2f; }
.level.warn { color: #ff9800; }
.level.debug { color: #9c27b0; }



</style>
