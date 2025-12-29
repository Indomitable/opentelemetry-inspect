<script setup lang="ts">
import { ref, computed } from 'vue';
import { state, type LogDto } from '../store';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Select from 'primevue/select';

const selectedLog = ref<LogDto | null>(null);
const selectedInstanceId = ref<string>('');

const selectLog = (event: { data: LogDto }) => {
  selectedLog.value = event.data;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};

const instanceIds = computed(() => {
  const ids = new Set(state.logs.map(log => log.resource.service_instance_id));
  return Array.from(ids).sort().map(id => ({ label: id, value: id }));
});

const instanceOptions = computed(() => {
  return [{ label: 'All Instances', value: '' }, ...instanceIds.value];
});

const filteredLogs = computed(() => {
  let logs = [...state.logs];

  if (selectedInstanceId.value) {
    logs = logs.filter(log => log.resource.service_instance_id === selectedInstanceId.value);
  }

  return logs;
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
  <div class="logs-page">
    <div class="logs-container" :class="{ 'with-details': selectedLog }">
      <div class="header-row">
        <h1>Logs</h1>
        <div class="filters">
          <label for="instance-filter">Instance ID:</label>
          <Select 
            id="instance-filter" 
            v-model="selectedInstanceId" 
            :options="instanceOptions" 
            optionLabel="label" 
            optionValue="value" 
            placeholder="Select Instance"
            size="small"
          />
        </div>
      </div>
      
      <DataTable 
        v-model:selection="selectedLog" 
        :value="filteredLogs" 
        selectionMode="single" 
        @row-select="selectLog"
        dataKey="timestamp" 
        :scrollable="true" 
        scrollHeight="flex"
        resizableColumns 
        columnResizeMode="fit"
        sortField="timestamp" 
        :sortOrder="-1"
        class="p-datatable-sm custom-table"
      >
        <template #empty><div class="custom-table__empty">No logs recorded.</div></template>
        <Column field="timestamp" header="Timestamp" sortable :style="{ width: '220px' }">
          <template #body="slotProps">
            {{ formatDate(slotProps.data.timestamp) }}
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
          <div class="details-table">
            <div class="details-row header">
              <div>Key</div>
              <div>Value</div>
            </div>
            <div class="details-row">
              <div>Service Name</div>
              <div>{{ selectedLog.resource.service_name }}</div>
            </div>
            <div class="details-row">
              <div>Service Version</div>
              <div>{{ selectedLog.resource.service_version }}</div>
            </div>
            <div class="details-row">
              <div>Service Namespace</div>
              <div>{{ selectedLog.resource.service_namespace }}</div>
            </div>
            <div class="details-row">
              <div>Service Instance ID</div>
              <div>{{ selectedLog.resource.service_instance_id }}</div>
            </div>
            <div v-for="(value, key) in selectedLog!.resource.attributes" :key="key" class="details-row">
              <div>{{ key }}</div>
              <div>{{ value }}</div>
            </div>
          </div>

          <h3>Tags</h3>
          <div class="details-table">
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
.logs-page {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.logs-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: flex 0.3s;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.filters {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logs-container.with-details {
  flex: 0 0 60%;
  padding-right: 15px;
}

.custom-table {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

@media (prefers-color-scheme: dark) {
  .custom-table {
    border-color: #444;
  }
}

.custom-table__empty {
  text-align: center;
  height: 40px;
  line-height: 40px;
}

.level.info { color: #2196f3; }
.level.error { color: #f44336; }
.level.critical { color: #d32f2f; }
.level.warn { color: #ff9800; }
.level.debug { color: #9c27b0; }

.details-panel {
  flex: 0 0 40%;
  border-left: 1px solid #ddd;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-shadow: -2px 0 5px rgba(0,0,0,0.05);
  padding: 15px;
}

@media (prefers-color-scheme: dark) {
  .details-panel {
    background: #1e1e1e;
    border-color: #444;
  }
}

.details-header {
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  gap: 10px;
}

.details-header h2 {
  margin: 0;
  font-size: 1.2rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@media (prefers-color-scheme: dark) {
  .details-header {
    border-bottom-color: #333;
  }
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #888;
  order: 2;
  margin-left: auto;
}

.details-content {
}

.details-table {
  display: flex;
  flex-direction: column;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 20px;
}

@media (prefers-color-scheme: dark) {
  .details-table {
    border-color: #333;
  }
}

.details-row {
  display: flex;
  border-bottom: 1px solid #eee;
}

@media (prefers-color-scheme: dark) {
  .details-row {
    border-bottom-color: #333;
  }
}

.details-row:last-child {
  border-bottom: none;
}

.details-row.header {
  background: #f9f9f9;
  font-weight: bold;
}

@media (prefers-color-scheme: dark) {
  .details-row.header {
    background: #2a2a2a;
  }
}

.details-row div {
  padding: 8px;
  flex: 1;
  word-break: break-all;
}

.details-row div:first-child {
  flex: 0 0 160px;
  border-right: 1px solid #eee;
  background: #fafafa;
}

@media (prefers-color-scheme: dark) {
  .details-row div:first-child {
    border-right-color: #333;
    background: #252525;
  }
}
</style>
