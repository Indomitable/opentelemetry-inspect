<script setup lang="ts">
import ResourceDetailsView from "./resource-details-view.vue";
import {Span} from "../domain/traces.ts";
import {computed} from "vue";
import FilterButton from "./filter-button.vue";

const { span } = defineProps<{ span: Span; }>();
const emits = defineEmits<{
  (e: 'close'): void;
}>();

const attributes = computed(() => Object.entries(span.tags));
</script>

<template>
  <section class="details-panel">
    <div class="details-header">
      <button class="close-btn" @click="emits('close')">×</button>
      <h2>Span Details</h2>
    </div>

    <div class="details-content">
      <h3>Span</h3>
      <div class="details-table">
        <div class="details-row header">
          <div>Key</div>
          <div>Value</div>
          <div class="filter-col"></div>
        </div>
        <div class="details-row">
          <div>Start Time</div>
          <div>{{ span.start_time }}</div>
          <filter-button :filterKey="'start_time_unix_nano'" :value="span.start_time_unix_nano" :title="'Filter by start time'" />
        </div>
        <div class="details-row">
          <div>End Time</div>
          <div>{{ span.end_time }}</div>
          <filter-button :filterKey="'end_time_unix_nano'" :value="span.end_time_unix_nano" :title="'Filter by end time'" />
        </div>
        <div class="details-row">
          <div>Scope</div>
          <div>{{ span.scope }}</div>
          <filter-button :filterKey="'scope'" :value="span.scope" :title="'Filter by scope'" />
        </div>
        <div class="details-row">
          <div>Name</div>
          <div>{{ span.name }}</div>
          <filter-button :filterKey="'name'" :value="span.name" :title="'Filter by name'" />
        </div>
        <div class="details-row">
          <div>Kind</div>
          <div>{{ span.kind }}</div>
          <filter-button :filterKey="'kind'" :value="span.kind" :title="'Filter by span kind'" />
        </div>
        <div class="details-row">
          <div>Status Message</div>
          <div>{{ span.status.message }}</div>
          <filter-button :filterKey="'status.message'" :value="span.status.message" :title="'Filter by status message'" />
        </div>
        <div class="details-row">
          <div>Status Code</div>
          <div>{{ span.status.code }}</div>
          <filter-button :filterKey="'status.code'" :value="span.status.code" :title="'Filter by status'" />
        </div>
        <div class="details-row" v-if="span?.trace_id">
          <div>Trace Id</div>
          <div>{{ span.trace_id }}</div>
          <filter-button :filterKey="'trace_id'" :value="span.trace_id" :title="'Filter by trace id'" />
        </div>
        <div class="details-row" v-if="span?.parent_span_id">
          <div>Parent Span Id</div>
          <div>{{ span.parent_span_id }}</div>
          <filter-button :filterKey="'parent_span_id'" :value="span.parent_span_id" :title="'Filter by parent span id'" />
        </div>
        <div class="details-row" v-if="span?.span_id">
          <div>Span Id</div>
          <div>{{ span.span_id }}</div>
          <filter-button :filterKey="'span_id'" :value="span.span_id" :title="'Filter by span id'" />
        </div>
      </div>

      <h3>Resource Info</h3>
      <resource-details-view :resource="span.resource" />

      <h3 v-if="span!.events.length">Events</h3>
      <div class="details-table" v-for="(event, eventIdx) in span.events" :key="`${event.name}-${eventIdx}`">
        <div class="details-row header">
          <div>Key</div>
          <div>Value</div>
        </div>
        <div class="details-row">
          <div>Name</div>
          <div>{{ event.name }}</div>
        </div>
        <div class="details-row">
          <div>Timestamp</div>
          <div>{{ event.timestamp }}</div>
        </div>
        <div v-for="(value, key) in event.attributes" :key="`${key}-${eventIdx}`" class="details-row">
          <div>{{ key }}</div>
          <div>{{ value }}</div>
        </div>
      </div>

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
          <filter-button :filterKey="'tags.key'" :value="value" :title="`Filter by ${key}`" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
</style>
