<script setup lang="ts">
import {useLogsStore} from "../state/logs-store.ts";
import {useTracesStore} from "../state/traces-store.ts";
import {useMetricsStore} from "../state/metrics-store.ts";

const logsStore = useLogsStore();
const tracesStore = useTracesStore();
const metricsStore = useMetricsStore();
</script>

<template>
  <div class="summary-container">
    <div class="header-row">
      <h1>Summary</h1>
      <span class="version-tag">v1.1.0</span>
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Logs</h3>
        <router-link to="/logs" class="stat-value">
          {{ logsStore.totalCount }}
        </router-link>
      </div>
      <div class="stat-card">
        <h3>Total Spans</h3>
        <router-link to="/traces" class="stat-value">
          {{ tracesStore.totalCount }}
        </router-link>
      </div>
      <div class="stat-card">
        <h3>Metrics</h3>
        <router-link to="/metrics" class="stat-value">
          {{ metricsStore.totalCount }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.summary-container>header-row>h1 {
  height: 40px;
  line-height: 40px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version-tag {
  font-size: 0.9rem;
  color: #888;
  background: #eee;
  padding: 2px 8px;
  border-radius: 4px;
}

@media (prefers-color-scheme: dark) {
  .version-tag {
    background: #444;
    color: #bbb;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.stat-card {
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

@media (prefers-color-scheme: dark) {
  .stat-card {
    background-color: #3e3e3e;
    color: #fff;
  }
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  margin: 10px 0 0;
  color: #535bf2;
  text-decoration: none;
}
</style>
