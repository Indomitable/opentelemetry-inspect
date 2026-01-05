<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed } from 'vue';
import TreeTable from 'primevue/treetable';
import Column from 'primevue/column';
import type { TreeNode } from 'primevue/treenode';
import { useTracesStore } from '../state/traces-store';
import { durationToString, Span } from '../domain/traces';
import SpanDurationBar from '../components/span-duration-bar.vue';

const route = useRoute();
const tracesStore = useTracesStore();
const traceId = route.params.traceId as string;

const spansForTrace = computed(() => {
  return Object.values(tracesStore.index).filter(s => s.trace_id === traceId);
});

const rootSpan = computed(() => spansForTrace.value.find(s => !s.parent_span_id) || null);

function spanToNode(span: Span): TreeNode {
  return {
    key: `${span.trace_id}-${span.span_id}`,
    data: span,
    children: span.children.map(spanToNode),
  } as TreeNode;
}

function getParentSpan(span: Span): Span | undefined {
  if (!span.parent_span_id) return undefined;
  const parentKey = `${span.trace_id}-${span.parent_span_id}`;
  return tracesStore.index[parentKey];
}

const treeNodes = computed(() => {
  if (!rootSpan.value) return [];
  return [spanToNode(rootSpan.value)];
});


</script>

<template>
  <div class="page">
    <div class="page__container">
      <div class="page__header-row">
        <h1>Trace: {{ route.params.traceId }}</h1>
      </div>
      <TreeTable :value="treeNodes" dataKey="key" :scrollable="true" scrollHeight="flex" class="p-datatable-sm list-table">
        <template #empty><div class="list-table__empty">No spans for this trace.</div></template>
        <Column field="name" header="Name" expander :style="{ width: '200px' }" />
        <Column header="Duration" :style="{ width: '120px' }">
          <template #body="slotProps">
            {{ durationToString(slotProps.node.data.duration) }}
          </template>
        </Column>
        <Column header="Timeline" :style="{ width: '400px' }">
          <template #body="slotProps">
            <SpanDurationBar
              :span="slotProps.node.data"
              :parent-span="getParentSpan(slotProps.node.data)"
            />
          </template>
        </Column>
      </TreeTable>
    </div>
  </div>
</template>

