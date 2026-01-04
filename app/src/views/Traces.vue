<script setup lang="ts">
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import ResourceSelector from "../components/resource-selector.vue";
import {useTracesStore} from "../state/traces-store.ts";
import {durationToString, Span} from "../domain/traces.ts";
import {computed, ref} from "vue";
import ResourceDetailsView from "../components/resource-details-view.vue";

const tracesStore = useTracesStore();
const selectedSpan = ref<Span | null>(null);
const selectedInstanceId = ref<string>('-');

const filterSpans = (instanceId: string) => {
  selectedInstanceId.value = instanceId;
};

const filteredSpans = computed(() => {
  if (selectedInstanceId.value !== '-') {
    return tracesStore.spans;//.filter(selectedInstanceId.value);
  }

  return tracesStore.spans;
});

</script>
<template>
  <div class="page">
    <div class="page__container" :class="{ 'page__container--with-details': selectedSpan }">
      <div class="page__header-row">
        <h1>Traces</h1>
        <div class="page__filters">
          <resource-selector @update:model-value="filterSpans" />
        </div>
      </div>

      <DataTable
          v-model:selection="selectedSpan"
          :value="filteredSpans"
          selectionMode="single"
          dataKey="span_id"
          :scrollable="true"
          scrollHeight="flex"
          resizableColumns
          columnResizeMode="fit"
          sortField="start_time"
          :sortOrder="-1"
          class="p-datatable-sm list-table"
      >
        <template #empty><div class="list-table__empty">No spans recorded.</div></template>
        <Column field="scope" header="Scope" sortable :style="{ width: '150px' }" />
        <Column field="name" header="Name" sortable :style="{ width: '150px' }" />
        <Column header="Duration" sortable :style="{ width: '120px' }">
          <template #body="slotProps">
            {{ durationToString(slotProps.data.duration) }}
          </template>
        </Column>
        <Column field="kind" header="Kind" sortable :style="{ width: '80px' }" />
        <Column field="status.code" header="Status" sortable :style="{ width: '80px' }" />
        <Column field="trace_id" header="Trace Id" sortable :style="{ width: '150px' }" />
        <Column field="span_id" header="Span Id" sortable :style="{ width: '150px' }" />
        <Column field="parent_span_id" header="Parent Span Id" sortable :style="{ width: '150px' }" />
      </DataTable>
    </div>

    <Transition name="slide">
      <section v-if="selectedSpan" class="details-panel">
        <div class="details-header">
          <button class="close-btn" @click="selectedSpan = null">×</button>
          <h2>Span Details</h2>
        </div>

        <div class="details-content">
          <h3>Span</h3>
          <div class="details-table">
            <div class="details-row header">
              <div>Key</div>
              <div>Value</div>
            </div>
            <div class="details-row">
              <div>Start Time</div>
              <div>{{ selectedSpan.start_time }}</div>
            </div>
            <div class="details-row">
              <div>End Time</div>
              <div>{{ selectedSpan.end_time }}</div>
            </div>
            <div class="details-row">
              <div>Scope</div>
              <div>{{ selectedSpan.scope }}</div>
            </div>
            <div class="details-row">
              <div>Name</div>
              <div>{{ selectedSpan.name }}</div>
            </div>
            <div class="details-row">
              <div>Kind</div>
              <div>{{ selectedSpan.kind }}</div>
            </div>
            <div class="details-row">
              <div>Status Message</div>
              <div>{{ selectedSpan.status.message }}</div>
            </div>
            <div class="details-row">
              <div>Status Code</div>
              <div>{{ selectedSpan.status.code }}</div>
            </div>
            <div class="details-row" v-if="selectedSpan?.trace_id">
              <div>Trace Id</div>
              <div>{{ selectedSpan.trace_id }}</div>
            </div>
            <div class="details-row" v-if="selectedSpan?.parent_span_id">
              <div>Parent Span Id</div>
              <div>{{ selectedSpan.parent_span_id }}</div>
            </div>
            <div class="details-row" v-if="selectedSpan?.span_id">
              <div>Span Id</div>
              <div>{{ selectedSpan.span_id }}</div>
            </div>
          </div>

          <h3>Resource Info</h3>
          <resource-details-view :resource="selectedSpan!.resource" />

          <h3 v-if="selectedSpan!.events.length">Events</h3>
          <div class="details-table" v-for="event in selectedSpan!.events" :key="event.name">
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
            <div v-for="(value, key) in event.attributes" :key="key" class="details-row">
              <div>{{ key }}</div>
              <div>{{ value }}</div>
            </div>
          </div>

          <h3 v-if="selectedSpan!.tags.length">Attributes</h3>
          <div class="details-table" v-if="selectedSpan!.tags.length">
            <div class="details-row header">
              <div>Key</div>
              <div>Value</div>
            </div>
            <div v-for="(value, key) in selectedSpan!.tags" :key="key" class="details-row">
              <div>{{ key }}</div>
              <div>{{ value }}</div>
            </div>
          </div>
        </div>
      </section>
    </Transition>
  </div>
</template>
