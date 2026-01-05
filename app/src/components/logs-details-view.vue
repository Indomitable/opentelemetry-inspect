<script setup lang="ts">
import {Log} from "../domain/logs.ts";
import {getSeverityType} from "../domain/logs-exensions.ts";
import ResourceDetailsView from "./resource-details-view.vue";

const { log } = defineProps<{ log: Log }>();
const emits = defineEmits<{
  (e: 'close'): void;
}>();
</script>

<template>
  <section v-if="log" class="details-panel">
    <div class="details-header">
      <button class="close-btn" @click="emits('close')">×</button>
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
          <div>{{ log.timestamp }}</div>
        </div>
        <div class="details-row">
          <div>Level</div>
          <div :class="['level', getSeverityType(log.severity)]">
            {{ log.severity }}
          </div>
        </div>
        <div class="details-row">
          <div>Scope</div>
          <div>{{ log.scope }}</div>
        </div>
        <div class="details-row">
          <div>Message</div>
          <div>{{ log.message }}</div>
        </div>
        <div class="details-row" v-if="log.trace_id">
          <div>Trace Id</div>
          <div>{{ log.trace_id }}</div>
        </div>
        <div class="details-row" v-if="log.span_id">
          <div>Span Id</div>
          <div>{{ log.span_id }}</div>
        </div>
        <div class="details-row" v-if="log.event_name">
          <div>Event Name</div>
          <div>{{ log.event_name }}</div>
        </div>
      </div>

      <h3>Resource Info</h3>
      <resource-details-view :resource="log.resource" />

      <h3 v-if="log!.tags.length">Attributes</h3>
      <div class="details-table" v-if="log.tags.length">
        <div class="details-row header">
          <div>Key</div>
          <div>Value</div>
        </div>
        <div v-for="(value, key) in log.tags" :key="key" class="details-row">
          <div>{{ key }}</div>
          <div>{{ value }}</div>
        </div>
      </div>
    </div>
  </section>
</template>
