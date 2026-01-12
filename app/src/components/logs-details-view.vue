<script setup lang="ts">
import {Log} from "../domain/logs.ts";
import {getSeverityType} from "../domain/logs-exensions.ts";
import ResourceDetailsView from "./resource-details-view.vue";
import {computed} from "vue";
import FilterButton from "./filter-button.vue";

const props = defineProps<{ log: Log; }>();
const emits = defineEmits<{
  (e: 'close'): void;
}>();
const attributes = computed(() => Object.entries(props.log.tags));
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
          <div class="details-filter-col"></div>
        </div>
        <div class="details-row">
          <div>Timestamp</div>
          <div>{{ log.timestamp }}</div>
          <filter-button :filterKey="'timestamp'" :value="log.timestamp" :title="'Filter by timestamp'" />
        </div>
        <div class="details-row">
          <div>Level</div>
          <div :class="['level', getSeverityType(log.severity)]">
            {{ log.severity }}
          </div>
          <filter-button :filterKey="'severity'" :value="log.severity" :title="'Filter by severity'" />
        </div>
        <div class="details-row">
          <div>Scope</div>
          <div>{{ log.scope }}</div>
          <filter-button :filterKey="'scope'" :value="log.scope" :title="'Filter by scope'" />
        </div>
        <div class="details-row">
          <div>Message</div>
          <div>{{ log.message }}</div>
          <filter-button :filterKey="'message'" :value="log.message" :title="'Filter by message'" />
        </div>
        <div class="details-row" v-if="log.trace_id">
          <div>Trace Id</div>
          <div>{{ log.trace_id }}</div>
          <filter-button :filterKey="'trace_id'" :value="log.trace_id" :title="'Filter by trace id'" />
        </div>
        <div class="details-row" v-if="log.span_id">
          <div>Span Id</div>
          <div>{{ log.span_id }}</div>
          <filter-button :filterKey="'span_id'" :value="log.span_id" :title="'Filter by span id'" />
        </div>
        <div class="details-row" v-if="log.event_name">
          <div>Event Name</div>
          <div>{{ log.event_name }}</div>
          <filter-button :filterKey="'event_name'" :value="log.event_name" :title="'Filter by event name'" />
        </div>
      </div>

      <h3>Resource Info</h3>
      <resource-details-view :resource="log.resource" />

      <h3 v-if="attributes.length">Attributes</h3>
      <div class="details-table" v-if="attributes.length">
        <div class="details-row header">
          <div>Key</div>
          <div>Value</div>
          <div class="details-filter-col"></div>
        </div>
        <div v-for="[key, value] in attributes" :key="key" class="details-row">
          <div>{{ key }}</div>
          <div>{{ value }}</div>
          <filter-button :filterKey="`tags.${key}`" :value="value" />
        </div>
      </div>
    </div>
  </section>
</template>
