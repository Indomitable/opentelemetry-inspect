<script setup lang="ts">
import type {TreeTableSelectionKeys} from "primevue/treetable";
import ResourceSelector from "../components/resource-selector.vue";
import {useTracesStore} from "../state/traces-store.ts";
import {durationToString, Span} from "../domain/traces.ts";
import {computed, ref} from "vue";
import ResourceDetailsView from "../components/resource-details-view.vue";
import type {TreeNode} from "primevue/treenode";

const tracesStore = useTracesStore();
const selectedInstanceId = ref<string>('-');
const selectedNode = ref<any>(null);
const selectedKey = ref<TreeTableSelectionKeys | undefined>(undefined);

const filterSpans = (instanceId: string) => {
  selectedInstanceId.value = instanceId;
};

const filteredRoots = computed(() => {
  if (selectedInstanceId.value !== '-') {
    return tracesStore.spans.filter(s => s.resource.service_instance_id === selectedInstanceId.value);
  }
  return tracesStore.spans;
});

// map Span tree to PrimeVue TreeNode[] shape
function spanToNode(span: Span): TreeNode {
  return {
    key: `${span.trace_id}-${span.span_id}`,
    data: span,
    children: span.children.map(spanToNode),
    leaf: !span.children.length,
    selectable: true,
    link: `traces/${span.trace_id}`,
  };
}

const treeNodes = computed(() => {
  return filteredRoots.value.map(spanToNode);
});

const selectedSpan = computed(() => {
   if (selectedKey.value) {
     const keys = Object.keys(selectedKey.value);
      if (keys.length > 0) {
        const key = keys[0];
        return tracesStore.index[key];
      }
   }
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

      <TreeTable
          :value="treeNodes"
          selection-mode="single"
          v-model:selection-keys="selectedKey"
          :selection="selectedNode"
          dataKey="key"
          :scrollable="true"
          scrollHeight="flex"
          column-resize-mode="fit"
          size="small"
          class="p-datatable-sm list-table"
      >
        <template #empty><div class="list-table__empty">No spans recorded.</div></template>
        <Column field="name" header="Name" expander :style="{ width: '150px' }" />
        <Column field="scope" header="Scope" :style="{ width: '150px' }" />
        <Column header="Duration" :style="{ width: '120px' }">
          <template #body="slotProps">
            {{ durationToString(slotProps.node.data.duration) }}
          </template>
        </Column>
        <Column field="kind" header="Kind" :style="{ width: '80px' }" />
        <Column field="status.code" header="Status" :style="{ width: '80px' }" />
        <Column style="width: 10rem" >
          <template #body="slotProps">
            <div v-if="slotProps.node.data.children.length > 0 && !slotProps.node.data.parent_span_id">
              <router-link :to="slotProps.node.link" class="link-button">
                <Button type="button" rounded icon="pi pi-search" severity="secondary" size="small" />
              </router-link>
            </div>
          </template>
        </Column>
      </TreeTable>
    </div>

    <Transition name="slide">
      <section v-if="selectedSpan" class="details-panel">
        <div class="details-header">
          <button class="close-btn" @click="selectedSpan = undefined">×</button>
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
