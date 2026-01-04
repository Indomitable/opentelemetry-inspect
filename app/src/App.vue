<script setup lang="ts">
import './styles/details-table.css';
import './styles/page.css';
import './styles/list-table.css';

import { onMounted, onUnmounted } from 'vue';
import {useLogsStore} from "./state/logs-store.ts";
import {WebSocketService} from "./services/websocket-service.ts";
import {useTracesStore} from "./state/traces-store.ts";

const logsStore = useLogsStore();
const tracesStore = useTracesStore();
let ws: WebSocketService | null = null;

onMounted(() => {
  ws = new WebSocketService();
  ws.registerHandlers({
    onLogReceived: (log) => {
      logsStore.addLog(log);
    },
    onSpanReceived: (span) => {
      tracesStore.addSpan(span);
    }
  });
  ws.connect();
});

onUnmounted(() => {
  if (ws) {
    ws.disconnect();
  }
});

</script>

<template>
  <div class="app-layout">
    <nav class="sidebar">
      <router-link to="/" title="Summary" class="nav-link">
        <i class="pi pi-objects-column" />
      </router-link>
      <router-link to="/logs" title="Logs" class="nav-link">
        <i class="pi pi-list" />
      </router-link>
      <router-link to="/traces" title="Traces" class="nav-link">
        <i class="pi pi-align-center"/>
      </router-link>
      <router-link to="/metrics" title="Metrics" class="nav-link">
        <i class="pi pi-chart-line" />
      </router-link>
    </nav>
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.sidebar {
  width: 60px;
  background-color: #2f2f2f;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 20px;
  gap: 20px;
  border-right: 1px solid #444;
}

.nav-link {
  text-decoration: none;
  font-size: 24px;
  color: #fff;
  width: 40px;
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.nav-link:hover {
  background-color: #444;
}

.router-link-active {
  background-color: #535bf2;
}

.content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
</style>
<style>
* {
  box-sizing: border-box;
}

:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;

  color: #0f0f0f;
  background-color: #f6f6f6;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  display: block;
  min-width: 320px;
  min-height: 100vh;
}

#app {
  width: 100%;
  height: 100vh;
}

h1 {
  margin-top: 0;
}

@media (prefers-color-scheme: dark) {
  :root {
    color: #f6f6f6;
    background-color: #2f2f2f;
  }
}
</style>