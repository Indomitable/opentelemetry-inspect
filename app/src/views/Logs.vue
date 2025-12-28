<script setup lang="ts">
import { ref, computed } from 'vue';
import { state, type LogDto } from '../store';

const selectedLog = ref<LogDto | null>(null);
const selectedInstanceId = ref<string>('');
const sortOrder = ref<'asc' | 'desc'>('desc');

const columnWidths = ref({
  timestamp: 220,
  level: 120,
  scope: 150,
});

const gridStyle = computed(() => {
  return {
    display: 'grid',
    gridTemplateColumns: `${columnWidths.value.timestamp}px ${columnWidths.value.level}px ${columnWidths.value.scope}px 1fr`,
  };
});

let isResizing = false;
let currentColumn = '';
let startX = 0;
let startWidth = 0;

const startResize = (column: 'timestamp' | 'level' | 'scope', event: MouseEvent) => {
  isResizing = true;
  currentColumn = column;
  startX = event.pageX;
  startWidth = columnWidths.value[column];
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', stopResize);
  document.body.style.cursor = 'col-resize';
};

const handleMouseMove = (event: MouseEvent) => {
  if (!isResizing) return;
  const diff = event.pageX - startX;
  const newWidth = Math.max(50, startWidth + diff);
  if (currentColumn === 'timestamp' || currentColumn === 'level' || currentColumn === 'scope') {
    columnWidths.value[currentColumn] = newWidth;
  }
};

const stopResize = () => {
  isResizing = false;
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.cursor = '';
};

const selectLog = (log: LogDto) => {
  selectedLog.value = log;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};

const instanceIds = computed(() => {
  const ids = new Set(state.logs.map(log => log.resource.service_instance_id));
  return Array.from(ids).sort();
});

const filteredAndSortedLogs = computed(() => {
  let logs = [...state.logs];

  if (selectedInstanceId.value) {
    logs = logs.filter(log => log.resource.service_instance_id === selectedInstanceId.value);
  }

  logs.sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return sortOrder.value === 'asc' ? dateA - dateB : dateB - dateA;
  });

  return logs;
});

const toggleSort = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
};
</script>

<template>
  <div class="logs-page">
    <div class="logs-container" :class="{ 'with-details': selectedLog }">
      <div class="header-row">
        <h1>Logs</h1>
        <div class="filters">
          <label for="instance-filter">Instance ID:</label>
          <select id="instance-filter" v-model="selectedInstanceId">
            <option value="">All Instances</option>
            <option v-for="id in instanceIds" :key="id" :value="id">{{ id }}</option>
          </select>
        </div>
      </div>
      <div class="table">
        <div class="table-header" :style="gridStyle">
          <div class="col timestamp sortable" @click="toggleSort">
            Timestamp
            <span class="sort-icon">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            <div class="resizer" @mousedown.stop="startResize('timestamp', $event)"></div>
          </div>
          <div class="col level">
            Level
            <div class="resizer" @mousedown.stop="startResize('level', $event)"></div>
          </div>
          <div class="col scope">
            Scope
            <div class="resizer" @mousedown.stop="startResize('scope', $event)"></div>
          </div>
          <div class="col message">Message</div>
        </div>
        <div class="table-body">
          <div 
            v-for="(log, index) in filteredAndSortedLogs" 
            :key="index" 
            class="table-row" 
            :class="{ active: selectedLog === log }"
            :style="gridStyle"
            @click="selectLog(log)"
          >
            <div class="col timestamp">{{ formatDate(log.timestamp) }}</div>
            <div class="col level" :class="log.log_level.toLowerCase()">{{ log.log_level }}</div>
            <div class="col scope">{{ log.scope }}</div>
            <div class="col message">{{ log.log_message }}</div>
          </div>
        </div>
      </div>
    </div>

    <Transition name="slide">
      <div v-if="selectedLog" class="details-panel">
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
              <div>{{ selectedLog.log_level }}</div>
            </div>
            <div class="details-row">
              <div>Scope</div>
              <div>{{ selectedLog.scope }}</div>
            </div>
            <div class="details-row">
              <div>Message</div>
              <div>{{ selectedLog.log_message }}</div>
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
          </div>

          <h3>Tags</h3>
          <div class="details-table">
            <div class="details-row header">
              <div>Key</div>
              <div>Value</div>
            </div>
            <div v-for="(value, key) in selectedLog.tags" :key="key" class="details-row">
              <div>{{ key }}</div>
              <div>{{ value }}</div>
            </div>
          </div>
        </div>
      </div>
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

.filters select {
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  background: #fff;
  height: 25px;
}

@media (prefers-color-scheme: dark) {
  .filters select {
    background: #2a2a2a;
    border-color: #444;
    color: #eee;
  }
}

.logs-container.with-details {
  flex: 0 0 60%;
  padding-right: 15px;
}

.table {
  display: flex;
  flex-direction: column;
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

@media (prefers-color-scheme: dark) {
  .table {
    background: #1e1e1e;
    border-color: #444;
  }
}

.table-header {
  background: #f4f4f4;
  font-weight: bold;
  border-bottom: 1px solid #ddd;
}

.table-header .col {
  position: relative;
}

.resizer {
  position: absolute;
  right: 0;
  top: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  z-index: 1;
}

.resizer:hover {
  background-color: #535bf2;
}

@media (prefers-color-scheme: dark) {
  .table-header {
    background: #333;
    border-color: #444;
  }
}

.table-body {
  overflow-y: auto;
  flex: 1;
}

.table-row {
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background 0.2s;
}

@media (prefers-color-scheme: dark) {
  .table-row {
    border-bottom-color: #333;
  }
}

.table-row:hover {
  background: #f9f9f9;
}

@media (prefers-color-scheme: dark) {
  .table-row:hover {
    background: #2a2a2a;
  }
}

.table-row.active {
  background: #eef2ff;
}

@media (prefers-color-scheme: dark) {
  .table-row.active {
    background: #31356e;
  }
}

.col {
  padding: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timestamp.sortable {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 5px;
}

.timestamp.sortable:hover {
  background: #eee;
}

@media (prefers-color-scheme: dark) {
  .timestamp.sortable:hover {
    background: #444;
  }
}

.sort-icon {
  font-size: 0.8em;
  color: #888;
}

.message { white-space: normal; }

.level.info { color: #2196f3; }
.level.error { color: #f44336; }
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
