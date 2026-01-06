<script setup lang="ts">
import type {TreeTableSelectionKeys} from "primevue/treetable";
import ResourceSelector from "../components/resource-selector.vue";
import {useTracesStore} from "../state/traces-store.ts";
import {durationToString, Span} from "../domain/traces.ts";
import {computed, ref} from "vue";
import type {TreeNode} from "primevue/treenode";
import SpanDetailsView from "../components/span-details-view.vue";
import {Resource} from "../domain/resources.ts";

const tracesStore = useTracesStore();
const selectedResource = ref<Resource|null>(null);
const selectedKey = ref<TreeTableSelectionKeys | undefined>(undefined);

const filterSpans = (resource: Resource|null) => {
  selectedResource.value = resource;
};

const filteredRoots = computed(() => {
  if (selectedResource.value) {
    return tracesStore.spansForResource(selectedResource.value);
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

const closeDetails = () => {
  selectedKey.value = undefined;
};

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
          data-key="key"
          :scrollable="true"
          scroll-height="flex"
          column-resize-mode="fit"
          size="small"
          paginator
          :rows="25"
          :rows-per-page-options="[10, 25, 50, 100]"
          class="p-treetable-sm list-table"
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
      <span-details-view :span="selectedSpan" v-if="selectedSpan" @close="closeDetails" />
    </Transition>
  </div>
</template>
