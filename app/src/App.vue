<script setup lang="ts">

let ws = new WebSocket("ws://localhost:5237/ws");
ws.addEventListener('message', (event) => {
  let msg = JSON.parse(event.data);
  if ('client_id' in msg) {
    console.log('Connected with client id:', msg.client_id);
    return;
  }
  alert((msg as Message).payload);
});
ws.addEventListener('open', () => {
  const command = JSON.stringify({
    command: {
      "Subscribe": "logs"
    }
  });
  ws.send(command);
});

window.addEventListener('close', () => {
  ws.close();
});

interface Message {
  topic: string;
  payload: string;
}


</script>

<template>
  <div class="app-layout">
    <aside class="sidebar">
      <router-link to="/" title="Summary" class="nav-link">
        <span class="icon">📊</span>
      </router-link>
      <router-link to="/logs" title="Logs" class="nav-link">
        <span class="icon">📜</span>
      </router-link>
      <router-link to="/traces" title="Traces" class="nav-link">
        <span class="icon">🛣️</span>
      </router-link>
      <router-link to="/metrics" title="Metrics" class="nav-link">
        <span class="icon">📈</span>
      </router-link>
    </aside>
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