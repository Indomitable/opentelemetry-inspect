<script setup lang="ts">
import { ref } from 'vue';
import { state, type LogDto } from '../store';

const selectedLog = ref<LogDto | null>(null);

const selectLog = (log: LogDto) => {
  selectedLog.value = log;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};
</script>

<template>
  <div class="logs-page">
    <div class="logs-container" :class="{ 'with-details': selectedLog }">
      <h1>Logs</h1>
      <div class="table">
        <div class="table-header">
          <div class="col timestamp">Timestamp</div>
          <div class="col level">Level</div>
          <div class="col scope">Scope</div>
          <div class="col message">Message</div>
        </div>
        <div class="table-body">
          <div 
            v-for="(log, index) in state.logs" 
            :key="index" 
            class="table-row" 
            :class="{ active: selectedLog === log }"
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

.logs-container.with-details {
  flex: 0 0 60%;
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
  display: flex;
  background: #f4f4f4;
  font-weight: bold;
  border-bottom: 1px solid #ddd;
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
  display: flex;
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

.timestamp { flex: 0 0 180px; }
.level { flex: 0 0 80px; }
.scope { flex: 0 0 150px; }
.message { flex: 1; white-space: normal; }

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
}

@media (prefers-color-scheme: dark) {
  .details-panel {
    background: #1e1e1e;
    border-color: #444;
  }
}

.details-header {
  padding: 10px 20px;
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
  flex: 0 0 150px;
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
