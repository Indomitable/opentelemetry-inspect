<script setup lang="ts">
import type {TreeTableSelectionKeys} from "primevue/treetable";
import ResourceSelector from "../components/resource-selector.vue";
import {useTracesStore} from "../state/traces-store.ts";
import {durationToString, Span} from "../domain/traces.ts";
import {computed, provide, ref} from "vue";
import type {TreeNode} from "primevue/treenode";
import SpanDetailsView from "../components/span-details-view.vue";
import FilterBadge from "../components/filter-badge.vue";
import {FilterService, filterServiceInjectionKey} from "../services/filter-service.ts";

const tracesStore = useTracesStore();
const selectedKey = ref<TreeTableSelectionKeys | undefined>(undefined);

const filterService = new FilterService();
provide(filterServiceInjectionKey, filterService);

const filteredRoots = computed(() => {
  return tracesStore.spans.filter(span => filterService.matchesFilter(span));
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

const closeDetails = () => {
  selectedKey.value = undefined;
};

const showInspectButton = (span: Span) => {
  return tracesStore.spans.some(s => s.trace_id === span.trace_id && s.span_id === span.span_id);
};

</script>
<template>
  <div class="page">
    <div class="page__container" :class="{ 'page__container--with-details': selectedSpan }">
      <div class="page__header-row">
        <h1>Traces</h1>
        <div class="page__filters">
          <resource-selector />
        </div>
      </div>

      <filter-badge />

      <TreeTable
          :value="treeNodes"
          selection-mode="single"
          v-model:selection-keys="selectedKey"
          data-key="key"
          :scrollable="true"
          scroll-height="flex"
          column-resize-mode="fit"
          :size="'small'"
          paginator
          :rows="25"
          :rows-per-page-options="[10, 25, 50, 100]"
          class="list-table"
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
        <Column style="width: 10rem; padding: 0 0.5rem" >
          <template #body="slotProps">
            <div v-if="showInspectButton(slotProps.node.data)">
              <router-link :to="slotProps.node.link" class="link-button">
                <Button type="button" rounded icon="pi pi-search" severity="secondary" size="small" />
              </router-link>
            </div>
          </template>
        </Column>
      </TreeTable>
    </div>

    <Transition name="slide">
      <span-details-view :span="selectedSpan" v-if="selectedSpan" @close="closeDetails" />
    </Transition>
  </div>
</template>

<style>
  .p-treetable-node-toggle-button {
    height: 1.5rem !important;
  }
</style>
